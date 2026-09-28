"""Admin API endpoints – Admin-only operations for users, branches, reports, and dashboard."""

import asyncio
import csv
import io
import logging
import os as _os
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from app.core.cache import cache_get, cache_set, cache_delete
from app.core.security import require_admin

# Shared thread pool for blocking SAP calls
_executor = ThreadPoolExecutor(max_workers=min(32, (_os.cpu_count() or 4) * 4))

# Admin dashboard cache TTL (2 minutes – expensive cross-branch SAP call)
_ADMIN_DASHBOARD_TTL = 120


def _line_row_cap(range_str: str) -> int:
    caps = {
        "daily": 15000,
        "weekly": 30000,
        "monthly": 60000,
        "yearly": 90000,
        "all_time": 120000,
    }
    return caps.get(range_str, 30000)
from app.models.schemas import (
    AdminUserCreate,
    AdminUserUpdate,
    AdminUserResponse,
    AdminDashboardData,
    SalesTrendPoint,
    TopProduct,
    BranchSummary,
    PaymentMethodSummary,
    ReturnReasonSummary,
)
from app.services import user_service
from app.services.sap.warehouses_service import SAPWarehousesService
from app.services.sap.invoices_service import SAPInvoicesService
from app.services.sap.client import get_sap_client, SAPConnectionError
from app.api.v1.customers import _compute_customer_insights
from app.services import approval_service
from app.services.sap.returns_service import SAPReturnsService
from app.models.schemas import ReturnCreate, ExchangeCreate

router = APIRouter()
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Helper utilities
# ──────────────────────────────────────────────────────────────────────────────

def _get_date_range(range_str: str):
    """Return (start_date, end_date) for the requested range."""
    today = date.today()
    if range_str == "daily":
        return today, today
    elif range_str == "weekly":
        return today - timedelta(days=6), today
    elif range_str == "monthly":
        return today.replace(day=1), today
    elif range_str == "yearly":
        return today.replace(month=1, day=1), today
    else:  # all_time
        return date(2000, 1, 1), today


