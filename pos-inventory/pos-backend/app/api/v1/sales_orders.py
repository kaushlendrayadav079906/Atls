import math
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from app.core.security import get_current_user
from app.schemas.sales_orders import (
    SalesOrderListResponse, 
    SalesOrderDetail, 
    SalesOrderSummary, 
    SalesOrderListItem,
    SalesOrderLine
)
from app.services.sap.sales_orders_service import SAPSalesOrdersService
from app.services.sap.client import SAPConnectionError, SAPValidationError

router = APIRouter()
logger = logging.getLogger(__name__)
_service = SAPSalesOrdersService()

_agent_cache = {}
_payment_terms_cache = {}

def _get_agent_name(code: str) -> str:
    if not code or code == "-1": return "No Agent"
    if code in _agent_cache: return _agent_cache[code]
    try:
        res = _service.client.get(f"/SalesPersons({code})?$select=SalesEmployeeName")
        name = res.get("SalesEmployeeName")
        _agent_cache[code] = name
        return name or code
    except:
        return code

def _get_payment_terms(code: int) -> str:
    if code is None: return "N/A"
    if code in _payment_terms_cache: return _payment_terms_cache[code]
    try:
        res = _service.client.get(f"/PaymentTermsTypes({code})?$select=PaymentTermsGroupName")
        name = res.get("PaymentTermsGroupName")
        _payment_terms_cache[code] = name
        return name or str(code)
    except:
        return str(code)

