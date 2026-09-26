"""Customers API – mobile-number search and customer insights."""

import asyncio
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from typing import List, Optional, Dict, Any

import os as _os
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.cache import cache_get, cache_set, cache_delete
from app.core.rate_limiter import limiter
from app.core.security import get_current_user
from app.core.config import settings

# Cache TTLs for analytics endpoints (they're expensive SAP calls)
_CUSTOMER_INSIGHTS_TTL = 300   # 5 minutes
from app.models.schemas import (
    CustomerSearchResult,
    CustomerInsightsData,
    TopCustomer,
)
from app.services.sap.invoices_service import SAPInvoicesService

router = APIRouter()
logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=min(32, (_os.cpu_count() or 4) * 4))

# ──────────────────────────────────────────────────────────────────────────────
# Mobile-number customer search
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/search", response_model=List[CustomerSearchResult])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def search_customers_by_mobile(
    request: Request,
    mobile: str = Query(..., min_length=4, max_length=20, description="4–20 digit fragment of mobile number"),
    top: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """
    Return customer suggestions from past invoices whose U_W_Number (mobile/WhatsApp)
    contains the given digit fragment. Minimum 4 digits required.

    Customers in this POS system are stored as UDF fields on AR Invoices —
    there are no individual Business Partner records per customer.
    """
    svc = SAPInvoicesService()
    loop = asyncio.get_running_loop()
    try:
        results = await loop.run_in_executor(
            _executor, lambda: svc.search_by_mobile(mobile, top=top)
        )
    except Exception as exc:
        logger.warning("Customer mobile search failed: %s", exc)
        raise HTTPException(status_code=502, detail="SAP customer search unavailable")

    return [
        CustomerSearchResult(
            name=r.get("name", ""),
            mobile=r.get("mobile", ""),
            email=r.get("email"),
            salesEmployee=r.get("salesEmployee"),
            address=r.get("address"),
            invoiceCount=r.get("invoiceCount"),
            latestDocNum=r.get("latestDocNum"),
            invoiceNums=r.get("invoiceNums"),
        )
        for r in results
    ]


# ──────────────────────────────────────────────────────────────────────────────
# Customer Insights
# ──────────────────────────────────────────────────────────────────────────────

def _get_date_range(range_str: str):
    today = date.today()
    if range_str == "daily":
        return today, today
    elif range_str == "weekly":
        return today - timedelta(days=6), today
    elif range_str == "monthly":
        return today.replace(day=1), today
    elif range_str == "yearly":
        return today.replace(month=1, day=1), today
    else:
        return date(2000, 1, 1), today


def _compute_customer_insights(
    invoices: List[Dict[str, Any]],
    limit: int = 10,
) -> CustomerInsightsData:
    """Aggregate customer metrics from AR invoices using UDF fields.

    Customers are identified by U_W_Number (mobile/WhatsApp). Invoices without
    a mobile number are counted as anonymous and excluded from per-customer stats
    but still contribute to totals.
    """
    # mobile → {name, spend, bills}
    customer_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"name": "", "spend": 0.0, "bills": 0}
    )

    for inv in invoices:
        mobile = str(inv.get("U_W_Number") or "").strip()
        name = str(inv.get("U_C_Name") or "").strip()
        if not mobile:
            continue  # skip anonymous (no mobile on record)
        if name and not customer_stats[mobile]["name"]:
            customer_stats[mobile]["name"] = name
        customer_stats[mobile]["spend"] += float(inv.get("DocTotal") or 0)
        customer_stats[mobile]["bills"] += 1

    total_customers = len(customer_stats)
    repeat_count = sum(1 for s in customer_stats.values() if s["bills"] > 1)
    new_count = total_customers - repeat_count
    repeat_rate = round((repeat_count / total_customers) * 100, 2) if total_customers else 0.0
    total_clv = round(sum(s["spend"] for s in customer_stats.values()), 2)

    ranked = sorted(
        customer_stats.items(), key=lambda x: x[1]["spend"], reverse=True
    )[:limit]

    top_customers = [
        TopCustomer(
            cardCode=mobile,
            cardName=data["name"] or mobile,
            totalSpend=round(data["spend"], 2),
            billCount=data["bills"],
            averageOrderValue=round(data["spend"] / data["bills"], 2) if data["bills"] else 0.0,
        )
        for mobile, data in ranked
    ]

    return CustomerInsightsData(
        topCustomers=top_customers,
        repeatCustomerCount=repeat_count,
        newCustomerCount=new_count,
        repeatRate=repeat_rate,
        totalCLV=total_clv,
    )


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


@router.get("/insights", response_model=CustomerInsightsData)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_customer_insights(
    request: Request,
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    branch: Optional[str] = Query(None),
    force_refresh: bool = Query(False, description="Bypass and evict the server-side cache"),
    current_user: dict = Depends(get_current_user),
):
    """Customer purchase insights: top customers, repeat vs new, CLV."""
    role = str(current_user.get("role") or "user").lower()
    if role != "admin":
        branch = str(current_user.get("branch_id") or "").strip() or settings.SAP_DEFAULT_WAREHOUSE

    cache_key = f"pos:customer-insights:{range}:{branch or 'all'}"

    if force_refresh:
        await cache_delete(cache_key)
        logger.info(f"Customer insights cache evicted by force_refresh (key={cache_key!r})")

    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    start_date, end_date = _get_date_range(range)
    svc = SAPInvoicesService()
    loop = asyncio.get_running_loop()

    try:
        if branch:
            invoices = await loop.run_in_executor(
                _executor,
                lambda: svc.get_invoices_by_date_with_lines(
                    start_date,
                    end_date,
                    max_line_rows=30000,
                ),
            )
        else:
            invoices = await loop.run_in_executor(
                _executor, lambda: svc.get_invoices_by_date(start_date, end_date)
            )
    except Exception as exc:
        logger.warning("Customer insights SAP fetch failed: %s", exc)
        raise HTTPException(status_code=503, detail="SAP service unavailable: customer insights could not be loaded")

    if branch:
        branch_upper = branch.upper()
        filtered: List[Dict[str, Any]] = []
        for inv in invoices:
            header_branch = _extract_invoice_branch(inv)
            if header_branch and header_branch.upper() == branch_upper:
                filtered.append(inv)
                continue
            if any(
                str(ln.get("WarehouseCode") or "").upper() == branch_upper
                for ln in (inv.get("DocumentLines") or [])
            ):
                filtered.append(inv)
                continue
            if not header_branch and not (inv.get("DocumentLines") or []):
                filtered.append(inv)
        invoices = filtered

    result = _compute_customer_insights(invoices)
    await cache_set(cache_key, result.model_dump(), ttl=_CUSTOMER_INSIGHTS_TTL)
    return result