def _get_date_range_with_custom(range_str: str, from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Return (start_date, end_date), supporting custom date range."""
    if bool(from_date) != bool(to_date):
        raise HTTPException(status_code=422, detail="from_date and to_date must be provided together.")
    if from_date and to_date:
        try:
            start_date = date.fromisoformat(from_date)
            end_date = date.fromisoformat(to_date)
        except ValueError:
            raise HTTPException(status_code=422, detail="Custom dates must use YYYY-MM-DD format.")
        if start_date > end_date:
            raise HTTPException(status_code=422, detail="from_date must not be after to_date.")
        return start_date, end_date
    return _get_date_range(range_str)


def _get_previous_date_range(start_date: date, end_date: date, range_str: str):
    """Return equivalent previous range; all_time has no previous comparison window."""
    if range_str == "all_time":
        return None, None

    window_days = max((end_date - start_date).days, 0)
    previous_end = start_date - timedelta(days=1)
    previous_start = previous_end - timedelta(days=window_days)
    return previous_start, previous_end


def _compute_trend(invoices: List[Dict[str, Any]], range_str: str) -> List[SalesTrendPoint]:
    """Group invoices into time-bucketed trend data for charting."""
    grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "billCount": 0})

    for inv in invoices:
        raw_date = str(inv.get("DocDate") or "")[:10]
        if not raw_date:
            continue

        # Bucket label: day for daily/weekly/monthly, month for yearly/all_time
        if range_str in ("daily", "weekly", "monthly"):
            label = raw_date          # YYYY-MM-DD
        else:
            label = raw_date[:7]      # YYYY-MM

        grouped[label]["total"] += float(inv.get("DocTotal") or 0)
        grouped[label]["billCount"] += 1

    return [
        SalesTrendPoint(
            label=k,
            total=round(v["total"], 2),
            billCount=v["billCount"],
        )
        for k, v in sorted(grouped.items())
    ]


def _compute_top_products(invoices: List[Dict[str, Any]], limit: int = 10) -> List[TopProduct]:
    """Aggregate DocumentLines across invoices to find top-selling products."""
    products: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"itemName": "", "quantity": 0, "revenue": 0.0})

    for inv in invoices:
        for line in (inv.get("DocumentLines") or []):
            code = str(line.get("ItemCode") or "").strip()
            if not code:
                continue
            products[code]["itemName"] = str(line.get("ItemDescription") or code)
            products[code]["quantity"] += int(float(line.get("Quantity") or 0))
            products[code]["revenue"] += float(line.get("LineTotal") or 0)

    top = sorted(products.items(), key=lambda x: x[1]["quantity"], reverse=True)[:limit]
    return [
        TopProduct(
            itemCode=code,
            itemName=data["itemName"],
            quantity=data["quantity"],
            revenue=round(data["revenue"], 2),
        )
        for code, data in top
    ]


def _extract_invoice_branch(invoice: Dict[str, Any]) -> Optional[str]:
    for key in (
        "U_Branch",
        "U_BranchId",
        "U_Branch_ID",
        "U_BranchCode",
        "U_Warehouse",
        "U_WarehouseCode",
        "U_Warehouse_Code",
    ):
        value = str(invoice.get(key) or "").strip()
        if value:
            return value

    for line in invoice.get("DocumentLines") or []:
        candidate = str(line.get("WarehouseCode") or "").strip()
        if candidate:
            return candidate
    return None


def _compute_branch_breakdown(
    invoices: List[Dict[str, Any]],
    warehouse_names: Dict[str, str],
) -> List[BranchSummary]:
    """Aggregate branch revenue and bill counts from invoice lines by WarehouseCode."""
    grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "billCount": 0})

    for inv in invoices:
        invoice_branch_codes = set()
        lines = inv.get("DocumentLines") or []
        if not lines:
            raise ValueError("Cannot compare branches without invoice lines.")
        for line in lines:
            branch_id = str(line.get("WarehouseCode") or "").strip()
            if not branch_id:
                raise ValueError("Cannot compare branches without warehouse-attributed invoice lines.")
            grouped[branch_id]["total"] += float(line.get("LineTotal") or 0)
            invoice_branch_codes.add(branch_id)

        for branch_id in invoice_branch_codes:
            grouped[branch_id]["billCount"] += 1

    summaries = [
        BranchSummary(
            branchId=branch_id,
            branchName=warehouse_names.get(branch_id, branch_id),
            total=round(values["total"], 2),
            billCount=values["billCount"],
        )
        for branch_id, values in grouped.items()
    ]
    return sorted(summaries, key=lambda s: s.total, reverse=True)


def _compute_payment_split(invoices: List[Dict[str, Any]]) -> List[PaymentMethodSummary]:
    """Aggregate invoice totals by payment method for donut/summary cards."""
    grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "billCount": 0})

    for inv in invoices:
        method = str(inv.get("U_P_Method") or "unknown").strip().lower() or "unknown"
        grouped[method]["total"] += float(inv.get("DocTotal") or 0)
        grouped[method]["billCount"] += 1

    payment_split = [
        PaymentMethodSummary(
            method=method,
            total=round(values["total"], 2),
            billCount=values["billCount"],
        )
        for method, values in grouped.items()
    ]
    return sorted(payment_split, key=lambda p: p.total, reverse=True)


def _fetch_credit_notes_for_range(branch: Optional[str], start_date: date, end_date: date) -> List[Dict[str, Any]]:
    return SAPReturnsService().get_returns_by_date(start_date, end_date, warehouse=branch)


def _compute_returns_analytics(
    credit_notes: List[Dict[str, Any]], total_invoices: int
) -> Dict[str, Any]:
    total_returns = len(credit_notes)
    exchange_count = 0
    refund_count = 0
    total_refunded = 0.0
    reason_count: Dict[str, int] = defaultdict(int)

    for note in credit_notes:
        total_refunded += float(note.get("DocTotal") or 0)
        comments = str(note.get("Comments") or "").lower()
        reason = ""
        if not reason:
            for part in comments.split("|"):
                part = part.strip()
                if part.startswith("return reason:"):
                    reason = part[len("return reason:"):].strip()
                    break
        if not reason:
            reason = "other"
        reason_count[reason] += 1

        for part in comments.split("|"):
            part = part.strip()
            if part.startswith("return type:"):
                rt = part[len("return type:"):].strip()
                if rt == "exchange":
                    exchange_count += 1
                else:
                    refund_count += 1
                break
        else:
            refund_count += 1

    return_rate = round((total_returns / total_invoices) * 100, 2) if total_invoices > 0 else 0.0
    top_reasons = sorted(
        [ReturnReasonSummary(reason=r, count=c) for r, c in reason_count.items()],
        key=lambda x: x.count,
        reverse=True,
    )[:6]

    return {
        "totalReturns": total_returns,
        "exchangeCount": exchange_count,
        "refundCount": refund_count,
        "totalRefundedAmount": round(total_refunded, 2),
        "returnRate": return_rate,
        "topReturnReasons": top_reasons,
    }


def _compute_top_employees(invoices: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "billCount": 0})

    for inv in invoices:
        code = str(inv.get("U_S_Employee") or "").strip()
        if not code or code.upper() == "UNASSIGNED":
            continue
        grouped[code]["total"] += float(inv.get("DocTotal") or 0)
        grouped[code]["billCount"] += 1

    if not grouped:
        return []

    ranked = sorted(grouped.items(), key=lambda item: item[1]["total"], reverse=True)[:limit]
    return [
        {
            "employeeCode": code,
            "total": round(data["total"], 2),
            "billCount": data["billCount"],
        }
        for code, data in ranked
    ]


def _filter_invoices_by_branch(invoices: List[Dict[str, Any]], branch: Optional[str]) -> List[Dict[str, Any]]:
    if not branch:
        return invoices

    filtered: List[Dict[str, Any]] = []
    for inv in invoices:
        lines = inv.get("DocumentLines") or []
        line_branches = {
            str(line.get("WarehouseCode") or "").strip().upper()
            for line in lines
        }
        if not lines or "" in line_branches:
            raise ValueError("Cannot determine branch for one or more SAP invoices.")
        if len(line_branches) > 1:
            raise ValueError("Cannot allocate an invoice across multiple warehouses.")
        if line_branches:
            if branch.upper() in line_branches:
                filtered.append(inv)
            continue

        continue

    return filtered


def _get_fallback_branches_from_users() -> List[Dict[str, Optional[str]]]:
    """Build a branch list from local user branch assignments when SAP is unavailable."""
    branch_map: Dict[str, Dict[str, Optional[str]]] = {}
    for user in user_service.get_all_users():
        branch_id = str(user.get("branch_id") or "").strip()
        if not branch_id:
            continue

        current = branch_map.get(branch_id)
        if not current:
            branch_map[branch_id] = {
                "id": branch_id,
                "name": str(user.get("store_name") or branch_id),
                "location": None,
            }
            continue

        if current["name"] == branch_id and user.get("store_name"):
            current["name"] = str(user.get("store_name"))

    return [branch_map[key] for key in sorted(branch_map.keys())]


# ──────────────────────────────────────────────────────────────────────────────
# Branches (SAP Warehouses)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/branches")
async def list_branches(current_user: dict = Depends(require_admin)):
    """List all active SAP warehouses available as branches."""
    try:
        service = SAPWarehousesService()
        loop = asyncio.get_running_loop()
        warehouses = await loop.run_in_executor(_executor, service.get_warehouses)
        return [
            {
                "id": w.get("WarehouseCode"),
                "name": w.get("WarehouseName"),
                "location": w.get("Location"),
            }
            for w in warehouses
        ]
    except Exception as e:
        logger.warning(f"SAP branches unavailable, using local fallback: {e}")
        return _get_fallback_branches_from_users()


# ──────────────────────────────────────────────────────────────────────────────
# User Management
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[AdminUserResponse])
async def list_users(current_user: dict = Depends(require_admin)):
    """List all users with full admin details."""
    users = user_service.get_all_users()
    return [AdminUserResponse(**u) for u in users]


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: AdminUserCreate, current_user: dict = Depends(require_admin)):
    """Create a new user and assign them to a branch."""
    user = user_service.create_user(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        name=user_data.name,
        role=user_data.role,
        branch_id=user_data.branch_id,
        store_name=user_data.store_name,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this username or email already exists.",
        )
    return AdminUserResponse(**user)


@router.put("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: str,
    user_data: AdminUserUpdate,
    current_user: dict = Depends(require_admin),
):
    """Update any user field including branch assignment or password."""
    updates = user_data.model_dump(exclude_none=True)
    try:
        user = user_service.update_user(user_id, updates)
    except ValueError as exc:
        reason = str(exc)
        if reason == "PASSWORD_MISMATCH":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
        if reason == "PASSWORD_MISSING":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current and new password are required.")
        if reason == "USERNAME_EXISTS":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists.")
        if reason == "EMAIL_EXISTS":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists.")
        raise
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return AdminUserResponse(**user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Deactivate (soft-delete) a user so they can no longer log in."""
    success = user_service.deactivate_user(user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")


# ──────────────────────────────────────────────────────────────────────────────
# Admin Dashboard
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=AdminDashboardData)
async def get_admin_dashboard(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    branch: Optional[str] = Query(None, description="Filter by SAP WarehouseCode"),
    force_refresh: bool = Query(False, description="Bypass and evict the server-side cache"),
    current_user: dict = Depends(require_admin),
):
    """
    Aggregated sales dashboard for the admin panel.
    Returns totals, sales trend, and top products for the requested date range.
    """
    cache_key = f"pos:admin:dashboard:{range}:{branch or 'all'}"

    if force_refresh:
        await cache_delete(cache_key)
        logger.info(f"Admin dashboard cache evicted by force_refresh (key={cache_key!r})")

    cached_payload = await cache_get(cache_key)
    if cached_payload is not None:
        if "customerInsights" in cached_payload:
            return AdminDashboardData(**cached_payload)
        await cache_delete(cache_key)

    start_date, end_date = _get_date_range(range)
    previous_start, previous_end = _get_previous_date_range(start_date, end_date, range)

    loop = asyncio.get_running_loop()
    try:
        invoice_service = SAPInvoicesService()
        invoices = await loop.run_in_executor(
            _executor,
            lambda: invoice_service.get_invoices_by_date_with_lines(
                start_date,
                end_date,
                max_line_rows=_line_row_cap(range),
            ),
        )
        invoices = _filter_invoices_by_branch(invoices, branch)

        previous_invoices: List[Dict[str, Any]] = []
        if previous_start and previous_end:
            previous_invoices = await loop.run_in_executor(
                _executor, lambda: invoice_service.get_invoices_by_date_with_lines(previous_start, previous_end)
            )
            previous_invoices = _filter_invoices_by_branch(previous_invoices, branch)
    except Exception as e:
        logger.error(f"Admin dashboard fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve data from SAP")

    try:
        warehouses = await loop.run_in_executor(
            _executor, SAPWarehousesService().get_warehouses
        )
    except Exception as e:
        logger.warning(f"Could not fetch branches for dashboard KPIs: {e}")
        warehouses = []

    warehouse_names = {
        str(w.get("WarehouseCode") or ""): str(w.get("WarehouseName") or w.get("WarehouseCode") or "")
        for w in warehouses
        if w.get("WarehouseCode")
    }

    try:
        credit_notes = await loop.run_in_executor(
            _executor, lambda: _fetch_credit_notes_for_range(branch, start_date, end_date)
        )
    except Exception as e:
        logger.error(f"Admin dashboard returns fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve return data from SAP")

    returns_analytics = _compute_returns_analytics(credit_notes, len(invoices))
    try:
        try:
            branch_breakdown = _compute_branch_breakdown(invoices, warehouse_names)
        except Exception as e:
            logger.error("Admin dashboard branch attribution failed: %s", e)
            raise HTTPException(status_code=502, detail="Could not determine branch sales data from SAP")
    except Exception as e:
        logger.error("Admin dashboard branch attribution failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not determine branch sales data from SAP")
    top_branch = branch_breakdown[0] if branch_breakdown else None

    active_users = sum(1 for user in user_service.get_all_users() if user.get("is_active", True))

    total_revenue = sum(float(inv.get("DocTotal") or 0) for inv in invoices)
    previous_revenue = sum(float(inv.get("DocTotal") or 0) for inv in previous_invoices)
    bill_count = len(invoices)
    items_sold = sum(
        int(float(line.get("Quantity") or 0))
        for inv in invoices
        for line in (inv.get("DocumentLines") or [])
    )
    average_bill = round(total_revenue / bill_count, 2) if bill_count else 0.0

    growth_percent = 0.0
    if previous_revenue > 0:
        growth_percent = round(((total_revenue - previous_revenue) / previous_revenue) * 100, 2)
    elif total_revenue > 0:
        growth_percent = 100.0

    result = AdminDashboardData(
        totalRevenue=round(total_revenue, 2),
        billCount=bill_count,
        itemsSoldCount=items_sold,
        averageBillValue=average_bill,
        activeBranches=len(branch_breakdown) if branch else len(warehouse_names),
        activeUsers=active_users,
        previousRevenue=round(previous_revenue, 2),
        growthPercent=growth_percent,
        topBranch=top_branch,
        branchBreakdown=branch_breakdown,
        paymentSplit=_compute_payment_split(invoices),
        trend=_compute_trend(invoices, range),
        topProducts=_compute_top_products(invoices),
        topEmployees=_compute_top_employees(invoices),
        customerInsights=_compute_customer_insights(invoices),
        totalReturns=returns_analytics["totalReturns"],
        exchangeCount=returns_analytics["exchangeCount"],
        refundCount=returns_analytics["refundCount"],
        totalRefundedAmount=returns_analytics["totalRefundedAmount"],
        returnRate=returns_analytics["returnRate"],
        netRevenueAfterReturns=round(total_revenue - returns_analytics["totalRefundedAmount"], 2),
        topReturnReasons=returns_analytics["topReturnReasons"],
    )
    await cache_set(cache_key, result.model_dump(), ttl=_ADMIN_DASHBOARD_TTL)
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Reports Export
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/reports/export")
async def export_reports(
    current_user: dict = Depends(require_admin),
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Filter by SAP WarehouseCode"),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
):
    """
    Download sales data as a CSV or XLSX file for the selected date range.
    Supports custom from_date/to_date in addition to preset ranges.
    Rows contain: DocNum, Date, Customer Name, Mobile, Payment Method, Subtotal, Discount, GST, Total.
    """
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)

    try:
        invoice_service = SAPInvoicesService()
        loop = asyncio.get_running_loop()
        all_invoices = await loop.run_in_executor(
            _executor,
            lambda: (
                invoice_service.get_invoices_by_date_with_lines(start_date, end_date)
                if branch else invoice_service.get_invoices_by_date(start_date, end_date)
            ),
        )
        invoices = _filter_invoices_by_branch(all_invoices, branch) if branch else all_invoices
    except Exception as e:
        logger.error(f"Report export failed: {e}")
        raise HTTPException(status_code=502, detail="Could not fetch data from SAP")

    range_label = f"{from_date}_to_{to_date}" if from_date and to_date else range
    headers = [
        "DocNum", "Date", "Customer Name", "Mobile", "Sales Employee", "Payment Method",
        "Subtotal", "Discount", "GST", "Total",
    ]

    rows = []
    for inv in invoices:
        doc_total = float(inv.get("DocTotal") or 0)
        gst = float(inv.get("VatSum") or 0)
        discount = float(inv.get("TotalDiscount") or 0)
        subtotal = doc_total - gst + discount

        rows.append([
            inv.get("DocNum", ""),
            str(inv.get("DocDate", ""))[:10],
            inv.get("U_C_Name") or "",
            inv.get("U_W_Number") or "",
            inv.get("U_S_Employee") or "",
            inv.get("U_P_Method", ""),
            round(subtotal, 2),
            round(discount, 2),
            round(gst, 2),
            round(doc_total, 2),
        ])

    if format == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Sales Report"
        sheet.append(headers)
        for row in rows:
            sheet.append(row)

        output = io.BytesIO()
        workbook.save(output)
        output.seek(0)
        filename = f"sales_report_{range_label}_{date.today().isoformat()}.xlsx"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)

    output.seek(0)
    filename = f"sales_report_{range_label}_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ──────────────────────────────────────────────────────────────────────────────
