"""Atlas Analytics Dashboard API - Read-only analytics for Managers and Administrators."""

import asyncio
import logging
import os as _os
from datetime import date, datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.security import require_manager_or_admin
from app.core.cache import cache_get, cache_set
from app.models.schemas import (
    AtlasOverview,
    AtlasSalesTrend,
    AtlasInventorySummary,
    AtlasInventoryItem,
    AtlasBranchComparison,
    AtlasReturnsSummary,
    AtlasTopCustomer,
    AtlasProductVelocity,
)
from app.services.sap.invoices_service import SAPInvoicesService
from app.services.sap.inventory_service import SAPInventoryService
from app.api.v1.admin import (
    _get_date_range,
    _get_date_range_with_custom,
    _filter_invoices_by_branch,
    _compute_payment_split,
    _compute_trend,
    _compute_branch_breakdown,
    _fetch_credit_notes_for_range,
)
from app.services.sap.warehouses_service import SAPWarehousesService
from app.services import approval_service

router = APIRouter()
logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=min(32, (_os.cpu_count() or 4) * 4))
_ATLAS_CACHE_TTL = 300  # 5 minutes for analytics data


def _get_permitted_branch(user: dict, requested_branch: Optional[str] = None) -> Optional[str]:
    """
    Enforce branch access.
    Admins can see all (None) or filter by a specific branch.
    Managers can ONLY see their assigned branch, overriding any request.
    """
    if user.get("role") == "admin":
        return requested_branch or settings.SAP_DEFAULT_WAREHOUSE
    
    manager_branch = user.get("branch_id")
    if not manager_branch:
        raise HTTPException(status_code=403, detail="Manager has no assigned branch for analytics.")
    
    # Manager is forced to use their assigned branch
    return manager_branch


