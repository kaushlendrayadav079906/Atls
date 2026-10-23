"""Payments Report API - SAP Business One live payments reporting endpoints."""

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
from app.services.sap.payments_report_service import SAPPaymentsReportService

logger = logging.getLogger(__name__)

router = APIRouter()
service = SAPPaymentsReportService()


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
    # Normalize aliases
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


@router.get("/overview")
async def get_payments_overview(
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Returns verified live KPI cards computed from SAP Business One data."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    # 1. Incoming Payments
    payments = await asyncio.to_thread(
        service.get_payments, start_date, end_date, target_branch, customer, payment_method, payment_status
    )

    # Non-cancelled payments for amount calculations
    valid_payments = [p for p in payments if p.get("_Status") != "Cancelled"]
    total_amount = sum(p.get("_TotalAmount", 0) for p in valid_payments)
    payment_count = len(valid_payments)

    # Distinct paid invoices count - strictly invoices meeting verified paid-in-full criteria
    distinct_paid_invoices: set = set()
    for p in valid_payments:
        for inv in p.get("_LinkedInvoices", []):
            entry = inv.get("docEntry")
            if not entry:
                continue
            status = inv.get("invoiceStatus")
            inv_total = inv.get("invoiceTotal")
            sum_applied = inv.get("sumApplied", 0.0)
            # Paid-in-full criteria: SAP DocumentStatus is bost_Close, or sum applied covers invoice total
            if status == "bost_Close" or (inv_total and inv_total > 0 and sum_applied >= (inv_total - 0.01)):
                distinct_paid_invoices.add(entry)

    # 2. Pending Payments (Open A/R invoices)
    pending_info = await asyncio.to_thread(
        service.get_pending_payments, start_date, end_date, target_branch, customer
    )

    # 3. Refunds Issued (CreditNotes)
    refunds_info = await asyncio.to_thread(
        service.get_refunds, start_date, end_date, target_branch, customer
    )

    avg_payment_value = round(total_amount / payment_count, 2) if payment_count > 0 else 0.0

    return {
        "totalPayments": round(total_amount, 2),
        "paymentCount": payment_count,
        "paidInvoices": len(distinct_paid_invoices),
        "pendingPayments": pending_info.get("total", 0.0),
        "pendingPaymentsCount": pending_info.get("count", 0),
        "refundsIssued": refunds_info.get("total", 0.0),
        "refundsAmount": refunds_info.get("total", 0.0),
        "refundsCount": refunds_info.get("count", 0),
        "averagePaymentValue": avg_payment_value,
        "currency": "INR",
        "period": {
            "range": range,
            "startDate": start_date.strftime("%Y-%m-%d") if isinstance(start_date, (date, datetime)) else None,
            "endDate": end_date.strftime("%Y-%m-%d") if isinstance(end_date, (date, datetime)) else None,
        },
        "rules": {
            "totalPayments": "Sum of non-cancelled incoming payments (Cash + Bank Transfer + Card + Check)",
            "paidInvoices": "Count of distinct sales invoices paid in full (DocumentStatus == 'bost_Close') linked to received payments",
            "pendingPayments": pending_info.get("rule"),
            "refundsIssued": refunds_info.get("rule"),
            "averagePaymentValue": "Total payments divided by non-cancelled payment count",
        },
    }


@router.get("/distribution")
async def get_payments_distribution(
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Groups payments by verified SAP payment method with volume, counts, and percentages."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    payments = await asyncio.to_thread(
        service.get_payments, start_date, end_date, target_branch, customer, payment_method, payment_status, False
    )

    valid_payments = [p for p in payments if p.get("_Status") != "Cancelled"]
    total_volume = sum(p.get("_TotalAmount", 0) for p in valid_payments)

    dist: Dict[str, Dict[str, Any]] = {}
    for p in valid_payments:
        pm = (p.get("_PaymentMethod") or "other").lower()
        if pm not in dist:
            dist[pm] = {"method": pm, "total": 0.0, "count": 0}
        dist[pm]["total"] += p.get("_TotalAmount", 0)
        dist[pm]["count"] += 1

    result = []
    for item in dist.values():
        item["total"] = round(item["total"], 2)
        item["percentage"] = round((item["total"] / total_volume * 100), 1) if total_volume > 0 else 0.0
        result.append(item)

    # Sort descending by volume
    result.sort(key=lambda x: x["total"], reverse=True)
    return result


@router.get("/trend")
async def get_payments_trend(
    granularity: str = Query("daily", pattern="^(daily|weekly|monthly|yearly)$"),
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Calculates time-bucketed financial trend from real SAP payments."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    payments = await asyncio.to_thread(
        service.get_payments, start_date, end_date, target_branch, customer, payment_method, payment_status, False
    )
    valid_payments = [p for p in payments if p.get("_Status") != "Cancelled"]

    trend_map: Dict[str, Dict[str, Any]] = {}

    # Check if we should pre-fill buckets for standard bounded intervals:
    # 1. 'weekly' (7 days of the week)
    # 2. 'monthly' (days of the month)
    # 3. 'yearly' with monthly granularity (12 months of the year)
    # For 'all_time' or multi-year spans: DO NOT plot fabricated zero points to fill space.
    is_bounded_interval = False
    clean_range = (range or "all_time").lower().strip()

    if clean_range in ("this_week", "weekly") and start_date and end_date:
        is_bounded_interval = True
    elif clean_range in ("this_month", "monthly") and start_date and end_date and granularity == "daily":
        is_bounded_interval = True
    elif clean_range in ("this_year", "yearly") and start_date and end_date and granularity == "monthly":
        is_bounded_interval = True
    elif clean_range in ("today", "daily") and start_date and end_date:
        is_bounded_interval = True
    elif clean_range == "custom" and start_date and end_date and (end_date - start_date).days <= 31 and granularity == "daily":
        is_bounded_interval = True

    if is_bounded_interval and start_date and end_date:
        curr_date = start_date
        while curr_date <= end_date:
            if granularity == "monthly":
                label = curr_date.strftime("%Y-%m")
                next_date = (curr_date + relativedelta(months=1)).replace(day=1)
            elif granularity == "yearly":
                label = curr_date.strftime("%Y")
                next_date = (curr_date + relativedelta(years=1)).replace(month=1, day=1)
            else:
                label = curr_date.strftime("%Y-%m-%d")
                next_date = curr_date + timedelta(days=1)

            if label not in trend_map:
                trend_map[label] = {
                    "label": label,
                    "amount": 0.0,
                    "count": 0,
                    "cashAmount": 0.0,
                    "transferAmount": 0.0,
                    "cardAmount": 0.0,
                }
            if next_date <= curr_date:
                break
            curr_date = next_date

    # Aggregate actual verified payments into trend_map
    for p in valid_payments:
        raw_date_str = str(p.get("DocDate") or "")[:10]
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
                    "amount": 0.0,
                    "count": 0,
                    "cashAmount": 0.0,
                    "transferAmount": 0.0,
                    "cardAmount": 0.0,
                }

            amt = p.get("_TotalAmount", 0)
            trend_map[label]["amount"] += amt
            trend_map[label]["count"] += 1
            trend_map[label]["cashAmount"] += p.get("_CashSum", 0)
            trend_map[label]["transferAmount"] += p.get("_TransferSum", 0)
            trend_map[label]["cardAmount"] += p.get("_CardSum", 0)
        except Exception:
            pass

    for v in trend_map.values():
        v["amount"] = round(v["amount"], 2)
        v["cashAmount"] = round(v["cashAmount"], 2)
        v["transferAmount"] = round(v["transferAmount"], 2)
        v["cardAmount"] = round(v["cardAmount"], 2)

    # Ascending chronological sort by date/period label
    return sorted(trend_map.values(), key=lambda x: x["label"])


