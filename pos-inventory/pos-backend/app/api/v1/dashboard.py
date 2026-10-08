"""Dashboard API endpoints – branch-aware daily operations data for operators."""

import asyncio
import csv
import io
import os as _os
import re
from concurrent.futures import ThreadPoolExecutor  # kept for _executor pool
from datetime import date, timedelta
from typing import List, Any, Optional, Tuple, Dict
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Response
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
import logging
from collections import defaultdict

from app.core.cache import cache_get, cache_set, cache_delete, cache_delete_prefix, DASHBOARD_SUMMARY_KEY
from app.core.rate_limiter import limiter
from app.core.security import get_current_user, require_manager_or_admin

# Shared thread pool for blocking SAP calls
_executor = ThreadPoolExecutor(max_workers=min(32, (_os.cpu_count() or 4) * 4))
from app.core.config import settings
from app.models.schemas import (
    DashboardSummary,
    DashboardRecentSale,
    DashboardRecentSalesPage,
    DashboardSaleItem,
    OperatorDashboardData,
    OperatorPaymentSummary,
    OperatorProductSummary,
    OperatorStockItem,
    ReturnedItemSummary,
    ReturnReasonSummary,
    ReturnDetail,
    OperatorPerformanceSummary,
    OperatorQuickAction,
)
from app.services.sap.invoices_service import SAPInvoicesService
from app.core.product_store import product_store
from app.services.sap.business_partners_service import SAPBusinessPartnersService
from app.services.sap.returns_service import SAPReturnsService
from app.api.v1.customers import _compute_customer_insights
from app.api.v1.atlas import _get_permitted_branch
from app.services import approval_service
from app.models.schemas import DashboardAlert


router = APIRouter()
logger = logging.getLogger(__name__)

# Dashboard cache TTL (seconds) – short so totals stay fresh
_DASHBOARD_TTL = 30
_OPERATOR_DASHBOARD_TTL = 45
_LOW_STOCK_THRESHOLD = 10
_DEFAULT_TARGET_AMOUNT = 50000.0
_DEFAULT_TARGET_BILLS = 30


def _line_row_cap(range_str: str) -> int:
    caps = {
        "daily": 10000,
        "weekly": 20000,
        "monthly": 40000,
        "yearly": 60000,
        "all_time": 80000,
    }
    return caps.get(range_str, 20000)


def _normalize_branch(value: Optional[str]) -> str:
    branch = str(value or '').strip().upper()
    if branch:
        return branch
    fallback = str(getattr(settings, 'SAP_DEFAULT_WAREHOUSE', '') or '').strip().upper()
    return fallback or 'UNKNOWN'


def _format_sale_id(branch: str, doc_num: Optional[Any], fallback: str) -> str:
    if doc_num is None:
        return f"SALE-{branch}-{fallback}"

    try:
        numeric = int(doc_num)
        return f"SALE-{branch}-{str(numeric).zfill(6)}"
    except (TypeError, ValueError):
        return f"SALE-{branch}-{str(doc_num)}"

def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _to_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _extract_sale_items(invoice: dict) -> Tuple[List[DashboardSaleItem], float]:
    items: List[DashboardSaleItem] = []
    computed_subtotal = 0.0

    for line in invoice.get("DocumentLines") or []:
        quantity = _to_float(line.get("Quantity"))
        unit_price = _to_float(line.get("UnitPrice") or line.get("Price"))
        line_total = _to_float(line.get("LineTotal"))

        if line_total <= 0 and quantity > 0:
            line_total = unit_price * quantity

        computed_subtotal += line_total
        items.append(
            DashboardSaleItem(
                itemCode=str(line.get("ItemCode") or ""),
                itemName=str(line.get("ItemDescription") or line.get("ItemCode") or "Item"),
                quantity=quantity,
                unitPrice=unit_price,
                lineTotal=line_total,
            )
        )

    return items, computed_subtotal


def _extract_branch_from_invoice(invoice: Dict[str, Any]) -> Optional[str]:
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


def _normalize_method(method: Optional[str]) -> str:
    value = str(method or "unknown").strip().lower()
    return value or "unknown"


