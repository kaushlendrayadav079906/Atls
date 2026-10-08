from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
import logging

from app.core.security import get_current_user
from app.api.v1.atlas import _get_permitted_branch
from app.schemas.production import (
    ProductionSummaryResponse,
    ProductionOrderListResponse,
    ProductionOrderDetail,
    ProductionItemWiseAggregation,
    ProductionRejectionAggregation,
    ProductionDateWiseItem,
    ProductionStatusDistributionItem,
    ProductionWarehouseSummaryItem
)
from app.services.sap.production_service import SAPProductionService

router = APIRouter()
logger = logging.getLogger(__name__)

def get_production_service() -> SAPProductionService:
    return SAPProductionService()

@router.get("/summary", response_model=ProductionSummaryResponse)
def get_production_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    warehouse: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: SAPProductionService = Depends(get_production_service)
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from cannot be after date_to")
        
    permitted_warehouse = _get_permitted_branch(current_user, warehouse)
    
    try:
        return service.get_production_summary(warehouse=permitted_warehouse, date_from=date_from, date_to=date_to)
    except Exception as e:
        logger.error(f"Error fetching production summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch production summary from SAP")

@router.get("/orders", response_model=ProductionOrderListResponse)
def get_production_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    item_code: Optional[str] = None,
    warehouse: Optional[str] = None,
    production_type: Optional[str] = None,
    priority: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: SAPProductionService = Depends(get_production_service)
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from cannot be after date_to")
        
    permitted_warehouse = _get_permitted_branch(current_user, warehouse)
    skip = (page - 1) * page_size
    
    try:
        items, total = service.get_production_orders(
            skip=skip, top=page_size, search=search, status=status,
            item_code=item_code, warehouse=permitted_warehouse,
            production_type=production_type, priority=priority,
            date_from=date_from, date_to=date_to
        )
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages
        }
    except Exception as e:
        logger.error(f"Error fetching production orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch production orders from SAP")

@router.get("/orders/{production_order_no}", response_model=ProductionOrderDetail)
def get_production_order_detail(
    production_order_no: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: SAPProductionService = Depends(get_production_service)
):
    try:
        detail = service.get_production_order(production_order_no)
        if not detail:
            raise HTTPException(status_code=404, detail="Production order not found")
            
        # Security check: if the user has a restricted branch, ensure this order belongs to it
        permitted_warehouse = _get_permitted_branch(current_user, None)
        if permitted_warehouse and detail.get("warehouse") != permitted_warehouse:
            raise HTTPException(status_code=403, detail="Not authorized to view this order")
            
        return detail
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching production order {production_order_no}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch production order detail from SAP")

@router.get("/item-wise", response_model=List[ProductionItemWiseAggregation])
def get_item_wise_production(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    warehouse: Optional[str] = None,
    search: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: SAPProductionService = Depends(get_production_service)
):
    permitted_warehouse = _get_permitted_branch(current_user, warehouse)
    try:
        return service.get_item_wise_production(
            date_from=date_from, date_to=date_to,
            warehouse=permitted_warehouse, search=search
        )
    except Exception as e:
        logger.error(f"Error fetching item-wise production: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch item-wise production from SAP")

@router.get("/rejection", response_model=ProductionRejectionAggregation)
def get_production_rejection(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    warehouse: Optional[str] = None,
    search: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: SAPProductionService = Depends(get_production_service)
):
    permitted_warehouse = _get_permitted_branch(current_user, warehouse)
    try:
        return service.get_rejection_summary(
            date_from=date_from, date_to=date_to,
            warehouse=permitted_warehouse, search=search
        )
    except Exception as e:
        logger.error(f"Error fetching production rejection: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch production rejection from SAP")

@router.get("/date-wise", response_model=List[ProductionDateWiseItem])
def get_date_wise_production(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    warehouse: Optional[str] = None,
    granularity: str = Query("daily", regex="^(daily|weekly|monthly|yearly)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: SAPProductionService = Depends(get_production_service)
):
    permitted_warehouse = _get_permitted_branch(current_user, warehouse)
    try:
        return service.get_date_wise_production(
            date_from=date_from, date_to=date_to,
            warehouse=permitted_warehouse, granularity=granularity
        )
    except Exception as e:
        logger.error(f"Error fetching date-wise production: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch date-wise production from SAP")

@router.get("/status-distribution", response_model=List[ProductionStatusDistributionItem])
def get_status_distribution(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    warehouse: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: SAPProductionService = Depends(get_production_service)
):
    permitted_warehouse = _get_permitted_branch(current_user, warehouse)
    try:
        return service.get_status_distribution(
            date_from=date_from, date_to=date_to, warehouse=permitted_warehouse
        )
    except Exception as e:
        logger.error(f"Error fetching status distribution: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch status distribution from SAP")

@router.get("/warehouses", response_model=List[ProductionWarehouseSummaryItem])
def get_warehouse_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    warehouse: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: SAPProductionService = Depends(get_production_service)
):
    permitted_warehouse = _get_permitted_branch(current_user, warehouse)
    try:
        return service.get_warehouse_summary(
            date_from=date_from, date_to=date_to, warehouse=permitted_warehouse
        )
    except Exception as e:
        logger.error(f"Error fetching warehouse summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch warehouse summary from SAP")