@router.get("/transactions")
async def get_payments_transactions(
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Returns paginated, searchable, verified payment transaction rows."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    payments = await asyncio.to_thread(
        service.get_payments, start_date, end_date, target_branch, customer, payment_method, payment_status
    )

    if search:
        s_low = search.strip().lower()
        filtered = []
        for p in payments:
            card_code = str(p.get("CardCode") or "").lower()
            card_name = str(p.get("CardName") or "").lower()
            doc_num = str(p.get("DocNum") or "").lower()
            inv_doc_num = str(p.get("_InvoiceDocNum") or "").lower()
            method = str(p.get("_PaymentMethod") or "").lower()
            status = str(p.get("_Status") or "").lower()
            if (
                s_low in card_code
                or s_low in card_name
                or s_low in doc_num
                or s_low in inv_doc_num
                or s_low in method
                or s_low in status
            ):
                filtered.append(p)
        payments = filtered

    total = len(payments)
    paginated = payments[offset : offset + limit]

    items = []
    for p in paginated:
        doc_num = p.get("DocNum")
        items.append({
            "docEntry": p.get("DocEntry"),
            "docNum": doc_num,
            "invoiceDocNum": p.get("_InvoiceDocNum"),
            "invoiceDocEntry": p.get("_InvoiceDocEntry"),
            "invoiceAmount": p.get("_InvoiceAmount"),
            "docDate": p.get("DocDate"),
            "customerCode": p.get("CardCode"),
            "customerName": p.get("CardName"),
            "paymentMethod": p.get("_PaymentMethod"),
            "totalAmount": p.get("_TotalAmount", 0),
            "sumApplied": p.get("_SumApplied", 0),
            "status": p.get("_Status", "Success"),
            "transactionId": f"TXN-{doc_num}" if doc_num else f"SAP-{p.get('DocEntry')}",
            "currency": p.get("_DocCurrency", "INR"),
            "branchName": p.get("BPLName"),
            "branchId": p.get("BPLID"),
            "linkedInvoices": p.get("_LinkedInvoices", []),
        })

    return {"total": total, "items": items, "offset": offset, "limit": limit}