def _get_date_range_with_custom(
    range_str: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> Tuple[date, date]:
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


def _get_date_range(range_str: str) -> Tuple[date, date]:
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


def _resolve_branch_for_user(current_user: dict, requested_branch: Optional[str] = None) -> Optional[str]:
    role = str(current_user.get("role") or "user").lower()
    if role == "admin":
        return requested_branch

    user_branch = str(current_user.get("branch_id") or "").strip()
    if user_branch:
        return user_branch

    return settings.SAP_DEFAULT_WAREHOUSE


def _filter_invoices_by_branch(invoices: List[Dict[str, Any]], branch: Optional[str]) -> List[Dict[str, Any]]:
    """Filter invoices to those belonging to a specific warehouse/branch.

    Invoices whose lines carry no WarehouseCode are silently skipped rather than
    raising – prevents analytics from returning 502 when SAP invoices lack
    full line-level warehouse attribution.
    """
    if not branch:
        return invoices

    branch_upper = branch.strip().upper()
    filtered: List[Dict[str, Any]] = []
    for inv in invoices:
        lines = inv.get("DocumentLines") or []
        if not lines:
            logger.debug(
                "Skipping invoice DocEntry=%s: no DocumentLines (branch filter=%s)",
                inv.get("DocEntry"), branch_upper,
            )
            continue
        line_branches = {
            str(line.get("WarehouseCode") or "").strip().upper()
            for line in lines
        }
        line_branches.discard("")
        if not line_branches:
            logger.debug(
                "Skipping invoice DocEntry=%s: lines lack WarehouseCode (branch filter=%s)",
                inv.get("DocEntry"), branch_upper,
            )
            continue
        if branch_upper in line_branches:
            filtered.append(inv)
    return filtered


def _to_date_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value)[:10]


def _extract_base_doc_entries_from_credit_notes(notes: List[Dict[str, Any]]) -> set:
    """Parse credit-note Comments for referenced original invoice DocEntries.

    POS-created credit notes include a comment such as ``Ref original invoice DocEntry: 36``.
    """
    doc_entries: set = set()
    for note in notes:
        comments = str(note.get("Comments") or "")
        for part in comments.split("|"):
            part = part.strip()
            if part.lower().startswith("ref original invoice docentry:"):
                try:
                    val = int(part.split(":", 1)[-1].strip())
                    doc_entries.add(val)
                except (ValueError, IndexError):
                    pass
    return doc_entries


def _build_recent_sales_payload(invoices: List[Dict[str, Any]], limit: int = 8, returned_doc_entries: Optional[set] = None) -> List[DashboardRecentSale]:
    rows: List[DashboardRecentSale] = []
    for inv in invoices[:limit]:
        items, computed_subtotal = _extract_sale_items(inv)
        total = _to_float(inv.get("DocTotal"))
        discount = _to_float(inv.get("TotalDiscount"))
        gst = _to_float(inv.get("VatSum"))
        subtotal = total - gst + discount
        if subtotal <= 0:
            subtotal = computed_subtotal

        branch = _normalize_branch(_extract_branch_from_invoice(inv))
        sale_id = _format_sale_id(branch, inv.get("DocNum"), str(inv.get("DocEntry") or ""))

        doc_entry_val = _to_int(inv.get("DocEntry"))
        has_return = (
            returned_doc_entries is not None
            and doc_entry_val is not None
            and doc_entry_val in returned_doc_entries
        )

        rows.append(
            DashboardRecentSale(
                docEntry=doc_entry_val,
                docNum=_to_int(inv.get("DocNum")),
                saleId=sale_id,
                docDate=_to_date_str(inv.get("DocDate")),
                customerCode=inv.get("CardCode"),
                customerName=inv.get("U_C_Name") or inv.get("CardName"),
                customerPhone=inv.get("U_W_Number"),
                paymentMethod=inv.get("U_P_Method"),
                subtotal=subtotal,
                discount=discount,
                gst=gst,
                total=total,
                items=items,
                hasReturn=has_return,
            )
        )
    return rows


def _matches_sales_search(invoice: Dict[str, Any], search: str, branch: Optional[str]) -> bool:
    if not search:
        return True
    query = search.strip().lower()
    if not query:
        return True

    doc_num = str(invoice.get("DocNum") or "").lower()
    doc_entry = str(invoice.get("DocEntry") or "").lower()
    customer_name = str(invoice.get("U_C_Name") or invoice.get("CardName") or "").lower()
    customer_phone = str(invoice.get("U_W_Number") or "").lower()
    sale_id = _format_sale_id(_normalize_branch(branch), invoice.get("DocNum"), str(invoice.get("DocEntry") or ""))

    return (
        query in sale_id.lower()
        or query in doc_num
        or query in doc_entry
        or query in customer_name
        or query in customer_phone
    )