# Refund Approvals
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/approvals")
async def get_approvals(current_user: dict = Depends(require_admin)):
    """Get all pending approval requests."""
    branch_id = str(current_user.get("branch_id") or "").strip().upper()
    return approval_service.get_pending_approvals(branch_id=branch_id or None)


def _approval_reviewer_id(current_user: dict) -> str:
    reviewer_id = current_user.get("user_id") or current_user.get("id")
    if not reviewer_id:
        raise HTTPException(status_code=401, detail="Authenticated user identity is unavailable.")
    return str(reviewer_id)


def _ensure_approval_branch_access(req: dict, current_user: dict) -> None:
    reviewer_branch = str(current_user.get("branch_id") or "").strip().upper()
    request_branch = str(req.get("branch_id") or "").strip().upper()
    if reviewer_branch and reviewer_branch != request_branch:
        raise HTTPException(status_code=403, detail="Forbidden: request is outside your assigned branch.")


def _complete_approval_request(req_id: str, reviewer_id: str, payload: dict) -> None:
    try:
        completed = approval_service.update_approval_status(
            req_id, "completed", reviewer_id, from_status="processing", payload=payload
        )
    except Exception as exc:
        logger.error("Could not persist completed approval %s: %s", req_id, exc)
        completed = False

    if completed:
        return

    try:
        approval_service.update_approval_status(
            req_id, "outcome-unknown", reviewer_id, from_status="processing", payload=payload
        )
    except Exception as exc:
        logger.error("Could not persist unknown outcome for approval %s: %s", req_id, exc)
    raise HTTPException(
        status_code=502,
        detail="SAP transaction succeeded but approval status could not be confirmed; outcome is unknown",
    )


