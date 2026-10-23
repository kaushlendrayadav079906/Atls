"""Invoice Report API - SAP Business One live invoice reporting endpoints."""

from __future__ import annotations

import asyncio
import csv
from datetime import date, datetime, timedelta
import io
import logging
from typing import Any, Dict, List, Optional
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from app.api.v1.admin import _get_date_range_with_custom
from app.core.security import require_permission
from app.services.sap.invoices_report_service import SAPInvoicesReportService

logger = logging.getLogger(__name__)

router = APIRouter()
service = SAPInvoicesReportService()


def _get_permitted_branch(user: dict, requested_branch: Optional[str] = None) -> Optional[str]:
    """Enforces role-based branch authorization."""
    role = str(user.get("role") or "user").lower()
    if role in ("admin", "administrator"):
        if requested_branch and requested_branch.strip().upper() not in ("ALL", "ALL BRANCHES", "*", ""):
            return requested_branch.strip()
        return None

    if role == "manager":
        manager_branch = user.get("branch_id")
        if not manager_branch:
            raise HTTPException(status_code=403, detail="Manager has no branch assigned.")
        return manager_branch

    user_branch = str(user.get("branch_id") or "").strip()
    return user_branch if user_branch else (requested_branch or None)


def _resolve_dates(range_str: str, from_date: Optional[str] = None, to_date: Optional[str] = None):
    """Safely resolves date boundaries supporting all_time, daily, weekly, monthly, yearly, custom."""
    r_clean = (range_str or "all_time").lower().strip()
    if r_clean in ("today",):
        r_clean = "daily"
    elif r_clean in ("this_week", "week"):
        r_clean = "weekly"
    elif r_clean in ("this_month", "month"):
        r_clean = "monthly"
    elif r_clean in ("this_year", "year"):
        r_clean = "yearly"
    elif r_clean in ("all", "total"):
        r_clean = "all_time"

    return _get_date_range_with_custom(r_clean, from_date, to_date)


def _compute_previous_period_dates(start_date: Optional[date], end_date: Optional[date], range_str: str):
    """Computes comparison previous period start and end dates."""
    if not start_date or not end_date:
        return None, None
    duration = (end_date - start_date).days + 1
    prev_end = start_date - timedelta(days=1)
    prev_start = prev_end - timedelta(days=duration - 1)
    return prev_start, prev_end


@router.get("/overview")
async def get_invoices_overview(
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    invoice_status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    force_refresh: bool = Query(False),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Returns verified live KPI cards computed from SAP Business One data."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    invoices = await asyncio.to_thread(
        service.get_invoices,
        start_date,
        end_date,
        target_branch,
        customer,
        invoice_status,
        payment_status,
        payment_method,
        force_refresh,
    )

    # Active invoices (exclude cancelled unless explicitly requested)
    is_cancelled_filter = invoice_status and invoice_status.lower() in ("cancelled", "canceled")
    if is_cancelled_filter:
        valid_invoices = invoices
    else:
        valid_invoices = [inv for inv in invoices if not inv.get("cancelled")]

    total_invoices = len(valid_invoices)
    total_sales = round(sum(inv.get("docTotal", 0.0) for inv in valid_invoices), 2)
    total_paid = round(sum(min(inv.get("docTotal", 0.0), inv.get("paidToDate", 0.0)) for inv in valid_invoices), 2)
    total_due = round(sum(inv.get("balanceDue", 0.0) for inv in valid_invoices), 2)
    avg_invoice_value = round(total_sales / total_invoices, 2) if total_invoices > 0 else 0.0

    paid_percentage = round((total_paid / total_sales) * 100, 1) if total_sales > 0 else 0.0
    due_percentage = round((total_due / total_sales) * 100, 1) if total_sales > 0 else 0.0

    # Count breakdown
    paid_count = sum(1 for inv in valid_invoices if inv.get("paymentStatus") == "Paid")
    partially_paid_count = sum(1 for inv in valid_invoices if inv.get("paymentStatus") == "Partially Paid")
    unpaid_count = sum(1 for inv in valid_invoices if inv.get("paymentStatus") == "Unpaid")
    cancelled_count = sum(1 for inv in invoices if inv.get("cancelled"))

    # Optional previous period comparison calculation
    prev_growth: Dict[str, Any] = {}
    prev_start, prev_end = _compute_previous_period_dates(start_date, end_date, range)
    if prev_start and prev_end:
        try:
            prev_invoices = await asyncio.to_thread(
                service.get_invoices,
                prev_start,
                prev_end,
                target_branch,
                customer,
                invoice_status,
                payment_status,
                payment_method,
                False,
            )
            prev_valid = prev_invoices if is_cancelled_filter else [i for i in prev_invoices if not i.get("cancelled")]
            prev_inv_count = len(prev_valid)
            prev_sales = sum(i.get("docTotal", 0.0) for i in prev_valid)
            prev_avg = (prev_sales / prev_inv_count) if prev_inv_count > 0 else 0.0

            if prev_inv_count > 0:
                prev_growth["invoicesPct"] = round(((total_invoices - prev_inv_count) / prev_inv_count) * 100, 1)
            if prev_sales > 0:
                prev_growth["salesPct"] = round(((total_sales - prev_sales) / prev_sales) * 100, 1)
            if prev_avg > 0:
                prev_growth["avgPct"] = round(((avg_invoice_value - prev_avg) / prev_avg) * 100, 1)
        except Exception as e:
            logger.debug(f"Could not compute prev period comparison: {e}")

    return {
        "totalInvoices": total_invoices,
        "totalSales": total_sales,
        "totalPaid": total_paid,
        "totalDue": total_due,
        "avgInvoiceValue": avg_invoice_value,
        "paidPercentage": paid_percentage,
        "duePercentage": due_percentage,
        "counts": {
            "paid": paid_count,
            "partiallyPaid": partially_paid_count,
            "unpaid": unpaid_count,
            "cancelled": cancelled_count,
        },
        "growth": prev_growth,
        "currency": "INR",
        "period": {
            "range": range,
            "startDate": start_date.strftime("%Y-%m-%d") if isinstance(start_date, (date, datetime)) else None,
            "endDate": end_date.strftime("%Y-%m-%d") if isinstance(end_date, (date, datetime)) else None,
        },
        "rules": {
            "totalInvoices": "Count of distinct non-cancelled invoices matching active filters",
            "totalSales": "Sum of DocTotal on non-cancelled invoices",
            "totalPaid": "Sum of verified applied payments (PaidToDate) on invoices",
            "totalDue": "Sum of remaining outstanding balance (DocTotal - PaidToDate) on open invoices",
            "avgInvoiceValue": "Total sales divided by total invoice count",
        },
    }


