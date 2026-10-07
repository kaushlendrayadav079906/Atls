from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class SalesOrderLine(BaseModel):
    line_num: Optional[int] = None
    item_code: Optional[str] = None
    item_description: Optional[str] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    price_after_vat: Optional[float] = None
    line_total: Optional[float] = None
    warehouse_code: Optional[str] = None
    # Report fields
    dispatch_qty: Optional[float] = None
    balance_qty: Optional[float] = None

class SalesOrderListItem(BaseModel):
    doc_entry: Optional[int] = None
    doc_num: Optional[int] = None
    doc_date: Optional[str] = None
    doc_due_date: Optional[str] = None
    card_code: Optional[str] = None
    card_name: Optional[str] = None
    doc_total: Optional[float] = None
    document_status: Optional[str] = None
    cancelled: Optional[str] = None
    sales_person_code: Optional[str] = None
    agent_name: Optional[str] = None
    bpl_id: Optional[int] = None
    comments: Optional[str] = None
    group_num: Optional[int] = None
    payment_group_code: Optional[int] = None
    payment_terms: Optional[str] = None

class SalesOrderDetail(SalesOrderListItem):
    document_lines: List[SalesOrderLine] = Field(default_factory=list)

class SalesOrderSummary(BaseModel):
    total_orders: int = 0
    pending_orders: int = 0
    completed_orders: int = 0
    cancelled_orders: int = 0

class SalesOrderListResponse(BaseModel):
    items: List[SalesOrderListItem]
    total: int
    page: int
    limit: int
    total_pages: int