@router.post("/approvals/{req_id}/approve")
async def approve_request(req_id: str, current_user: dict = Depends(require_admin)):
    """Approve a request and execute the SAP action."""
    req = approval_service.get_approval_request(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    _ensure_approval_branch_access(req, current_user)
    reviewer_id = _approval_reviewer_id(current_user)
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req['status']}")
    
    if req["requester_id"] == reviewer_id:
        raise HTTPException(status_code=403, detail="You cannot approve your own request")

    # Mark as processing first to prevent replay
    success = approval_service.update_approval_status(req_id, "processing", reviewer_id, from_status="pending")
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update status, request may not be pending")

    try:
        loop = asyncio.get_running_loop()
        returns_service = SAPReturnsService()
        invoice_service = SAPInvoicesService()

        # Re-validate source document
        invoice = await loop.run_in_executor(_executor, lambda: invoice_service.get_invoice(req["original_doc_entry"]))
        if not invoice:
            approval_service.update_approval_status(req_id, "failed", reviewer_id, from_status="processing")
            raise HTTPException(status_code=404, detail="Original invoice not found during approval validation")

        if req["request_type"] in ("refund", "store_credit"):
            return_data = ReturnCreate(**req["payload"])
            credit_note_payload = {
                "originalDocEntry": return_data.originalDocEntry,
                "originalDocNum": return_data.originalDocNum,
                "items": [
                    {
                        "itemCode": item.itemCode,
                        "itemName": item.itemName,
                        "quantity": item.quantity,
                        "unitPrice": item.unitPrice,
                        "warehouse": item.warehouse or req["branch_id"],
                        "baseLine": item.baseLine,
                    }
                    for item in return_data.items
                ],
                "reason": return_data.reason,
                "returnType": return_data.returnType,
                "warehouse": req["branch_id"],
                "cardCode": return_data.cardCode,
            }
            try:
                result = await loop.run_in_executor(
                    _executor, lambda: returns_service.create_credit_note_from_invoice(credit_note_payload)
                )
            except SAPConnectionError as sap_exc:
                logger.error("SAP credit-note outcome is unknown: %s", sap_exc)
                approval_service.update_approval_status(req_id, "outcome-unknown", reviewer_id, from_status="processing")
                raise HTTPException(status_code=502, detail="SAP credit-note outcome is unknown; request marked accordingly")
            except Exception as sap_exc:
                logger.error("Failed to execute credit note in SAP: %s", sap_exc)
                approval_service.update_approval_status(req_id, "failed", reviewer_id, from_status="processing")
                raise HTTPException(status_code=502, detail="SAP execution failed, request marked as failed")

            if not isinstance(result, dict) or not result.get("DocEntry"):
                approval_service.update_approval_status(req_id, "outcome-unknown", reviewer_id, from_status="processing")
                raise HTTPException(status_code=502, detail="SAP returned no credit-note reference; request outcome is unknown")
            
            # Update payload with result
            req["payload"]["creditNoteDocEntry"] = result.get("DocEntry")
            req["payload"]["creditNoteDocNum"] = result.get("DocNum")
            _complete_approval_request(req_id, reviewer_id, req["payload"])
            
            return {"status": "success", "message": "Approved and executed", "docEntry": result.get("DocEntry")}
            
        elif req["request_type"] == "exchange":
            exchange_data = ExchangeCreate(**req["payload"])
            credit_note_payload = {
                "originalDocEntry": exchange_data.originalDocEntry,
                "originalDocNum": exchange_data.originalDocNum,
                "items": [
                    {
                        "itemCode": item.itemCode,
                        "itemName": item.itemName,
                        "quantity": item.quantity,
                        "unitPrice": item.unitPrice,
                        "warehouse": item.warehouse or req["branch_id"],
                        "baseLine": item.baseLine,
                    }
                    for item in exchange_data.returnItems
                ],
                "reason": exchange_data.reason,
                "returnType": "exchange",
                "warehouse": req["branch_id"],
                "cardCode": exchange_data.cardCode,
            }
            try:
                return_result = await loop.run_in_executor(
                    _executor, lambda: returns_service.create_credit_note_from_invoice(credit_note_payload)
                )
            except SAPConnectionError as sap_exc:
                logger.error("SAP credit-note outcome for exchange is unknown: %s", sap_exc)
                approval_service.update_approval_status(req_id, "outcome-unknown", reviewer_id, from_status="processing")
                raise HTTPException(status_code=502, detail="SAP credit-note outcome is unknown; request marked accordingly")
            except Exception as sap_exc:
                logger.error("Failed to execute credit note for exchange in SAP: %s", sap_exc)
                approval_service.update_approval_status(req_id, "failed", reviewer_id, from_status="processing")
                raise HTTPException(status_code=502, detail="SAP execution failed at credit note step")

            if not isinstance(return_result, dict) or not return_result.get("DocEntry"):
                req["payload"]["creditNoteDocEntry"] = None
                approval_service.update_approval_status(req_id, "outcome-unknown", reviewer_id, from_status="processing", payload=req["payload"])
                raise HTTPException(status_code=502, detail="SAP returned no credit-note reference; exchange outcome is unknown")
            
            # Step 1 succeeded. We now have a credit note.
            req["payload"]["creditNoteDocEntry"] = return_result.get("DocEntry")
            req["payload"]["creditNoteDocNum"] = return_result.get("DocNum")

            # Step 2: Create new invoice for replacement items
            new_sale_data = {
                "items": [
                    {
                        "product": {
                            "id": item.product.id,
                            "name": item.product.name,
                            "price": item.product.price,
                            "warehouse": item.product.warehouse or req["branch_id"],
                            "category": item.product.category,
                            "brand": item.product.brand,
                        },
                        "quantity": item.quantity,
                    }
                    for item in exchange_data.replacementItems
                ],
                "total": sum(item.product.price * item.quantity for item in exchange_data.replacementItems),
                "subtotal": sum(item.product.price * item.quantity for item in exchange_data.replacementItems),
                "discount": 0,
                "gst": 0,
                "customer": {
                    "name": "CASH",
                    "phone": "0000000000",
                    "payment_method": "exchange",
                    "sales_employee": current_user.get("sap_user_code") or "",
                },
                "branch_id": req["branch_id"],
            }
            
            try:
                invoice_result = await loop.run_in_executor(
                    _executor, lambda: invoice_service.create_invoice(new_sale_data)
                )
            except Exception as sap_exc:
                logger.error("Failed to execute new invoice for exchange in SAP (credit note already created): %s", sap_exc)
                # Partial failure: Credit note exists, invoice failed. Status is outcome-unknown to prevent blind retry.
                approval_service.update_approval_status(req_id, "outcome-unknown", reviewer_id, from_status="processing", payload=req["payload"])
                raise HTTPException(status_code=502, detail="SAP execution partial failure: Credit note created, but replacement invoice failed")

            if not isinstance(invoice_result, dict) or not invoice_result.get("DocEntry"):
                approval_service.update_approval_status(req_id, "outcome-unknown", reviewer_id, from_status="processing", payload=req["payload"])
                raise HTTPException(status_code=502, detail="SAP returned no replacement invoice reference; exchange outcome is unknown")
            
            req["payload"]["newInvoiceDocEntry"] = invoice_result.get("DocEntry")
            req["payload"]["newInvoiceDocNum"] = invoice_result.get("DocNum")
            
            _complete_approval_request(req_id, reviewer_id, req["payload"])
            return {"status": "success", "message": "Approved and exchange completed", "returnDocEntry": return_result.get("DocEntry"), "newInvoiceDocEntry": invoice_result.get("DocEntry")}
            
        else:
            approval_service.update_approval_status(req_id, "failed", reviewer_id, from_status="processing")
            raise HTTPException(status_code=400, detail="Unknown request type")
            
    except HTTPException:
        raise
    except Exception as exc:
        # Unexpected error (like connection loss before checking)
        approval_service.update_approval_status(req_id, "outcome-unknown", reviewer_id, from_status="processing")
        logger.error("Unexpected error executing approved request %s: %s", req_id, exc)
        raise HTTPException(status_code=502, detail="Unexpected error during execution, outcome unknown.")


@router.post("/approvals/{req_id}/reject")
async def reject_request(req_id: str, current_user: dict = Depends(require_admin)):
    """Reject a request."""
    req = approval_service.get_approval_request(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    _ensure_approval_branch_access(req, current_user)
    reviewer_id = _approval_reviewer_id(current_user)
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req['status']}")

    if req["requester_id"] == reviewer_id:
        raise HTTPException(status_code=403, detail="You cannot reject your own request")

    success = approval_service.update_approval_status(req_id, "rejected", reviewer_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update status")

    return {"status": "success", "message": "Rejected"}
