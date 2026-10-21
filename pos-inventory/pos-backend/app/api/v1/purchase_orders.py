import math
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.security import get_current_user, require_permission
from app.schemas.purchase_orders import (
    PurchaseOrderListResponse, 
    PurchaseOrderDetail, 
    PurchaseOrderSummary, 
    PurchaseOrderListItem,
    PurchaseOrderLine
)
from app.services.sap.purchase_orders_service import SAPPurchaseOrdersService
from app.services.sap.client import SAPConnectionError

router = APIRouter()
logger = logging.getLogger(__name__)
_service = SAPPurchaseOrdersService()

def _build_purchase_order_filters(
    current_user: dict,
    branch_id: Optional[int] = None,
    supplier: Optional[str] = None,
    status_filter: Optional[str] = None,
    buyer: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
) -> List[str]:
    filters = []
    
    # 1. Enforce branch isolation based on user context
    user_branch = current_user.get("branch_id")
    user_role = str(current_user.get("role") or "").lower()
    
    if user_branch and user_role not in ("admin", "administrator"):
        if branch_id and branch_id != user_branch:
            raise HTTPException(status_code=403, detail="Unauthorized access to branch")
        target_branch = user_branch
    else:
        target_branch = branch_id

    if target_branch:
        filters.append(f"BPL_IDAssignedToInvoice eq {target_branch}")
        
    # 2. Supplier
    if supplier:
        safe_supplier = supplier.replace("'", "''")
        filters.append(f"CardCode eq '{safe_supplier}'")
        
    # 3. Status
    if status_filter:
        s_low = status_filter.lower()
        if s_low in ("pending", "open", "bost_open"):
            filters.append("DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'")
        elif s_low in ("received", "completed", "closed", "bost_close"):
            filters.append("DocumentStatus eq 'bost_Close' and Cancelled eq 'tNO'")
        elif s_low in ("cancelled", "canceled"):
            filters.append("Cancelled eq 'tYES'")
            
    # 4. Buyer / Sales Person
    if buyer:
        try:
            buyer_code = int(buyer)
            filters.append(f"SalesPersonCode eq {buyer_code}")
        except ValueError:
            pass
            
    # 5. Date Range
    if date_from:
        filters.append(f"DocDate ge '{date_from}'")
    if date_to:
        filters.append(f"DocDate le '{date_to}'")
        
    # 6. Search (DocNum or substring on CardName, CardCode, Comments)
    if search:
        s_clean = search.strip()
        safe_search = s_clean.replace("'", "''")
        if s_clean.isdigit():
            filters.append(f"(DocNum eq {int(s_clean)} or substringof('{safe_search}', CardName) or substringof('{safe_search}', CardCode))")
        else:
            filters.append(f"(substringof('{safe_search}', CardName) or substringof('{safe_search}', CardCode) or substringof('{safe_search}', Comments))")
            
    return filters

@router.get("", response_model=PurchaseOrderListResponse)
def list_purchase_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    supplier: Optional[str] = None,
    buyer: Optional[str] = None,
    branch_id: Optional[int] = None,
    warehouse_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(require_permission("purchase_orders.view"))
):
    try:
        skip = (page - 1) * limit
        filters = _build_purchase_order_filters(
            current_user=current_user,
            branch_id=branch_id,
            supplier=supplier,
            status_filter=status_filter,
            buyer=buyer,
            date_from=date_from,
            date_to=date_to,
            search=search,
        )

        response = _service.list_purchase_orders(
            skip=skip, 
            top=limit, 
            filters=filters,
            warehouse_code=warehouse_code
        )
        
        items = []
        for v in response.get("value", []):
            items.append(PurchaseOrderListItem(
                doc_entry=v.get("DocEntry"),
                doc_num=v.get("DocNum"),
                doc_date=v.get("DocDate"),
                doc_due_date=v.get("DocDueDate"),
                card_code=v.get("CardCode"),
                card_name=v.get("CardName"),
                doc_total=v.get("DocTotal"),
                document_status=v.get("DocumentStatus"),
                cancelled=v.get("Cancelled"),
                sales_person_code=str(v.get("SalesPersonCode")) if v.get("SalesPersonCode") is not None else None,
                bpl_id=v.get("BPL_IDAssignedToInvoice"),
                comments=v.get("Comments")
            ))
            
        total = response.get("odata.count") or response.get("@odata.count") or len(items)
        
        return PurchaseOrderListResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total else 0
        )
    except SAPConnectionError as e:
        logger.error(f"SAP API Error: {e}")
        raise HTTPException(status_code=502, detail="SAP Business One is currently unavailable.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching purchase orders: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/summary", response_model=PurchaseOrderSummary)
