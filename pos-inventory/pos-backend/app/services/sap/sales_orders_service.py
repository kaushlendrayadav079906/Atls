import math
import logging
from typing import Dict, Any, List, Optional
from app.services.sap.client import get_sap_client

logger = logging.getLogger(__name__)

class SAPSalesOrdersService:
    def __init__(self):
        self.client = get_sap_client()

    def list_sales_orders(
        self, 
        skip: int = 0, 
        top: int = 10, 
        filters: Optional[List[str]] = None,
        warehouse_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch a paginated list of sales orders with authorized filters."""
        if warehouse_code:
            # SAP Service Layer does not support OData lambda $filter on DocumentLines/any.
            # Per Rule 3.5: query authorized orders matching header filters with DocumentLines,
            # then filter on line WarehouseCode safely and paginate.
            query_parts = [
                "$select=DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,DocumentStatus,Cancelled,SalesPersonCode,BPL_IDAssignedToInvoice,Comments,PaymentGroupCode,DocumentLines",
                "$top=1000",
                "$orderby=DocEntry desc"
            ]
            if filters:
                query_parts.append(f"$filter={' and '.join(filters)}")
            
            endpoint = f"/Orders?{'&'.join(query_parts)}"
            res = self.client.get(endpoint)
            all_vals = res.get("value", [])
            
            matched = [
                v for v in all_vals
                if any(str(line.get("WarehouseCode", "")).strip().upper() == warehouse_code.strip().upper() 
                       for line in v.get("DocumentLines", []))
            ]
            total = len(matched)
            paginated = matched[skip: skip + top]
            return {
                "value": paginated,
                "odata.count": total
            }

        # Native SAP OData query when no line-level warehouse filter is active
        query_parts = [
            "$select=DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,DocumentStatus,Cancelled,SalesPersonCode,BPL_IDAssignedToInvoice,Comments,PaymentGroupCode",
            f"$skip={skip}",
            f"$top={top}",
            "$orderby=DocEntry desc"
        ]
        
        if filters:
            query_parts.append(f"$filter={' and '.join(filters)}")

        query = "&".join(query_parts) + "&$inlinecount=allpages"
        endpoint = f"/Orders?{query}"
        return self.client.get(endpoint)

    def get_sales_order(self, doc_entry: int) -> Dict[str, Any]:
        """Fetch a single sales order by DocEntry."""
        endpoint = f"/Orders({doc_entry})?$select=DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,DocumentStatus,Cancelled,SalesPersonCode,BPL_IDAssignedToInvoice,Comments,PaymentGroupCode,DocumentLines"
        return self.client.get(endpoint)
        
    def get_sales_order_summary(
        self, 
        filters: Optional[List[str]] = None,
        warehouse_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch summary counts for sales orders with authorized filters."""
        if warehouse_code:
            # Calculate counts accurately for warehouse-filtered subset
            query_parts = [
                "$select=DocEntry,DocumentStatus,Cancelled,DocumentLines",
                "$top=1000"
            ]
            if filters:
                query_parts.append(f"$filter={' and '.join(filters)}")
                
            endpoint = f"/Orders?{'&'.join(query_parts)}"
            try:
                res = self.client.get(endpoint)
                all_vals = res.get("value", [])
                matched = [
                    v for v in all_vals
                    if any(str(line.get("WarehouseCode", "")).strip().upper() == warehouse_code.strip().upper() 
                           for line in v.get("DocumentLines", []))
                ]
                total = len(matched)
                pending = sum(1 for v in matched if v.get("DocumentStatus") == "bost_Open" and v.get("Cancelled") != "tYES")
                completed = sum(1 for v in matched if v.get("DocumentStatus") == "bost_Close" and v.get("Cancelled") != "tYES")
                cancelled = sum(1 for v in matched if v.get("Cancelled") == "tYES")
                return {
                    "total_orders": total,
                    "pending_orders": pending,
                    "completed_orders": completed,
                    "cancelled_orders": cancelled
                }
            except Exception as e:
                logger.error(f"Error computing sales order warehouse summary: {e}")
                return {"total_orders": 0, "pending_orders": 0, "completed_orders": 0, "cancelled_orders": 0}

        base_filter = " and ".join(filters) if filters else ""
        
        def _get_count(extra_filter: str = "") -> int:
            f_str = f"({base_filter}) and ({extra_filter})" if base_filter and extra_filter else (base_filter or extra_filter)
            q = "$top=1&$select=DocEntry&$inlinecount=allpages"
            if f_str:
                q += f"&$filter={f_str}"
            try:
                res = self.client.get(f"/Orders?{q}")
                return res.get("odata.count", 0)
            except Exception as e:
                logger.error(f"Error getting summary count: {e}")
                return 0

        total = _get_count()
        pending = _get_count("DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'")
        completed = _get_count("DocumentStatus eq 'bost_Close' and Cancelled eq 'tNO'")
        cancelled = _get_count("Cancelled eq 'tYES'")
        
        return {
            "total_orders": total,
            "pending_orders": pending,
            "completed_orders": completed,
            "cancelled_orders": cancelled
        }