def _compute_payment_breakdown(invoices: List[Dict[str, Any]]) -> List[OperatorPaymentSummary]:
    grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "billCount": 0})
    for inv in invoices:
        method = _normalize_method(inv.get("U_P_Method"))
        grouped[method]["total"] += _to_float(inv.get("DocTotal"))
        grouped[method]["billCount"] += 1

    rows = [
        OperatorPaymentSummary(method=method, total=round(values["total"], 2), billCount=values["billCount"])
        for method, values in grouped.items()
    ]
    return sorted(rows, key=lambda r: r.total, reverse=True)


def _compute_product_sales(invoices: List[Dict[str, Any]]) -> List[OperatorProductSummary]:
    grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"itemName": "", "quantity": 0, "revenue": 0.0})
    for inv in invoices:
        for line in inv.get("DocumentLines") or []:
            item_code = str(line.get("ItemCode") or "").strip()
            if not item_code:
                continue
            grouped[item_code]["itemName"] = str(line.get("ItemDescription") or item_code)
            grouped[item_code]["quantity"] += int(_to_float(line.get("Quantity")))
            grouped[item_code]["revenue"] += _to_float(line.get("LineTotal"))

    return [
        OperatorProductSummary(
            itemCode=item_code,
            itemName=values["itemName"],
            quantity=int(values["quantity"]),
            revenue=round(values["revenue"], 2),
        )
        for item_code, values in grouped.items()
    ]


def _stock_for_branch(item: Dict[str, Any], branch: Optional[str]) -> float:
    if not branch:
        return _to_float(item.get("QuantityOnStock"))

    branch_upper = branch.upper()
    for wh in item.get("ItemWarehouseInfoCollection") or []:
        if str(wh.get("WarehouseCode") or "").upper() == branch_upper:
            return _to_float(wh.get("InStock"))
    return 0.0


def _build_stock_sections(items: List[Dict[str, Any]], branch: Optional[str]) -> Tuple[List[OperatorStockItem], List[OperatorStockItem], List[OperatorStockItem]]:
    available: List[OperatorStockItem] = []
    low_stock: List[OperatorStockItem] = []
    out_of_stock: List[OperatorStockItem] = []

    for item in items:
        code = str(item.get("ItemCode") or "").strip()
        if not code:
            continue
        in_stock = _stock_for_branch(item, branch)
        row = OperatorStockItem(
            itemCode=code,
            itemName=str(item.get("ItemName") or code),
            inStock=round(in_stock, 2),
        )
        if in_stock <= 0:
            out_of_stock.append(row)
        elif in_stock <= _LOW_STOCK_THRESHOLD:
            low_stock.append(row)
            available.append(row)
        else:
            available.append(row)

    available.sort(key=lambda r: r.itemName.lower())
    low_stock.sort(key=lambda r: r.inStock)
    out_of_stock.sort(key=lambda r: r.itemName.lower())
    return available[:20], low_stock[:10], out_of_stock[:10]


def _normalize_return_reason(note: Dict[str, Any]) -> str:
    for part in str(note.get("Comments") or "").split("|"):
        part = part.strip()
        if part.lower().startswith("return reason:"):
            return part[len("return reason:"):].strip().lower() or "other"
    return "other"