@router.get("", response_model=SalesOrderListResponse)
def list_sales_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    customer: Optional[str] = None,
    sales_employee: Optional[str] = None,
    branch_id: Optional[int] = None,
    warehouse_code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        skip = (page - 1) * limit
        filters = []
        
        # Enforce branch isolation based on user context
        user_branch = current_user.get("branch_id")
        if branch_id and user_branch and branch_id != user_branch:
            # We assume branch isolation means user can only see their branch
            raise HTTPException(status_code=403, detail="Unauthorized access to branch")
            
        target_branch = branch_id or user_branch
        if target_branch:
            filters.append(f"BPL_IDAssignedToInvoice eq {target_branch}")
            
        if search:
            # SAP OData basic string matching
            # Note: actual substringof/contains depends on SAP version. We use basic filtering.
            safe_search = search.replace("'", "''")
            filters.append(f"(substringof('{safe_search}', CardName) or substringof('{safe_search}', CardCode))")
            
        if customer:
            safe_customer = customer.replace("'", "''")
            filters.append(f"CardCode eq '{safe_customer}'")
            
        if status_filter:
            if status_filter.lower() == "pending":
                filters.append("DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'")
            elif status_filter.lower() == "completed":
                filters.append("DocumentStatus eq 'bost_Close' and Cancelled eq 'tNO'")
            elif status_filter.lower() == "cancelled":
                filters.append("Cancelled eq 'tYES'")
                
        if sales_employee:
            filters.append(f"SalesPersonCode eq {sales_employee}")
            
        if date_from:
            filters.append(f"DocDate ge '{date_from}'")
        if date_to:
            filters.append(f"DocDate le '{date_to}'")
            
        # For warehouse filtering, we might need a lambda or to fetch lines. Since $filter on lines is complex,
        # we might just do a basic query. Since requirement states filtering, if SAP allows DocumentLines/any:
        if warehouse_code:
             filters.append(f"DocumentLines/any(l: l/WarehouseCode eq '{warehouse_code}')")

        response = _service.list_sales_orders(skip=skip, top=limit, filters=filters)
        
        items = []
        for v in response.get("value", []):
            sp_code = str(v.get("SalesPersonCode")) if v.get("SalesPersonCode") is not None else None
            pg_code = v.get("PaymentGroupCode")
            
            items.append(SalesOrderListItem(
                doc_entry=v.get("DocEntry"),
                doc_num=v.get("DocNum"),
                doc_date=v.get("DocDate"),
                doc_due_date=v.get("DocDueDate"),
                card_code=v.get("CardCode"),
                card_name=v.get("CardName"),
                doc_total=v.get("DocTotal"),
                document_status=v.get("DocumentStatus"),
                cancelled=v.get("Cancelled"),
                sales_person_code=sp_code,
                agent_name=_get_agent_name(sp_code),
                bpl_id=v.get("BPL_IDAssignedToInvoice"),
                comments=v.get("Comments"),
                payment_group_code=pg_code,
                payment_terms=_get_payment_terms(pg_code)
            ))
            
        total = response.get("odata.count") or response.get("@odata.count") or len(items)
        
        return SalesOrderListResponse(
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
        logger.error(f"Error fetching sales orders: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/summary", response_model=SalesOrderSummary)
def get_sales_order_summary(
    branch_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        filters = []
        user_branch = current_user.get("branch_id")
        if branch_id and user_branch and branch_id != user_branch:
            raise HTTPException(status_code=403, detail="Unauthorized access to branch")
            
        target_branch = branch_id or user_branch
        if target_branch:
            filters.append(f"BPL_IDAssignedToInvoice eq {target_branch}")
            
        if date_from:
            filters.append(f"DocDate ge '{date_from}'")
        if date_to:
            filters.append(f"DocDate le '{date_to}'")
            
        summary = _service.get_sales_order_summary(filters=filters)
        return SalesOrderSummary(**summary)
    except SAPConnectionError as e:
        logger.error(f"SAP API Error: {e}")
        raise HTTPException(status_code=502, detail="SAP Business One is currently unavailable.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sales order summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{doc_entry}", response_model=SalesOrderDetail)
def get_sales_order(
    doc_entry: int,
    current_user: dict = Depends(get_current_user)
):
    try:
        response = _service.get_sales_order(doc_entry)
        
        # Enforce branch isolation
        user_branch = current_user.get("branch_id")
        order_branch = response.get("BPL_IDAssignedToInvoice")
        if user_branch and order_branch and user_branch != order_branch:
            raise HTTPException(status_code=403, detail="Unauthorized access to branch")

        lines = []
        for line in response.get("DocumentLines", []):
            quantity = line.get("Quantity") or 0.0
            balance_qty = line.get("RemainingOpenQuantity") or 0.0
            dispatch_qty = quantity - balance_qty

            lines.append(SalesOrderLine(
                line_num=line.get("LineNum"),
                item_code=line.get("ItemCode"),
                item_description=line.get("ItemDescription"),
                quantity=quantity,
                price=line.get("Price"),
                price_after_vat=line.get("PriceAfterVAT"),
                line_total=line.get("LineTotal"),
                warehouse_code=line.get("WarehouseCode"),
                dispatch_qty=dispatch_qty,
                balance_qty=balance_qty
            ))
            
        sp_code = str(response.get("SalesPersonCode")) if response.get("SalesPersonCode") is not None else None
        pg_code = response.get("PaymentGroupCode")
        
        return SalesOrderDetail(
            doc_entry=response.get("DocEntry"),
            doc_num=response.get("DocNum"),
            doc_date=response.get("DocDate"),
            doc_due_date=response.get("DocDueDate"),
            card_code=response.get("CardCode"),
            card_name=response.get("CardName"),
            doc_total=response.get("DocTotal"),
            document_status=response.get("DocumentStatus"),
            cancelled=response.get("Cancelled"),
            sales_person_code=sp_code,
            agent_name=_get_agent_name(sp_code),
            bpl_id=response.get("BPL_IDAssignedToInvoice"),
            comments=response.get("Comments"),
            payment_group_code=pg_code,
            payment_terms=_get_payment_terms(pg_code),
            document_lines=lines
        )
    except SAPConnectionError as e:
        if "NotFound" in str(e) or getattr(e, "status_code", 500) == 404:
            raise HTTPException(status_code=404, detail="Sales Order not found")
        logger.error(f"SAP API Error: {e}")
        raise HTTPException(status_code=502, detail="SAP Business One is currently unavailable.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sales order detail: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
