from pydantic import BaseModel
from typing import List, Optional

class ProductionOrderSummary(BaseModel):
    production_order_no: int
    item_code: str
    item_name: Optional[str] = None
    production_type: Optional[str] = None
    status: Optional[str] = None
    planned_qty: float
    produced_qty: float
    rejected_qty: float
    pending_qty: float
    production_percentage: float
    rejection_percentage: float
    posting_date: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    warehouse: Optional[str] = None
    priority: Optional[int] = None

class ProductionOrderListResponse(BaseModel):
    items: List[ProductionOrderSummary]
    page: int
    page_size: int
    total: int
    total_pages: int

class ProductionOrderComponent(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    base_qty: float
    planned_qty: float
    issued_qty: float
    pending_qty: float
    warehouse: Optional[str] = None

class ProductionOrderDetail(ProductionOrderSummary):
    creation_date: Optional[str] = None
    project: Optional[str] = None
    components: List[ProductionOrderComponent]

class ProductionSummaryResponse(BaseModel):
    total_production: float
    open_orders: int
    released_orders: int
    completed_orders: int
    cancelled_orders: int
    total_rejection: float
    rejection_percentage: float
    pending_production: float
    production_efficiency: Optional[float] = None

class ProductionItemWiseAggregation(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    planned_qty: float
    produced_qty: float
    pending_qty: float
    rejected_qty: float
    production_percentage: float
    rejection_percentage: float
    warehouse: Optional[str] = None

class ProductionRejectionItem(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    produced_qty: float
    rejected_qty: float
    rejection_percentage: float
    production_percentage: float
    warehouse: Optional[str] = None

class ProductionRejectionAggregation(BaseModel):
    total_rejected_qty: float
    rejection_percentage: float
    items_with_rejection: int
    items: List[ProductionRejectionItem]

class ProductionDateWiseItem(BaseModel):
    date: str
    planned_qty: float
    produced_qty: float
    rejected_qty: float
    pending_qty: float
    production_percentage: float
    rejection_percentage: float

class ProductionStatusDistributionItem(BaseModel):
    status: str
    label: str
    count: int
    percentage: float

class ProductionWarehouseSummaryItem(BaseModel):
    warehouse: str
    planned_qty: float
    produced_qty: float
    rejected_qty: float
    pending_qty: float
    production_percentage: float