def _fetch_credit_notes(branch: Optional[str], start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
    """
    Fetch credit notes for a date range (header fields only).
    Paginates with $skip to handle ranges that exceed SAP's 100-row Prefer cap.
    No per-note hydration needed.
    """
    if start_date is None:
        start_date = date.today()
    if end_date is None:
        end_date = start_date
    return SAPReturnsService().get_returns_by_date(start_date, end_date, warehouse=branch)


def _fetch_credit_notes_for_day(branch: Optional[str]) -> List[Dict[str, Any]]:
    return _fetch_credit_notes(branch, start_date=date.today(), end_date=date.today())


def _extract_return_type(note: Dict[str, Any]) -> str:
    comments = str(note.get("Comments") or "").lower()
    for part in comments.split("|"):
        part = part.strip()
        if part.startswith("return type:"):
            return part[len("return type:"):].strip().lower() or "refund"
    return "refund"


def _build_return_orders(notes: List[Dict[str, Any]]) -> List[ReturnDetail]:
    orders: List[ReturnDetail] = []
    for note in notes:
        doc_entry = int(note.get("DocEntry") or 0)
        if not doc_entry:
            continue
        comments = str(note.get("Comments") or "")
        reason: Optional[str] = None
        original_doc_num: Optional[int] = None

        for part in comments.split("|"):
            part = part.strip()
            if not reason and part.lower().startswith("return reason:"):
                reason = part[len("return reason:"):].strip() or None
            if original_doc_num is None and part.lower().startswith("original docnum:"):
                try:
                    original_doc_num = int(part.split(":", 1)[-1].strip())
                except (ValueError, IndexError):
                    pass

        orders.append(
            ReturnDetail(
                docEntry=doc_entry,
                docNum=note.get("DocNum"),
                docDate=str(note.get("DocDate") or "")[:10] or None,
                originalDocNum=str(original_doc_num) if original_doc_num is not None else None,
                customerCode=note.get("CardCode"),
                customerName=note.get("CardName"),
                reason=reason,
                returnType=_extract_return_type(note),
                items=[],
                refundAmount=float(note.get("DocTotal") or 0),
                creditNoteDocEntry=doc_entry,
            )
        )

    orders.sort(key=lambda o: (o.docEntry or 0), reverse=True)
    return orders


def _compute_returns_sections(notes: List[Dict[str, Any]]) -> Tuple[int, List[ReturnReasonSummary], List[ReturnedItemSummary]]:
    reason_count: Dict[str, int] = defaultdict(int)
    item_count: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"itemName": "", "quantity": 0.0})

    for note in notes:
        reason_count[_normalize_return_reason(note)] += 1
        for line in note.get("CreditNoteLines") or []:
            item_code = str(line.get("ItemCode") or "").strip()
            if not item_code:
                continue
            item_count[item_code]["itemName"] = str(line.get("ItemDescription") or item_code)
            item_count[item_code]["quantity"] += _to_float(line.get("Quantity"))

    reasons = [ReturnReasonSummary(reason=reason, count=count) for reason, count in reason_count.items()]
    reasons.sort(key=lambda r: r.count, reverse=True)

    returned_items = [
        ReturnedItemSummary(itemCode=code, itemName=data["itemName"], quantity=round(data["quantity"], 2))
        for code, data in item_count.items()
    ]
    returned_items.sort(key=lambda r: r.quantity, reverse=True)

    return len(notes), reasons[:6], returned_items[:10]


def _compute_performance(current_user: dict, invoices: List[Dict[str, Any]]) -> OperatorPerformanceSummary:
    sap_user_code = str(current_user.get("sap_user_code") or "").strip().lower()
    user_filtered = invoices
    if sap_user_code:
        matched = [inv for inv in invoices if str(inv.get("U_S_Employee") or "").strip().lower() == sap_user_code]
        if matched:
            user_filtered = matched

    achieved_amount = round(sum(_to_float(inv.get("DocTotal")) for inv in user_filtered), 2)
    achieved_bills = len(user_filtered)

    target_amount = _to_float(current_user.get("daily_target_amount")) or _DEFAULT_TARGET_AMOUNT
    target_bills = int(current_user.get("daily_target_bills") or _DEFAULT_TARGET_BILLS)

    amount_pct = round((achieved_amount / target_amount) * 100, 2) if target_amount > 0 else 0.0
    bills_pct = round((achieved_bills / target_bills) * 100, 2) if target_bills > 0 else 0.0

    return OperatorPerformanceSummary(
        targetAmount=target_amount,
        achievedAmount=achieved_amount,
        targetBills=target_bills,
        achievedBills=achieved_bills,
        amountAchievementPercent=amount_pct,
        billsAchievementPercent=bills_pct,
    )