@router.get("/customers")
async def get_customer_payments(
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Customer Payments Tab - Aggregates payment activity by customer."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    payments = await asyncio.to_thread(
        service.get_payments, start_date, end_date, target_branch, customer, payment_method, payment_status
    )
    valid_payments = [p for p in payments if p.get("_Status") != "Cancelled"]

    customer_map: Dict[str, Dict[str, Any]] = {}
    for p in valid_payments:
        code = p.get("CardCode") or "UNKNOWN"
        name = p.get("CardName") or code
        if code not in customer_map:
            customer_map[code] = {
                "customerCode": code,
                "customerName": name,
                "totalAmount": 0.0,
                "paymentCount": 0,
                "methods": {},
                "lastPaymentDate": "",
                "linkedInvoices": set(),
            }

        customer_map[code]["totalAmount"] += p.get("_TotalAmount", 0)
        customer_map[code]["paymentCount"] += 1

        d_str = str(p.get("DocDate") or "")[:10]
        if d_str and d_str > customer_map[code]["lastPaymentDate"]:
            customer_map[code]["lastPaymentDate"] = d_str

        pm = p.get("_PaymentMethod") or "other"
        customer_map[code]["methods"][pm] = customer_map[code]["methods"].get(pm, 0) + 1

        for inv in p.get("_LinkedInvoices", []):
            if inv.get("docNum"):
                customer_map[code]["linkedInvoices"].add(inv.get("docNum"))

    result = []
    for c in customer_map.values():
        preferred = max(c["methods"].items(), key=lambda x: x[1])[0] if c["methods"] else "cash"
        result.append({
            "customerCode": c["customerCode"],
            "customerName": c["customerName"],
            "totalAmount": round(c["totalAmount"], 2),
            "paymentCount": c["paymentCount"],
            "lastPaymentDate": c["lastPaymentDate"],
            "preferredMethod": preferred,
            "linkedInvoicesCount": len(c["linkedInvoices"]),
        })

    result.sort(key=lambda x: x["totalAmount"], reverse=True)
    return result