@router.get("/list")
async def get_invoices_list(
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    invoice_status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("docDate"),
    sort_order: str = Query("desc"),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Returns paginated, searchable, verified invoice rows from SAP."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    invoices = await asyncio.to_thread(
        service.get_invoices,
        start_date,
        end_date,
        target_branch,
        customer,
        invoice_status,
        payment_status,
        payment_method,
    )

    # Search filter
    if search:
        s_low = search.strip().lower()
        filtered = []
        for inv in invoices:
            doc_num_str = str(inv.get("docNum") or "").lower()
            doc_entry_str = str(inv.get("docEntry") or "").lower()
            inv_no_str = str(inv.get("invoiceNo") or "").lower()
            cust_name = str(inv.get("cardName") or "").lower()
            cust_code = str(inv.get("cardCode") or "").lower()
            if (
                s_low in doc_num_str
                or s_low in doc_entry_str
                or s_low in inv_no_str
                or s_low in cust_name
                or s_low in cust_code
            ):
                filtered.append(inv)
        invoices = filtered

    # Sorting
    reverse = sort_order.lower() == "desc"
    if sort_by == "docTotal":
        invoices.sort(key=lambda x: x.get("docTotal", 0.0), reverse=reverse)
    elif sort_by == "cardName":
        invoices.sort(key=lambda x: str(x.get("cardName") or "").lower(), reverse=reverse)
    elif sort_by == "invoiceNo":
        invoices.sort(key=lambda x: str(x.get("docNum") or 0), reverse=reverse)
    else:  # default date desc
        invoices.sort(
            key=lambda x: (str(x.get("docDate") or ""), str(x.get("docTime") or ""), int(x.get("docEntry") or 0)),
            reverse=reverse,
        )

    total = len(invoices)
    paginated = invoices[offset : offset + limit]

    return {
        "total": total,
        "items": paginated,
        "offset": offset,
        "limit": limit,
    }