@router.get("/summary", response_model=DashboardSummary)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_dashboard_summary(
    request: Request,
    response: Response,
    force_refresh: bool = Query(False, description="Bypass and evict the server-side cache"),
    current_user: dict = Depends(get_current_user),
):
    """
    Today's sales summary (todayTotal + billCount).
    Served from in-memory cache with a 30-second TTL.
    """
    branch = _resolve_branch_for_user(current_user)
    cache_key = f"{DASHBOARD_SUMMARY_KEY}:{branch or 'all'}"

    if force_refresh:
        await cache_delete(cache_key)
        logger.info(f"Dashboard summary cache evicted by force_refresh (key={cache_key!r})")

    # --- Cache hit ---
    cached: dict | None = await cache_get(cache_key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        logger.info("Dashboard cache HIT")
        return DashboardSummary(**cached)

    # --- SAP fetch (run in thread pool so event loop is not blocked) ---
    try:
        invoice_service = SAPInvoicesService()
        loop = asyncio.get_running_loop()
        invoices = await loop.run_in_executor(
            _executor,
            lambda: invoice_service.get_invoices_by_date_with_lines(
                date.today(),
                max_line_rows=_line_row_cap("daily"),
            ),
        )
        invoices = _filter_invoices_by_branch(invoices, branch)
    except Exception as exc:
        logger.error(f"SAP dashboard fetch failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve dashboard data from SAP")

    today_total: float = sum(inv.get("DocTotal", 0.0) for inv in invoices)
    bill_count: int = len(invoices)
    items_sold_count: int = sum(
        int(line.get("Quantity") or 0)
        for inv in invoices
        for line in (inv.get("DocumentLines") or [])
    )

    summary = {"todayTotal": today_total, "billCount": bill_count, "itemsSoldCount": items_sold_count}
    await cache_set(cache_key, summary, ttl=_DASHBOARD_TTL)
    response.headers["X-Cache"] = "MISS"

    logger.info(f"Dashboard: total={today_total}, bills={bill_count} (from SAP)")
    return DashboardSummary(**summary)


async def _customer_search_fallback(search: Optional[str], top: int = 20) -> List[Dict[str, Any]]:
    """Fallback to invoice UDF customer data when SAP Business Partners are unavailable."""
    search_term = (search or "").strip().lower()
    loop = asyncio.get_running_loop()
    try:
        invoice_service = SAPInvoicesService()
        invoices = await loop.run_in_executor(
            _executor,
            lambda: invoice_service.get_recent_invoices_with_lines(limit=250, max_line_rows=5000),
        )
    except Exception as exc:
        logger.error(f"Customer fallback lookup failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not search customers")

    customer_map: Dict[str, Dict[str, Any]] = {}

    for invoice in invoices:
        name = str(invoice.get("U_C_Name") or invoice.get("CardName") or "").strip()
        phone = str(invoice.get("U_W_Number") or "").strip()
        email = str(invoice.get("U_Email") or "").strip() or None
        sales_employee = str(invoice.get("U_S_Employee") or "").strip() or None
        address = str(invoice.get("U_Address") or "").strip() or None
        payment_method = str(invoice.get("U_P_Method") or "").strip() or None

        if not name and not phone:
            continue

        if search_term:
            haystack = " ".join(
                value for value in [name, phone, email or "", sales_employee or "", address or ""] if value
            ).lower()
            if search_term not in haystack:
                continue

        lookup_key = re.sub(r"\D", "", phone).lower() if phone else name.lower()
        if not lookup_key:
            continue

        if lookup_key not in customer_map:
            customer_map[lookup_key] = {
                "cardCode": phone or name or f"CUST-{len(customer_map) + 1}",
                "cardName": name or "Customer",
                "phone": phone or None,
                "email": email,
                "whatsappNumber": phone or None,
                "paymentMethod": payment_method,
                "salesEmployee": sales_employee,
                "address": address,
            }
            continue

        record = customer_map[lookup_key]
        if not record.get("cardName") and name:
            record["cardName"] = name
        if not record.get("phone") and phone:
            record["phone"] = phone
        if not record.get("whatsappNumber") and phone:
            record["whatsappNumber"] = phone
        if not record.get("email") and email:
            record["email"] = email
        if not record.get("salesEmployee") and sales_employee:
            record["salesEmployee"] = sales_employee
        if not record.get("address") and address:
            record["address"] = address
        if not record.get("paymentMethod") and payment_method:
            record["paymentMethod"] = payment_method

    result = list(customer_map.values())[:top]
    for item in result:
        item.setdefault("cardCode", item.get("cardName") or f"CUST-{len(result)}")
    return result


@router.get("/customers")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def search_customers(
    request: Request,
    search: str = Query(None, description="Search term for customer name or code"),
    current_user: dict = Depends(get_current_user),
):
    """Search for customers using SAP Business Partners."""
    try:
        loop = asyncio.get_running_loop()
        bp_service = SAPBusinessPartnersService()
        customers = bp_service.search_customers(search_term=search, top=50)
        
        # Calculate lifetime value
        invoice_service = SAPInvoicesService()
        from datetime import date
        invoices = await loop.run_in_executor(
            _executor, lambda: invoice_service.get_invoices_by_date(date(2000, 1, 1), date(2099, 12, 31))
        )
        from collections import defaultdict
        clv_map = defaultdict(float)
        for inv in invoices:
            code = str(inv.get("CardCode") or "").strip()
            if code:
                clv_map[code] += float(inv.get("DocTotal") or 0)
                
        result = []
        for c in customers:
            code = c.get("CardCode")
            status = "Active"
            if c.get("Valid") == "tYES":
                status = "Active"
            elif c.get("Frozen") == "tYES":
                status = "Frozen"
                
            result.append({
                "cardCode": code,
                "cardName": c.get("CardName"),
                "phone": c.get("Phone1"),
                "email": c.get("EmailAddress"),
                "whatsappNumber": c.get("Cellular"),
                "paymentMethod": None,
                "salesEmployee": None,
                "lifetimeValue": round(clv_map.get(code, 0.0), 2),
                "status": status,
                "cardType": c.get("CardType") or "Retail",
            })
        return result
    except Exception as exc:
        logger.error(f"Customer search via SAP Business Partners failed: {exc}")
        raise HTTPException(status_code=502, detail="SAP customer search unavailable")


@router.get("/recent-sales", response_model=List[DashboardRecentSale])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_recent_sales(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Return the 5 most recent invoices with details for receipt re-printing."""
    try:
        invoice_service = SAPInvoicesService()
        branch = _resolve_branch_for_user(current_user)
        loop = asyncio.get_running_loop()
        recent_headers = await loop.run_in_executor(
            _executor, lambda: invoice_service.get_recent_invoices_with_lines(limit=25, max_line_rows=3000)
        )
    except Exception as exc:
        logger.error(f"Recent sales fetch failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve recent sales from SAP")

    filtered = _filter_invoices_by_branch(recent_headers, branch)
    return _build_recent_sales_payload(filtered, limit=5)


@router.get("/recent-sales-feed", response_model=DashboardRecentSalesPage)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_recent_sales_feed(
    request: Request,
    range: str = Query("daily", pattern="^(daily|weekly|monthly|yearly|all_time|custom)$"),
    date_from: Optional[str] = Query(None, description="Custom start date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="Custom end date YYYY-MM-DD"),
    search: Optional[str] = Query(None, description="Search sale ID, bill number, customer name or phone"),
    customer: Optional[str] = Query(None, description="Filter by customer Name or Code"),
    category: Optional[str] = Query(None, description="Filter by category"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Paginated recent sales feed for the operator dashboard."""
    start_date, end_date = _get_date_range_with_custom(range, date_from, date_to)
    try:
        invoice_service = SAPInvoicesService()
        branch = _resolve_branch_for_user(current_user)
        loop = asyncio.get_running_loop()
        invoices = await loop.run_in_executor(
            _executor,
            lambda: invoice_service.get_invoices_by_date_with_lines(
                start_date,
                end_date,
                max_line_rows=_line_row_cap(range),
            ),
        )
    except Exception as exc:
        logger.error(f"Recent sales feed fetch failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve recent sales feed from SAP")

    filtered = _filter_invoices_by_branch(invoices, branch)
    
    if customer:
        c_low = customer.strip().lower()
        filtered = [inv for inv in filtered if c_low in str(inv.get("CardCode") or "").lower() or c_low in str(inv.get("CardName") or "").lower()]
        
    if payment_method:
        pm_low = payment_method.strip().lower()
        filtered = [inv for inv in filtered if str(inv.get("U_P_Method") or "").strip().lower() == pm_low]
        
    if category:
        cat_low = category.strip().lower()
        cat_filtered = []
        for inv in filtered:
            has_cat = False
            for line in inv.get("DocumentLines") or []:
                if cat_low in str(line.get("ItemCode") or "").lower() or cat_low in str(line.get("ItemDescription") or "").lower():
                    has_cat = True
                    break
            if has_cat:
                cat_filtered.append(inv)
        filtered = cat_filtered

    filtered.sort(key=lambda inv: _to_int(inv.get("DocEntry") or inv.get("DocNum")) or 0, reverse=True)

    if search:
        filtered = [inv for inv in filtered if _matches_sales_search(inv, search, _extract_branch_from_invoice(inv) or branch)]

    # Fetch credit notes for the same period to mark returned sales
    returned_doc_entries: Optional[set] = None
    try:
        credit_notes = await loop.run_in_executor(
            _executor, lambda: _fetch_credit_notes(branch, start_date, end_date)
        )
        returned_doc_entries = _extract_base_doc_entries_from_credit_notes(credit_notes)
    except Exception as exc:
        logger.error("Could not fetch credit notes for returns marking in feed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not retrieve return data from SAP")

    total = len(filtered)
    gross_sales = sum(float(inv.get('DocTotal') or 0) for inv in filtered)
    paid_invoices = sum(1 for inv in filtered if str(inv.get('DocumentStatus')).lower() != 'bost_open')
    pending_invoices = sum(1 for inv in filtered if str(inv.get('DocumentStatus')).lower() == 'bost_open')

    page = filtered[offset: offset + limit]
    items = _build_recent_sales_payload(page, limit=limit, returned_doc_entries=returned_doc_entries)
    next_offset = offset + limit if offset + limit < total else None

    return DashboardRecentSalesPage(items=items, nextOffset=next_offset, total=total, grossSales=gross_sales, paidInvoices=paid_invoices, pendingInvoices=pending_invoices)


@router.get("/operator", response_model=OperatorDashboardData)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_operator_dashboard(
    request: Request,
    range: str = Query("daily", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    branch: Optional[str] = Query(None, description="Branch code for admin override"),
    force_refresh: bool = Query(False, description="Bypass and evict the server-side cache"),
    current_user: dict = Depends(get_current_user),
):
    """Branch-operator focused dashboard payload for POS operations.

    Supports date range filtering (daily/weekly/monthly/yearly/all_time).
    Stock sections are only included for the 'daily' view as they are always
    current and unaffected by historical date ranges.
    """
    effective_branch = _resolve_branch_for_user(current_user, branch)
    user_scope = str(current_user.get("sap_user_code") or current_user.get("sub") or "anonymous").strip().lower()
    cache_key = f"{DASHBOARD_SUMMARY_KEY}:operator:{effective_branch or 'all'}:{user_scope}:{range}"

    if force_refresh:
        await cache_delete(cache_key)
        logger.info(f"Operator dashboard cache evicted by force_refresh (key={cache_key!r})")

    cached_payload: dict | None = await cache_get(cache_key)
    if cached_payload is not None:
        response = OperatorDashboardData(**cached_payload)
        return response

    start_date, end_date = _get_date_range(range)

    try:
        invoice_service = SAPInvoicesService()
        loop = asyncio.get_running_loop()
        period_invoices = await loop.run_in_executor(
            _executor,
            lambda: invoice_service.get_invoices_by_date_with_lines(
                start_date,
                end_date,
                max_line_rows=_line_row_cap(range),
            ),
        )
        branch_invoices = _filter_invoices_by_branch(period_invoices, effective_branch)
    except Exception as exc:
        logger.error(f"Operator dashboard fetch failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve operator dashboard data from SAP")

    # Stock is only relevant for today's view
    product_items: List[Dict[str, Any]] = []
    if range == "daily":
        try:
            cached_items = await product_store.get(effective_branch)
            if cached_items is not None:
                product_items = cached_items
            else:
                logger.info("Operator dashboard stock section skipped: product cache empty for branch=%r", effective_branch)
        except Exception as exc:
            logger.warning("Operator dashboard stock section failed, continuing with empty stock: %s", exc)

    credit_notes: List[Dict[str, Any]] = []
    try:
        loop = asyncio.get_running_loop()
        credit_notes = await loop.run_in_executor(
            _executor, lambda: _fetch_credit_notes(effective_branch, start_date, end_date)
        )
    except Exception as exc:
        logger.error(f"Operator dashboard returns fetch failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve return data from SAP")

    period_total = round(sum(_to_float(inv.get("DocTotal")) for inv in branch_invoices), 2)
    bill_count = len(branch_invoices)
    items_sold_count = sum(
        int(_to_float(line.get("Quantity")))
        for inv in branch_invoices
        for line in (inv.get("DocumentLines") or [])
    )
    avg_bill = round(period_total / bill_count, 2) if bill_count else 0.0

    product_sales = _compute_product_sales(branch_invoices)
    top_selling = sorted(product_sales, key=lambda p: p.quantity, reverse=True)[:8]
    low_selling = sorted(product_sales, key=lambda p: p.quantity)[:8]

    available_stock, low_stock, out_of_stock = _build_stock_sections(product_items, effective_branch)
    returns_count, return_reasons, returned_items = _compute_returns_sections(credit_notes)
    return_orders = _build_return_orders(credit_notes)

    payload = OperatorDashboardData(
        todayTotal=period_total,
        billCount=bill_count,
        averageBillValue=avg_bill,
        itemsSoldCount=items_sold_count,
        paymentBreakdown=_compute_payment_breakdown(branch_invoices),
        recentSales=_build_recent_sales_payload(branch_invoices, limit=8),
        topSellingItems=top_selling,
        lowSellingItems=low_selling,
        availableStock=available_stock,
        lowStockAlerts=low_stock,
        outOfStockItems=out_of_stock,
        returnedItems=returned_items,
        returnsCount=returns_count,
        returnReasons=return_reasons,
        returnOrders=return_orders[:12],
        performance=_compute_performance(current_user, branch_invoices),
        customerInsights=_compute_customer_insights(branch_invoices),
        quickActions=[
            OperatorQuickAction(id="add-sale", label="Add Sale", path="/pos"),
            OperatorQuickAction(id="process-return", label="Process Return", path="/returns"),
            OperatorQuickAction(id="check-stock", label="Check Stock", path="/products"),
        ],
    )

    await cache_set(cache_key, payload.model_dump(), ttl=_OPERATOR_DASHBOARD_TTL)
    return payload


@router.get("/reports/export")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def export_operator_reports(
    request: Request,
    current_user: dict = Depends(get_current_user),
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    report_type: str = Query("sales", pattern="^(sales|invoice|payment)$"),
):
    """
    Download the operator's own branch sales data as a CSV or XLSX file.
    Operators see only their branch; admins may use the admin reports endpoint for cross-branch data.
    Supports preset ranges (daily/weekly/monthly/yearly/all_time) and custom from_date/to_date.
    report_type allows the same child-page layout to be used for sales, invoice, and payment exports.
    """
    branch = _resolve_branch_for_user(current_user)
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
        invoices = _filter_invoices_by_branch(all_invoices, branch)
    except Exception as exc:
        logger.error(f"Operator report export failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not fetch data from SAP")

    sheet_title = {"sales": "My Sales Report", "invoice": "My Invoice Report", "payment": "My Payment Report"}[report_type]
    headers = [
        "DocNum", "Date", "Customer Name", "Mobile", "Payment Method",
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
            inv.get("U_P_Method", ""),
            round(subtotal, 2),
            round(discount, 2),
            round(gst, 2),
            round(doc_total, 2),
        ])

    if format == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        assert sheet is not None
        sheet.title = sheet_title
        sheet.append(headers)
        for row in rows:
            sheet.append(row)

        output = io.BytesIO()
        workbook.save(output)
        output.seek(0)
        filename = f"my_{report_type}_report_{range}_{date.today().isoformat()}.xlsx"
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
    filename = f"my_{report_type}_report_{range}_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/alerts", response_model=List[DashboardAlert])
async def get_alerts(current_user: dict = Depends(get_current_user)):
    """Fetch pending approvals as alerts for authorized users. Branch scoped."""
    target_branch = _get_permitted_branch(current_user, None)
    
    try:
        pending_approvals = approval_service.get_pending_approvals(branch_id=target_branch)
    except Exception as e:
        logger.error(f"Failed to fetch alerts: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch alerts")
        
    alerts = []
    for req in pending_approvals:
        alerts.append(
            DashboardAlert(
                id=req["id"],
                request_type=req["request_type"],
                status=req["status"],
                amount=req["amount"],
                reason=req["reason"],
                branch_id=req["branch_id"],
                created_at=req["created_at"]
            )
        )
    return alerts

from app.models.schemas import InventoryRiskItem
from app.services.sap.inventory_service import SAPInventoryService

@router.get('/inventory-risk', response_model=List[InventoryRiskItem])
async def get_inventory_risk(current_user: dict = Depends(get_current_user)):
    target_branch = _get_permitted_branch(current_user, None)
    
    try:
        service = SAPInventoryService()
        items = service.get_warehouse_stock(target_branch)
        if any(item.get("_truncated") for item in items):
            raise RuntimeError("Inventory risk query exceeded the SAP result limit")
        
        risky_items = []
        for item in items:
            code = item.get('ItemCode', '')
            name = item.get('ItemName', '')
            wh_info = item.get('ItemWarehouseInfoCollection', [])
            
            in_stock = 0.0
            committed = 0.0
            ordered = 0.0
            minimal_stock = 0.0
            
            for wh in wh_info:
                if wh.get('WarehouseCode') == target_branch:
                    in_stock = float(wh.get('InStock', 0.0))
                    committed = float(wh.get('Committed', 0.0))
                    ordered = float(wh.get('Ordered', 0.0))
                    minimal_stock = float(wh.get('MinimalStock', 0.0))
                    break
            
            # Only consider items with an active threshold defined in SAP
            if minimal_stock > 0.0:
                projected_stock = in_stock + ordered - committed
                if projected_stock <= minimal_stock:
                    risky_items.append(
                        InventoryRiskItem(
                            item_code=code,
                            name=name,
                            in_stock=in_stock,
                            committed=committed,
                            ordered=ordered,
                            minimal_stock=minimal_stock,
                            warehouse=target_branch
                        )
                    )
                    
        return risky_items
    except Exception as e:
        logger.error(f'Error fetching inventory risk: {e}')
        raise HTTPException(status_code=502, detail='Could not retrieve complete inventory risk data from SAP')