@router.get("/methods")
async def get_methods_analysis(
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Method Analysis Tab - Comprehensive metrics and comparative totals per method."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    payments = await asyncio.to_thread(
        service.get_payments, start_date, end_date, target_branch, customer, payment_method, payment_status, False
    )
    valid_payments = [p for p in payments if p.get("_Status") != "Cancelled"]
    total_volume = sum(p.get("_TotalAmount", 0) for p in valid_payments)

    method_groups: Dict[str, List[float]] = {}
    for p in valid_payments:
        pm = (p.get("_PaymentMethod") or "other").lower()
        if pm not in method_groups:
            method_groups[pm] = []
        method_groups[pm].append(p.get("_TotalAmount", 0))

    display_names = {
        "cash": "Cash",
        "transfer": "Bank Transfer",
        "card": "Credit/Debit Card",
        "check": "Bank Cheque",
        "upi": "UPI / Digital",
        "other": "Other",
    }

    result = []
    for pm, amounts in method_groups.items():
        count = len(amounts)
        m_tot = sum(amounts)
        avg = m_tot / count if count > 0 else 0.0
        pct = (m_tot / total_volume * 100) if total_volume > 0 else 0.0
        result.append({
            "method": pm,
            "displayName": display_names.get(pm, pm.title()),
            "totalAmount": round(m_tot, 2),
            "transactionCount": count,
            "percentage": round(pct, 1),
            "averageValue": round(avg, 2),
            "minAmount": round(min(amounts), 2) if amounts else 0.0,
            "maxAmount": round(max(amounts), 2) if amounts else 0.0,
        })

    result.sort(key=lambda x: x["totalAmount"], reverse=True)
    return result


@router.get("/detail/{doc_entry}")
async def get_payment_detail(
    doc_entry: int,
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Fetches full SAP IncomingPayment metadata and linked invoice lines for details modal."""
    detail = await asyncio.to_thread(service.get_payment_detail, doc_entry)
    if not detail:
        raise HTTPException(status_code=404, detail="Payment record not found in SAP Business One.")
    return detail


@router.get("/export")
async def export_payments(
    range: str = Query("all_time"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    format: str = Query("csv", pattern="^(csv|json)$"),
    current_user: dict = Depends(require_permission("reports.view")),
):
    """Exports authorized, filtered payment records as CSV or JSON."""
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _resolve_dates(range, from_date, to_date)

    payments = await asyncio.to_thread(
        service.get_payments, start_date, end_date, target_branch, customer, payment_method, payment_status
    )

    if search:
        s_low = search.strip().lower()
        payments = [
            p for p in payments
            if s_low in str(p.get("CardCode") or "").lower()
            or s_low in str(p.get("CardName") or "").lower()
            or s_low in str(p.get("DocNum") or "").lower()
            or s_low in str(p.get("_InvoiceDocNum") or "").lower()
            or s_low in str(p.get("_PaymentMethod") or "").lower()
            or s_low in str(p.get("_Status") or "").lower()
        ]

    if format == "json":
        return payments

    # Stream as CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transaction ID",
        "SAP DocNum",
        "SAP DocEntry",
        "Date",
        "Invoice No",
        "Customer Code",
        "Customer Name",
        "Invoice Amount (INR)",
        "Paid Amount (INR)",
        "Payment Method",
        "Status",
        "Branch",
    ])

    for p in payments:
        writer.writerow([
            f"TXN-{p.get('DocNum')}" if p.get("DocNum") else f"SAP-{p.get('DocEntry')}",
            p.get("DocNum"),
            p.get("DocEntry"),
            str(p.get("DocDate") or "")[:10],
            p.get("_InvoiceDocNum") or "-",
            p.get("CardCode") or "",
            p.get("CardName") or "",
            p.get("_InvoiceAmount") or "",
            p.get("_TotalAmount", 0),
            (p.get("_PaymentMethod") or "").capitalize(),
            p.get("_Status") or "Success",
            p.get("BPLName") or "",
        ])

    output.seek(0)
    filename = f"atlas_payment_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
