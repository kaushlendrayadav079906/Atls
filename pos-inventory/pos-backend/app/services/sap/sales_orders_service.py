import math
import logging
from typing import Dict, Any, List, Optional
from app.services.sap.client import get_sap_client

logger = logging.getLogger(__name__)

class SAPSalesOrdersService:
    def __init__(self):
        self.client = get_sap_client()

    def list_sales_orders(self, skip: int = 0, top: int = 10, filters: Optional[List[str]] = None) -> Dict[str, Any]:
        """Fetch a paginated list of sales orders."""
        query_parts = [
            f"$select=DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,DocumentStatus,Cancelled,SalesPersonCode,BPL_IDAssignedToInvoice,Comments,PaymentGroupCode",
            f"$skip={skip}",
            f"$top={top}",
            f"$orderby=DocEntry desc"
        ]
        
        if filters:
            filter_str = " and ".join(filters)
            query_parts.append(f"$filter={filter_str}")

        query = "&".join(query_parts)
        query += "&$inlinecount=allpages"
        
        endpoint = f"/Orders?{query}"
        response = self.client.get(endpoint)
        return response

    def get_sales_order(self, doc_entry: int) -> Dict[str, Any]:
        """Fetch a single sales order by DocEntry."""
        endpoint = f"/Orders({doc_entry})?$select=DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,DocumentStatus,Cancelled,SalesPersonCode,BPL_IDAssignedToInvoice,Comments,PaymentGroupCode,DocumentLines"
        response = self.client.get(endpoint)
        return response
        
    def get_sales_order_summary(self, filters: Optional[List[str]] = None) -> Dict[str, Any]:
        """Fetch summary counts for sales orders."""
        # A simple approach: use inlinecount for different statuses or just return raw counts if supported.
        # Given limitations, we'll fetch $inlinecount=allpages with different filters.
        
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
        # Using bost_Open for pending, bost_Close for completed, Cancelled eq 'Y' for cancelled
        # We need to map to verified statuses later or assume bost_Open / bost_Close based on standard SAP
        pending = _get_count("DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'")
        completed = _get_count("DocumentStatus eq 'bost_Close' and Cancelled eq 'tNO'")
        cancelled = _get_count("Cancelled eq 'tYES'")
        
        return {
            "total_orders": total,
            "pending_orders": pending,
            "completed_orders": completed,
            "cancelled_orders": cancelled
        }
