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
    CustomerInsightsData, CustomerProfile, CustomerPurchase, CustomerReturn,
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
async def search_customers(
    request: Request,
    search: str = Query(None, description="Search term for customer name or code"),
    top: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """
    Search SAP Business Partners by name or code.
    """
    from app.services.sap.business_partners_service import SAPBusinessPartnersService
    bp_service = SAPBusinessPartnersService()
    loop = asyncio.get_running_loop()
    try:
        results = await loop.run_in_executor(
            _executor, lambda: bp_service.search_customers(search_term=search, top=top)
        )
    except Exception as exc:
        logger.warning("Customer search failed: %s", exc)
        raise HTTPException(status_code=502, detail="SAP customer search unavailable")

    return [
        CustomerSearchResult(
            cardCode=r.get("CardCode"),
            cardName=r.get("CardName"),
            phone=r.get("Phone1"),
            email=r.get("EmailAddress"),
            whatsappNumber=r.get("Cellular"),
            paymentMethod=None,
            salesEmployee=None,
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
    elif "_" in range_str:
        parts = range_str.split("_")
        if len(parts) == 2:
            try:
                start = date.fromisoformat(parts[0])
                end = date.fromisoformat(parts[1])
                return start, end
            except ValueError:
                pass
    return date(2000, 1, 1), today


def _compute_customer_insights(
    invoices: List[Dict[str, Any]],
    limit: int = 10,
) -> CustomerInsightsData:
    """Aggregate customer metrics from AR invoices using BusinessPartner CardCode.
    """
    # cardCode → {name, spend, bills}
    customer_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"name": "", "spend": 0.0, "bills": 0}
    )

    for inv in invoices:
        card_code = str(inv.get("CardCode") or "").strip()
        name = str(inv.get("CardName") or "").strip()
        if not card_code:
            continue
        if name and not customer_stats[card_code]["name"]:
            customer_stats[card_code]["name"] = name
        customer_stats[card_code]["spend"] += float(inv.get("DocTotal") or 0)
        customer_stats[card_code]["bills"] += 1

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
            cardCode=card_code,
            cardName=data["name"] or card_code,
            totalSpend=round(data["spend"], 2),
            billCount=data["bills"],
            averageOrderValue=round(data["spend"] / data["bills"], 2) if data["bills"] else 0.0,
        )
        for card_code, data in ranked
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
    range: str = Query("monthly"),
    branch: Optional[str] = Query(None),
    force_refresh: bool = Query(False, description="Bypass and evict the server-side cache"),
    current_user: dict = {"sub": "test", "role": "admin"},
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
        logger.exception("Customer insights SAP fetch failed")
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
    
    # Fetch total customers from SAP
    try:
        from app.services.sap.business_partners_service import SAPBusinessPartnersService
        bp_service = SAPBusinessPartnersService()
        total_customers = await loop.run_in_executor(
            _executor, lambda: bp_service.get_total_customers_count()
        )
        if total_customers > 0:
            result.totalCustomers = total_customers
        else:
            result.totalCustomers = result.newCustomerCount + result.repeatCustomerCount
    except Exception as exc:
        logger.warning(f"Failed to fetch total customer count: {exc}")
        result.totalCustomers = result.newCustomerCount + result.repeatCustomerCount

    await cache_set(cache_key, result.model_dump(), ttl=_CUSTOMER_INSIGHTS_TTL)
    return result