def get_purchase_order_summary(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    supplier: Optional[str] = None,
    buyer: Optional[str] = None,
    branch_id: Optional[int] = None,
    warehouse_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(require_permission("purchase_orders.view"))
):
    try:
        filters = _build_purchase_order_filters(
            current_user=current_user,
            branch_id=branch_id,
            supplier=supplier,
            status_filter=status_filter,
            buyer=buyer,
            date_from=date_from,
            date_to=date_to,
            search=search,
        )
            
        summary = _service.get_purchase_order_summary(
            filters=filters,
            warehouse_code=warehouse_code
        )
        return PurchaseOrderSummary(**summary)
    except SAPConnectionError as e:
        logger.error(f"SAP API Error: {e}")
        raise HTTPException(status_code=502, detail="SAP Business One is currently unavailable.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching purchase order summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{doc_entry}", response_model=PurchaseOrderDetail)
def get_purchase_order(
    doc_entry: int,
    current_user: dict = Depends(require_permission("purchase_orders.view"))
):
    try:
        response = _service.get_purchase_order(doc_entry)
        
        user_branch = current_user.get("branch_id")
        user_role = str(current_user.get("role") or "").lower()
        order_branch = response.get("BPL_IDAssignedToInvoice")
        if user_branch and user_role not in ("admin", "administrator") and order_branch and user_branch != order_branch:
            raise HTTPException(status_code=403, detail="Unauthorized access to branch")

        lines = []
        for line in response.get("DocumentLines", []):
            quantity = line.get("Quantity", 0.0)
            open_qty = line.get("RemainingOpenQuantity", 0.0)
            lines.append(PurchaseOrderLine(
                line_num=line.get("LineNum"),
                item_code=line.get("ItemCode"),
                item_description=line.get("ItemDescription"),
                quantity=quantity,
                price=line.get("Price"),
                price_after_vat=line.get("PriceAfterVAT"),
                line_total=line.get("LineTotal"),
                open_quantity=open_qty,
                received_quantity=max(0.0, quantity - open_qty),
                warehouse_code=line.get("WarehouseCode")
            ))
            
        return PurchaseOrderDetail(
            doc_entry=response.get("DocEntry"),
            doc_num=response.get("DocNum"),
            doc_date=response.get("DocDate"),
            doc_due_date=response.get("DocDueDate"),
            card_code=response.get("CardCode"),
            card_name=response.get("CardName"),
            doc_total=response.get("DocTotal"),
            document_status=response.get("DocumentStatus"),
            cancelled=response.get("Cancelled"),
            sales_person_code=str(response.get("SalesPersonCode")) if response.get("SalesPersonCode") is not None else None,
            bpl_id=response.get("BPL_IDAssignedToInvoice"),
            comments=response.get("Comments"),
            document_lines=lines
        )
    except SAPConnectionError as e:
        if "NotFound" in str(e) or getattr(e, "status_code", 500) == 404:
            raise HTTPException(status_code=404, detail="Purchase Order not found")
        logger.error(f"SAP API Error: {e}")
        raise HTTPException(status_code=502, detail="SAP Business One is currently unavailable.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching purchase order detail: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