@router.get("/overview", response_model=AtlasOverview)
async def get_overview(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Filter by SAP WarehouseCode"),
    current_user: dict = Depends(require_manager_or_admin),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    cache_key = f"pos:atlas:overview:{range}:{start_date}:{end_date}:{target_branch or 'all'}"
    cached = await cache_get(cache_key)
    if cached:
        return AtlasOverview(**cached)

    try:
        loop = asyncio.get_running_loop()
        invoices = await loop.run_in_executor(
            _executor, lambda: SAPInvoicesService().get_invoices_by_date(start_date, end_date)
        )
        invoices = _filter_invoices_by_branch(invoices, target_branch)
    except Exception as e:
        logger.error(f"Atlas overview fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve sales data from SAP")

    total_sales = sum(float(inv.get("DocTotal") or 0) for inv in invoices)
    invoice_count = len(invoices)
    aov = round(total_sales / invoice_count, 2) if invoice_count else 0.0
    payment_split = _compute_payment_split(invoices)

    result = AtlasOverview(
        totalSales=round(total_sales, 2),
        invoiceCount=invoice_count,
        averageOrderValue=aov,
        paymentBreakdown=payment_split,
    )
    await cache_set(cache_key, result.model_dump(), ttl=_ATLAS_CACHE_TTL)
    return result


@router.get("/sales-trends", response_model=AtlasSalesTrend)
async def get_sales_trends(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Filter by SAP WarehouseCode"),
    current_user: dict = Depends(require_manager_or_admin),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    try:
        loop = asyncio.get_running_loop()
        invoices = await loop.run_in_executor(
            _executor, lambda: SAPInvoicesService().get_invoices_by_date(start_date, end_date)
        )
        invoices = _filter_invoices_by_branch(invoices, target_branch)
    except Exception as e:
        logger.error(f"Atlas trend fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve trend data from SAP")

    trend = _compute_trend(invoices, range)
    return AtlasSalesTrend(trend=trend)


@router.get("/inventory-summary", response_model=AtlasInventorySummary)
async def get_inventory_summary(
    branch: Optional[str] = Query(None, description="Filter by SAP WarehouseCode"),
    current_user: dict = Depends(require_manager_or_admin),
):
    target_branch = _get_permitted_branch(current_user, branch)
    if not target_branch:
        # Prevent massive global queries if no branch is specified, or limit it.
        # Since the inventory service usually fetches items by branch, we require a branch or default to the user's branch if manager.
        # If admin doesn't provide a branch, we might refuse or just fetch from a default branch.
        raise HTTPException(status_code=400, detail="Branch must be provided for inventory snapshot.")

    try:
        loop = asyncio.get_running_loop()
        items = await loop.run_in_executor(
            _executor, lambda: SAPInventoryService().get_items(warehouse=target_branch)
        )
    except Exception as e:
        logger.error(f"Atlas inventory fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve inventory from SAP")

    snapshot_items = [
        AtlasInventoryItem(
            itemCode=item.get("ItemCode", ""),
            itemName=item.get("ItemName", ""),
            inStock=float(item.get("QuantityOnStock", 0.0)),
            warehouse=target_branch,
        )
        for item in items
    ]

    return AtlasInventorySummary(
        snapshotTime=datetime.utcnow().isoformat(),
        items=snapshot_items,
    )


@router.get("/branch-comparison", response_model=AtlasBranchComparison)
async def get_branch_comparison(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    current_user: dict = Depends(require_manager_or_admin),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Branch comparison is restricted to administrators.")

    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    try:
        loop = asyncio.get_running_loop()
        invoices = await loop.run_in_executor(
            _executor, lambda: SAPInvoicesService().get_invoices_by_date(start_date, end_date)
        )
        warehouses = await loop.run_in_executor(
            _executor, SAPWarehousesService().get_warehouses
        )
    except Exception as e:
        logger.error(f"Atlas branch comparison fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve data from SAP")

    warehouse_names = {
        str(w.get("WarehouseCode") or ""): str(w.get("WarehouseName") or w.get("WarehouseCode") or "")
        for w in warehouses
        if w.get("WarehouseCode")
    }

    branch_breakdown = _compute_branch_breakdown(invoices, warehouse_names)
    return AtlasBranchComparison(branches=branch_breakdown)


@router.get("/returns-summary", response_model=AtlasReturnsSummary)
async def get_returns_summary(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Filter by SAP WarehouseCode"),
    current_user: dict = Depends(require_manager_or_admin),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)

    try:
        loop = asyncio.get_running_loop()
        credit_notes = await loop.run_in_executor(
            _executor, lambda: _fetch_credit_notes_for_range(target_branch, start_date, end_date)
        )
    except Exception as e:
        logger.error(f"Atlas returns fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve credit notes from SAP")

    total_cn_amount = sum(float(cn.get("DocTotal") or 0) for cn in credit_notes)
    
    all_pending = approval_service.get_pending_approvals()
    if target_branch:
        pending_count = sum(1 for req in all_pending if req.get("branch_id") == target_branch)
    else:
        pending_count = len(all_pending)

    return AtlasReturnsSummary(
        pendingApprovalsCount=pending_count,
        sapCreditNotesCount=len(credit_notes),
        sapCreditNotesTotal=round(total_cn_amount, 2),
    )

from collections import defaultdict

@router.get("/top-customers", response_model=List[AtlasTopCustomer])
async def get_top_customers(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Filter by SAP WarehouseCode"),
    limit: int = Query(5, ge=1, le=50),
    current_user: dict = Depends(require_manager_or_admin),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    try:
        loop = asyncio.get_running_loop()
        invoices = await loop.run_in_executor(
            _executor, lambda: SAPInvoicesService().get_invoices_by_date(start_date, end_date)
        )
        invoices = _filter_invoices_by_branch(invoices, target_branch)
    except Exception as e:
        logger.error(f"Atlas top customers fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve sales data from SAP")

    grouped = defaultdict(lambda: {"total": 0.0, "count": 0})
    for inv in invoices:
        if inv.get("Cancelled") == "tYES":
            continue
        
        card_code = str(inv.get("CardCode") or "UNKNOWN").strip()
        card_name = str(inv.get("CardName") or card_code).strip()
        
        grouped[(card_code, card_name)]["total"] += float(inv.get("DocTotal") or 0)
        grouped[(card_code, card_name)]["count"] += 1
        
    results = [
        AtlasTopCustomer(
            customerCode=k[0],
            customerName=k[1],
            totalSales=round(v["total"], 2),
            invoiceCount=v["count"],
        )
        for k, v in grouped.items()
    ]
    results.sort(key=lambda x: x.totalSales, reverse=True)
    return results[:limit]


@router.get("/product-velocity", response_model=List[AtlasProductVelocity])
async def get_product_velocity(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Filter by SAP WarehouseCode"),
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(require_manager_or_admin),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    try:
        loop = asyncio.get_running_loop()
        invoices = await loop.run_in_executor(
            _executor, lambda: SAPInvoicesService().get_invoices_by_date_with_lines(
                start_date, end_date, max_line_rows=20000, page_size=1000
            )
        )
        invoices = _filter_invoices_by_branch(invoices, target_branch)
    except Exception as e:
        logger.error(f"Atlas product velocity fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve invoice lines from SAP")

    grouped = defaultdict(lambda: {"qty": 0.0, "amount": 0.0})
    for inv in invoices:
        if inv.get("Cancelled") == "tYES":
            continue
            
        for line in inv.get("DocumentLines") or []:
            item_code = str(line.get("ItemCode") or "UNKNOWN").strip()
            item_name = str(line.get("ItemDescription") or item_code).strip()
            qty = float(line.get("Quantity") or 0)
            amount = float(line.get("LineTotal") or 0)
            
            grouped[(item_code, item_name)]["qty"] += qty
            grouped[(item_code, item_name)]["amount"] += amount

    results = [
        AtlasProductVelocity(
            itemCode=k[0],
            itemName=k[1],
            quantitySold=round(v["qty"], 2),
            salesAmount=round(v["amount"], 2),
        )
        for k, v in grouped.items()
    ]
    results.sort(key=lambda x: x.quantitySold, reverse=True)
    return results[:limit]