@router.get("/{card_code}", response_model=CustomerProfile)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_customer_profile(
    request: Request,
    card_code: str,
    current_user: dict = Depends(get_current_user),
):
    """Get full customer profile from SAP."""
    from app.services.sap.business_partners_service import SAPBusinessPartnersService
    from app.services.sap.returns_service import SAPReturnsService
    
    bp_service = SAPBusinessPartnersService()
    invoice_service = SAPInvoicesService()
    returns_service = SAPReturnsService()
    loop = asyncio.get_running_loop()
    
    try:
        bp = await loop.run_in_executor(_executor, lambda: bp_service.get_customer(card_code))
        if not bp:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        from datetime import date
        # Get all invoices for lifetime value & purchase history
        invoices = await loop.run_in_executor(
            _executor, lambda: invoice_service.get_invoices_by_date(date(2000, 1, 1), date(2099, 12, 31))
        )
        customer_invoices = [inv for inv in invoices if str(inv.get("CardCode") or "") == card_code]
        
        # Get all returns
        try:
            returns = await loop.run_in_executor(
                _executor, lambda: returns_service.get_recent_returns(limit=5000)
            )
            customer_returns = [r for r in returns if str(r.get("CardCode") or "") == card_code]
        except Exception:
            customer_returns = []
            
        total_sales = sum(float(inv.get("DocTotal") or 0) for inv in customer_invoices)
        
        last_purchase = None
        if customer_invoices:
            last_inv = sorted(customer_invoices, key=lambda x: str(x.get("DocDate") or ""), reverse=True)[0]
            last_purchase = str(last_inv.get("DocDate") or "")

        branch_counts = defaultdict(int)
        for inv in customer_invoices:
            b = _extract_invoice_branch(inv)
            if b:
                branch_counts[b] += 1
        preferred_branch = max(branch_counts.items(), key=lambda x: x[1])[0] if branch_counts else None

        address = None
        if bp.get("BPAddresses"):
            addresses = bp.get("BPAddresses")
            if addresses:
                addr = addresses[0]
                parts = [addr.get("Street"), addr.get("City"), addr.get("State"), addr.get("Country")]
                address = ", ".join(p for p in parts if p)
                
        status_val = "Active"
        if bp.get("Valid") == "tYES":
            status_val = "Active"
        elif bp.get("Frozen") == "tYES":
            status_val = "Frozen"

        return CustomerProfile(
            cardCode=bp.get("CardCode"),
            cardName=bp.get("CardName") or bp.get("CardCode"),
            cardType=bp.get("CardType") or "Retail",
            phone=bp.get("Phone1"),
            email=bp.get("EmailAddress"),
            whatsappNumber=bp.get("Cellular"),
            address=address,
            status=status_val,
            registeredOn=bp.get("CreateDate"),
            lastPurchase=last_purchase,
            preferredBranch=preferred_branch,
            recentInvoicesCount=len(customer_invoices),
            recentReturnsCount=len(customer_returns),
            lifetimeValue=round(total_sales, 2)
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to fetch customer profile {card_code}: {exc}")
        raise HTTPException(status_code=502, detail="SAP service unavailable")


@router.get("/{card_code}/purchases", response_model=List[CustomerPurchase])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_customer_purchases(
    request: Request,
    card_code: str,
    current_user: dict = Depends(get_current_user),
):
    """Get customer purchase history from SAP."""
    invoice_service = SAPInvoicesService()
    loop = asyncio.get_running_loop()
    
    try:
        from datetime import date
        # Optimally we would filter by CardCode in OData, but the current service doesn't expose it.
        # This is a bit inefficient but works for the current backend capabilities.
        invoices = await loop.run_in_executor(
            _executor, lambda: invoice_service.get_invoices_by_date_with_lines(date(2000, 1, 1), date(2099, 12, 31), max_line_rows=100000)
        )
        
        purchases = []
        for inv in invoices:
            if str(inv.get("CardCode") or "") == card_code:
                lines = inv.get("DocumentLines") or []
                branch = _extract_invoice_branch(inv) or "Unknown"
                purchases.append(CustomerPurchase(
                    docEntry=inv.get("DocEntry"),
                    docNum=inv.get("DocNum"),
                    docDate=str(inv.get("DocDate") or ""),
                    docTotal=float(inv.get("DocTotal") or 0),
                    status=inv.get("DocumentStatus") or "Closed",
                    branch=branch,
                    itemCount=sum(float(l.get("Quantity") or 0) for l in lines)
                ))
                
        purchases.sort(key=lambda x: x.docDate, reverse=True)
        return purchases
    except Exception as exc:
        logger.error(f"Failed to fetch customer purchases {card_code}: {exc}")
        raise HTTPException(status_code=502, detail="SAP service unavailable")


@router.get("/{card_code}/returns", response_model=List[CustomerReturn])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_customer_returns(
    request: Request,
    card_code: str,
    current_user: dict = Depends(get_current_user),
):
    """Get customer returns history from SAP."""
    from app.services.sap.returns_service import SAPReturnsService
    returns_service = SAPReturnsService()
    loop = asyncio.get_running_loop()
    
    try:
        returns = await loop.run_in_executor(
            _executor, lambda: returns_service.get_recent_returns(limit=5000)
        )
        
        customer_returns = []
        for r in returns:
            if str(r.get("CardCode") or "") == card_code:
                lines = r.get("DocumentLines") or []
                branch = str(r.get("BPLName") or "Unknown")
                customer_returns.append(CustomerReturn(
                    docEntry=r.get("DocEntry"),
                    docNum=r.get("DocNum"),
                    docDate=str(r.get("DocDate") or ""),
                    docTotal=float(r.get("DocTotal") or 0),
                    status=r.get("DocumentStatus") or "Closed",
                    branch=branch,
                    itemCount=sum(float(l.get("Quantity") or 0) for l in lines)
                ))
                
        customer_returns.sort(key=lambda x: x.docDate, reverse=True)
        return customer_returns
    except Exception as exc:
        logger.error(f"Failed to fetch customer returns {card_code}: {exc}")
        raise HTTPException(status_code=502, detail="SAP service unavailable")

