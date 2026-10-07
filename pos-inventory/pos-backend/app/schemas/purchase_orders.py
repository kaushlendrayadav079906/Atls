from pydantic import BaseModel, Field
from typing import List, Optional

class PurchaseOrderLine(BaseModel):
    line_num: int = 0
    item_code: str = ""
    item_description: Optional[str] = ""
    quantity: float = 0.0
    price: float = 0.0
    price_after_vat: float = 0.0
    line_total: float = 0.0
    received_quantity: float = 0.0
    open_quantity: float = 0.0
    warehouse_code: Optional[str] = None

class PurchaseOrderListItem(BaseModel):
    doc_entry: int
    doc_num: int
    doc_date: Optional[str] = None
    doc_due_date: Optional[str] = None
    card_code: Optional[str] = None
    card_name: Optional[str] = None
    doc_total: Optional[float] = 0.0
    document_status: Optional[str] = None
    cancelled: Optional[str] = None
    sales_person_code: Optional[str] = None
    bpl_id: Optional[int] = None
    comments: Optional[str] = None

class PurchaseOrderListResponse(BaseModel):
    items: List[PurchaseOrderListItem]
    total: int
    page: int
    limit: int
    total_pages: int

class PurchaseOrderSummary(BaseModel):
    total_orders: int
    pending_orders: int
    received_orders: int
    cancelled_orders: int

class PurchaseOrderDetail(BaseModel):
    doc_entry: int
    doc_num: int
    doc_date: Optional[str] = None
    doc_due_date: Optional[str] = None
    card_code: Optional[str] = None
    card_name: Optional[str] = None
    doc_total: Optional[float] = 0.0
    document_status: Optional[str] = None
    cancelled: Optional[str] = None
    sales_person_code: Optional[str] = None
    bpl_id: Optional[int] = None
    comments: Optional[str] = None
    document_lines: List[PurchaseOrderLine]