@router.get("/analytics")
async def get_invoices_analytics(
    range: str = Query("all_time"),
    granularity: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly)$"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    invoice_status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Returns analytics data for charts: time trend, status breakdown, and top customers."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    invoices = await asyncio.to_thread(
        service.get_invoices,
        start_date,
        end_date,
        target_branch,
        customer,
        invoice_status,
        payment_status,
        payment_method,
    )

    valid_invoices = [inv for inv in invoices if not inv.get("cancelled")]

    # 1. Chronological Trend
    trend_map: Dict[str, Dict[str, Any]] = {}

    for inv in valid_invoices:
        raw_date_str = str(inv.get("docDate") or "")[:10]
        if not raw_date_str:
            continue
        try:
            d = datetime.strptime(raw_date_str, "%Y-%m-%d").date()
            if granularity == "yearly":
                label = d.strftime("%Y")
            elif granularity == "monthly":
                label = d.strftime("%Y-%m")
            elif granularity == "weekly":
                wk_start = d - timedelta(days=d.weekday())
                label = wk_start.strftime("%Y-%m-%d")
            else:
                label = raw_date_str

            if label not in trend_map:
                trend_map[label] = {
                    "label": label,
                    "invoicesCount": 0,
                    "totalSales": 0.0,
                    "totalPaid": 0.0,
                    "totalDue": 0.0,
                }

            sales = inv.get("docTotal", 0.0)
            paid = min(sales, inv.get("paidToDate", 0.0))
            due = inv.get("balanceDue", 0.0)

            trend_map[label]["invoicesCount"] += 1
            trend_map[label]["totalSales"] += sales
            trend_map[label]["totalPaid"] += paid
            trend_map[label]["totalDue"] += due
        except Exception:
            pass

    for item in trend_map.values():
        item["totalSales"] = round(item["totalSales"], 2)
        item["totalPaid"] = round(item["totalPaid"], 2)
        item["totalDue"] = round(item["totalDue"], 2)

    trend_list = sorted(trend_map.values(), key=lambda x: x["label"])

    # 2. Payment Status Breakdown
    pay_dist: Dict[str, Dict[str, Any]] = {}
    total_sales_all = sum(inv.get("docTotal", 0.0) for inv in invoices)

    for inv in invoices:
        st = inv.get("paymentStatus") or "Unpaid"
        if st not in pay_dist:
            pay_dist[st] = {"status": st, "count": 0, "total": 0.0}
        pay_dist[st]["count"] += 1
        pay_dist[st]["total"] += inv.get("docTotal", 0.0)

    payment_status_breakdown = []
    for k, v in pay_dist.items():
        v["total"] = round(v["total"], 2)
        v["percentage"] = round((v["total"] / total_sales_all * 100), 1) if total_sales_all > 0 else 0.0
        payment_status_breakdown.append(v)
    payment_status_breakdown.sort(key=lambda x: x["total"], reverse=True)

    # 3. Invoice Status Breakdown
    inv_dist: Dict[str, Dict[str, Any]] = {}
    for inv in invoices:
        st = inv.get("invoiceStatus") or "Open"
        if st not in inv_dist:
            inv_dist[st] = {"status": st, "count": 0, "total": 0.0}
        inv_dist[st]["count"] += 1
        inv_dist[st]["total"] += inv.get("docTotal", 0.0)

    invoice_status_breakdown = []
    for k, v in inv_dist.items():
        v["total"] = round(v["total"], 2)
        v["percentage"] = round((v["total"] / total_sales_all * 100), 1) if total_sales_all > 0 else 0.0
        invoice_status_breakdown.append(v)
    invoice_status_breakdown.sort(key=lambda x: x["total"], reverse=True)

    # 4. Top Customers
    cust_map: Dict[str, Dict[str, Any]] = {}
    for inv in valid_invoices:
        code = inv.get("cardCode") or "UNKNOWN"
        name = inv.get("cardName") or code
        if code not in cust_map:
            cust_map[code] = {
                "cardCode": code,
                "cardName": name,
                "totalSales": 0.0,
                "invoicesCount": 0,
            }
        cust_map[code]["totalSales"] += inv.get("docTotal", 0.0)
        cust_map[code]["invoicesCount"] += 1

    top_customers = sorted(cust_map.values(), key=lambda x: x["totalSales"], reverse=True)[:5]
    for c in top_customers:
        c["totalSales"] = round(c["totalSales"], 2)

    return {
        "trend": trend_list,
        "paymentStatusBreakdown": payment_status_breakdown,
        "invoiceStatusBreakdown": invoice_status_breakdown,
        "topCustomers": top_customers,
    }


@router.get("/detail/{doc_entry}")
async def get_invoice_detail(
    doc_entry: int,
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Retrieves full invoice details with line items from SAP Business One."""
    detail = await asyncio.to_thread(service.get_invoice_detail, doc_entry)
    if not detail:
        raise HTTPException(status_code=404, detail="Invoice not found in SAP")
    return detail


@router.get("/export")
async def export_invoices(
    format: str = Query("csv", pattern="^(csv|json)$"),
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    invoice_status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Exports full filtered dataset of SAP Invoices."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    invoices = await asyncio.to_thread(
        service.get_invoices,
        start_date,
        end_date,
        target_branch,
        customer,
        invoice_status,
        payment_status,
        payment_method,
    )

    if search:
        s_low = search.strip().lower()
        invoices = [
            inv for inv in invoices
            if (
                s_low in str(inv.get("docNum") or "").lower()
                or s_low in str(inv.get("invoiceNo") or "").lower()
                or s_low in str(inv.get("cardName") or "").lower()
                or s_low in str(inv.get("cardCode") or "").lower()
            )
        ]

    if format == "json":
        return invoices

    # CSV Generation
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "#",
        "Invoice No",
        "SAP DocEntry",
        "Date",
        "Time",
        "Customer Code",
        "Customer Name",
        "Total Amount (INR)",
        "Paid To Date (INR)",
        "Balance Due (INR)",
        "Payment Method",
        "Invoice Status",
        "Payment Status",
        "Branch",
    ])

    for idx, inv in enumerate(invoices, start=1):
        writer.writerow([
            idx,
            inv.get("invoiceNo"),
            inv.get("docEntry"),
            inv.get("docDate"),
            inv.get("docTime"),
            inv.get("cardCode"),
            inv.get("cardName"),
            inv.get("docTotal"),
            inv.get("paidToDate"),
            inv.get("balanceDue"),
            inv.get("paymentMethod"),
            inv.get("invoiceStatus"),
            inv.get("paymentStatus"),
            inv.get("branchName"),
        ])

    output.seek(0)
    filename = f"atlas_invoice_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
