import logging
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict
from app.services.sap.client import get_sap_client

logger = logging.getLogger(__name__)

def map_production_status(sap_status: str) -> str:
    if not sap_status:
        return "Unknown"
    # Remove 'bopos' prefix and capitalize
    if sap_status.startswith("bopos"):
        return sap_status[5:]
    return sap_status

def map_production_type(sap_type: str) -> str:
    if not sap_type:
        return "Unknown"
    if sap_type.startswith("bopot"):
        return sap_type[5:]
    return sap_type

def safe_float(val: Any) -> float:
    try:
        return float(val or 0.0)
    except (ValueError, TypeError):
        return 0.0

def safe_int(val: Any) -> int:
    try:
        return int(val or 0)
    except (ValueError, TypeError):
        return 0

def calculate_metrics(planned: float, produced: float, rejected: float):
    pending = max(planned - produced, 0.0)
    prod_pct = (produced / planned * 100.0) if planned > 0 else 0.0
    rej_pct = (rejected / produced * 100.0) if produced > 0 else 0.0
    return pending, round(prod_pct, 2), round(rej_pct, 2)

class SAPProductionService:
    def __init__(self):
        self.client = get_sap_client()

    def _build_filter_str(
        self,
        search: Optional[str] = None,
        status: Optional[str] = None,
        item_code: Optional[str] = None,
        warehouse: Optional[str] = None,
        production_type: Optional[str] = None,
        priority: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> str:
        filters = []
        if search:
            # SAP doesn't support complex substring searches easily across multiple fields without a performance hit,
            # but we can do a simple eq or startswith if required, or skip it. Let's try substringof or startswith.
            search = search.replace("'", "''")
            filters.append(f"(contains(DocumentNumber, '{search}') or contains(ItemNo, '{search}') or contains(ProductDescription, '{search}'))")
        
        if status:
            filters.append(f"ProductionOrderStatus eq 'bopos{status}'")
            
        if item_code:
            item_code = item_code.replace("'", "''")
            filters.append(f"ItemNo eq '{item_code}'")
            
        if warehouse:
            warehouse = warehouse.replace("'", "''")
            filters.append(f"Warehouse eq '{warehouse}'")
            
        if production_type:
            filters.append(f"ProductionOrderType eq 'bopot{production_type}'")
            
        if priority is not None:
            filters.append(f"Priority eq {priority}")
            
        if date_from:
            filters.append(f"StartDate ge '{date_from}'")
            
        if date_to:
            filters.append(f"StartDate le '{date_to}'")
            
        return " and ".join(filters) if filters else ""


    def _fetch_all(self, endpoint: str, max_records: int = 5000) -> list:
        """Fetches all pages from SAP Service Layer up to max_records limit."""
        results = []
        next_link = endpoint
        
        while next_link and len(results) < max_records:
            # Service layer nextLink might be relative or include /b1s/v1/
            if next_link.startswith('/b1s/v1/'):
                next_link = next_link[8:]
            
            response = self.client.get(next_link)
            chunk = response.get("value", [])
            if not chunk:
                break
                
            results.extend(chunk)
            
            # Check for next page
            next_link = response.get("odata.nextLink")
            
            # If we hit max_records, we stop
            if len(results) >= max_records:
                logger.warning(f"Hit max_records limit ({max_records}) fetching {endpoint}")
                break
                
        return results

    def get_production_summary(
        self,
        warehouse: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch overall summary. For accuracy, we fetch necessary fields to aggregate."""
        # Using $select to get just what we need to calculate summary
        # If there are many orders, this could be slow, but it's the safest way to aggregate correctly.
        filter_str = self._build_filter_str(warehouse=warehouse, date_from=date_from, date_to=date_to)
        query = "$select=ProductionOrderStatus,PlannedQuantity,CompletedQuantity,RejectedQuantity"
        if filter_str:
            query += f"&$filter={filter_str}"
            
        endpoint = f"/ProductionOrders?{query}"
        orders = self._fetch_all(endpoint)
        
        total_prod = 0.0
        planned = 0
        released = 0
        completed = 0
        cancelled = 0
        total_rej = 0.0
        total_planned_qty = 0.0
        
        for po in orders:
            p_qty = safe_float(po.get("PlannedQuantity"))
            c_qty = safe_float(po.get("CompletedQuantity"))
            r_qty = safe_float(po.get("RejectedQuantity"))
            status = map_production_status(po.get("ProductionOrderStatus"))
            
            total_planned_qty += p_qty
            total_prod += c_qty
            total_rej += r_qty
            
            if status == "Planned":
                planned += 1
            elif status == "Released":
                released += 1
            elif status == "Closed":
                completed += 1
            elif status == "Cancelled":
                cancelled += 1
                
        pending = max(total_planned_qty - total_prod, 0.0)
        rej_pct = (total_rej / total_prod * 100) if total_prod > 0 else 0.0
        
        return {
            "total_production": total_prod,
            "planned_orders": planned,
            "released_orders": released,
            "completed_orders": completed,
            "cancelled_orders": cancelled,
            "total_rejection": total_rej,
            "rejection_percentage": round(rej_pct, 2),
            "pending_production": pending,
            "production_efficiency": None # Efficiency needs a predefined business formula
        }

    def get_production_orders(
        self,
        skip: int = 0,
        top: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        item_code: Optional[str] = None,
        warehouse: Optional[str] = None,
        production_type: Optional[str] = None,
        priority: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        
        filter_str = self._build_filter_str(
            search=search, status=status, item_code=item_code,
            warehouse=warehouse, production_type=production_type,
            priority=priority, date_from=date_from, date_to=date_to
        )
        
        query_parts = [
            "$select=DocumentNumber,ItemNo,ProductDescription,ProductionOrderType,ProductionOrderStatus,PlannedQuantity,CompletedQuantity,RejectedQuantity,PostingDate,StartDate,DueDate,Warehouse,Priority",
            f"$skip={skip}",
            f"$top={top}",
            "$orderby=DocumentNumber desc",
            "$inlinecount=allpages"
        ]
        
        if filter_str:
            query_parts.append(f"$filter={filter_str}")
            
        endpoint = f"/ProductionOrders?{'&'.join(query_parts)}"
        response = self.client.get(endpoint)
        
        orders = response.get("value", [])
        total = int(response.get("odata.count", 0))
        
        result = []
        for po in orders:
            p_qty = safe_float(po.get("PlannedQuantity"))
            c_qty = safe_float(po.get("CompletedQuantity"))
            r_qty = safe_float(po.get("RejectedQuantity"))
            pending, p_pct, r_pct = calculate_metrics(p_qty, c_qty, r_qty)
            
            result.append({
                "production_order_no": po.get("DocumentNumber"),
                "item_code": po.get("ItemNo"),
                "item_name": po.get("ProductDescription"),
                "production_type": map_production_type(po.get("ProductionOrderType")),
                "status": map_production_status(po.get("ProductionOrderStatus")),
                "planned_qty": p_qty,
                "produced_qty": c_qty,
                "rejected_qty": r_qty,
                "pending_qty": pending,
                "production_percentage": p_pct,
                "rejection_percentage": r_pct,
                "posting_date": po.get("PostingDate"),
                "start_date": po.get("StartDate"),
                "due_date": po.get("DueDate"),
                "warehouse": po.get("Warehouse"),
                "priority": po.get("Priority")
            })
            
        return result, total

    def get_production_order(self, doc_entry_or_num: int) -> Optional[Dict[str, Any]]:
        # Usually DocumentNumber is what user sees, but API routes use DocumentNumber = doc_entry_or_num for lookup.
        # However, to query by DocumentNumber, we might need to filter:
        endpoint = f"/ProductionOrders?$filter=DocumentNumber eq {doc_entry_or_num}&$select=DocumentNumber,ItemNo,ProductDescription,ProductionOrderType,ProductionOrderStatus,PlannedQuantity,CompletedQuantity,RejectedQuantity,PostingDate,StartDate,DueDate,CreationDate,Priority,Warehouse,Project,ProductionOrderLines"
        response = self.client.get(endpoint)
        orders = response.get("value", [])
        if not orders:
            return None
            
        po = orders[0]
        p_qty = safe_float(po.get("PlannedQuantity"))
        c_qty = safe_float(po.get("CompletedQuantity"))
        r_qty = safe_float(po.get("RejectedQuantity"))
        pending, p_pct, r_pct = calculate_metrics(p_qty, c_qty, r_qty)
        
        components = []
        for line in po.get("ProductionOrderLines", []):
            l_p_qty = safe_float(line.get("PlannedQuantity"))
            l_i_qty = safe_float(line.get("IssuedQuantity"))
            components.append({
                "item_code": line.get("ItemNo"),
                "item_name": line.get("ItemName"),
                "base_qty": safe_float(line.get("BaseQuantity")),
                "planned_qty": l_p_qty,
                "issued_qty": l_i_qty,
                "pending_qty": max(l_p_qty - l_i_qty, 0.0),
                "warehouse": line.get("Warehouse")
            })
            
        return {
            "production_order_no": po.get("DocumentNumber"),
            "item_code": po.get("ItemNo"),
            "item_name": po.get("ProductDescription"),
            "production_type": map_production_type(po.get("ProductionOrderType")),
            "status": map_production_status(po.get("ProductionOrderStatus")),
            "planned_qty": p_qty,
            "produced_qty": c_qty,
            "rejected_qty": r_qty,
            "pending_qty": pending,
            "production_percentage": p_pct,
            "rejection_percentage": r_pct,
            "posting_date": po.get("PostingDate"),
            "start_date": po.get("StartDate"),
            "due_date": po.get("DueDate"),
            "creation_date": po.get("CreationDate"),
            "priority": po.get("Priority"),
            "warehouse": po.get("Warehouse"),
            "project": po.get("Project"),
            "components": components
        }

    def get_item_wise_production(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        warehouse: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        filter_str = self._build_filter_str(date_from=date_from, date_to=date_to, warehouse=warehouse, search=search)
        query = "$select=ItemNo,ProductDescription,PlannedQuantity,CompletedQuantity,RejectedQuantity,Warehouse"
        if filter_str:
            query += f"&$filter={filter_str}"
            
        orders = self._fetch_all(f"/ProductionOrders?{query}")
        
        agg = defaultdict(lambda: {"planned": 0.0, "produced": 0.0, "rejected": 0.0, "name": "", "warehouse": None})
        
        for po in orders:
            item_code = po.get("ItemNo")
            if not item_code:
                continue
            agg[item_code]["name"] = po.get("ProductDescription")
            agg[item_code]["planned"] += safe_float(po.get("PlannedQuantity"))
            agg[item_code]["produced"] += safe_float(po.get("CompletedQuantity"))
            agg[item_code]["rejected"] += safe_float(po.get("RejectedQuantity"))
            # Keep first warehouse or None if multiple
            if not agg[item_code]["warehouse"]:
                agg[item_code]["warehouse"] = po.get("Warehouse")
                
        result = []
        for code, data in agg.items():
            pending, p_pct, r_pct = calculate_metrics(data["planned"], data["produced"], data["rejected"])
            result.append({
                "item_code": code,
                "item_name": data["name"],
                "planned_qty": data["planned"],
                "produced_qty": data["produced"],
                "rejected_qty": data["rejected"],
                "pending_qty": pending,
                "production_percentage": p_pct,
                "rejection_percentage": r_pct,
                "warehouse": data["warehouse"]
            })
            
        return sorted(result, key=lambda x: x["produced_qty"], reverse=True)

    def get_rejection_summary(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        warehouse: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        filter_str = self._build_filter_str(date_from=date_from, date_to=date_to, warehouse=warehouse, search=search)
        query = "$select=ItemNo,ProductDescription,CompletedQuantity,RejectedQuantity,Warehouse"
        # Only care about orders with > 0 rejection
        rej_filter = "RejectedQuantity gt 0"
        if filter_str:
            filter_str += f" and {rej_filter}"
        else:
            filter_str = rej_filter
            
        query += f"&$filter={filter_str}"
        
        orders = self._fetch_all(f"/ProductionOrders?{query}")
        
        agg = defaultdict(lambda: {"produced": 0.0, "rejected": 0.0, "name": "", "warehouse": None})
        total_rej = 0.0
        total_prod = 0.0
        
        for po in orders:
            item_code = po.get("ItemNo")
            if not item_code:
                continue
            p_qty = safe_float(po.get("CompletedQuantity"))
            r_qty = safe_float(po.get("RejectedQuantity"))
            
            agg[item_code]["name"] = po.get("ProductDescription")
            agg[item_code]["produced"] += p_qty
            agg[item_code]["rejected"] += r_qty
            if not agg[item_code]["warehouse"]:
                agg[item_code]["warehouse"] = po.get("Warehouse")
                
            total_prod += p_qty
            total_rej += r_qty
            
        items = []
        for code, data in agg.items():
            _, p_pct, r_pct = calculate_metrics(0, data["produced"], data["rejected"]) # Only care about rej_pct
            items.append({
                "item_code": code,
                "item_name": data["name"],
                "produced_qty": data["produced"],
                "rejected_qty": data["rejected"],
                "rejection_percentage": r_pct,
                "production_percentage": p_pct, # Dummy 0 here based on calculate_metrics above, not needed for rejection
                "warehouse": data["warehouse"]
            })
            
        return {
            "total_rejected_qty": total_rej,
            "rejection_percentage": round((total_rej / total_prod * 100), 2) if total_prod > 0 else 0.0,
            "items_with_rejection": len(items),
            "items": sorted(items, key=lambda x: x["rejected_qty"], reverse=True)
        }

    def get_date_wise_production(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        warehouse: Optional[str] = None,
        granularity: str = "daily"
    ) -> List[Dict[str, Any]]:
        filter_str = self._build_filter_str(date_from=date_from, date_to=date_to, warehouse=warehouse)
        query = "$select=StartDate,PlannedQuantity,CompletedQuantity,RejectedQuantity"
        if filter_str:
            query += f"&$filter={filter_str}"
            
        orders = self._fetch_all(f"/ProductionOrders?{query}")
        
        agg = defaultdict(lambda: {"planned": 0.0, "produced": 0.0, "rejected": 0.0})
        
        for po in orders:
            d = po.get("StartDate")
            if not d:
                continue
                
            if granularity == "monthly":
                d = d[:7] # YYYY-MM
            elif granularity == "yearly":
                d = d[:4] # YYYY
            # weekly is trickier to calculate precisely without iso format logic, sticking to daily if not month/year
            
            agg[d]["planned"] += safe_float(po.get("PlannedQuantity"))
            agg[d]["produced"] += safe_float(po.get("CompletedQuantity"))
            agg[d]["rejected"] += safe_float(po.get("RejectedQuantity"))
            
        result = []
        for d, data in sorted(agg.items()):
            pending, p_pct, r_pct = calculate_metrics(data["planned"], data["produced"], data["rejected"])
            result.append({
                "date": d,
                "planned_qty": data["planned"],
                "produced_qty": data["produced"],
                "rejected_qty": data["rejected"],
                "pending_qty": pending,
                "production_percentage": p_pct,
                "rejection_percentage": r_pct
            })
            
        return result

    def get_status_distribution(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        warehouse: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        filter_str = self._build_filter_str(date_from=date_from, date_to=date_to, warehouse=warehouse)
        query = "$select=ProductionOrderStatus"
        if filter_str:
            query += f"&$filter={filter_str}"
            
        orders = self._fetch_all(f"/ProductionOrders?{query}")
        
        counts = defaultdict(int)
        total = len(orders)
        
        for po in orders:
            status = map_production_status(po.get("ProductionOrderStatus"))
            counts[status] += 1
            
        result = []
        for status, count in counts.items():
            result.append({
                "status": status,
                "label": status,
                "count": count,
                "percentage": round((count / total * 100), 2) if total > 0 else 0.0
            })
            
        return result

    def get_warehouse_summary(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        warehouse: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        filter_str = self._build_filter_str(date_from=date_from, date_to=date_to, warehouse=warehouse)
        query = "$select=Warehouse,PlannedQuantity,CompletedQuantity,RejectedQuantity"
        if filter_str:
            query += f"&$filter={filter_str}"
            
        orders = self._fetch_all(f"/ProductionOrders?{query}")
        
        agg = defaultdict(lambda: {"planned": 0.0, "produced": 0.0, "rejected": 0.0})
        
        for po in orders:
            w = po.get("Warehouse")
            if not w:
                w = "Unknown"
            agg[w]["planned"] += safe_float(po.get("PlannedQuantity"))
            agg[w]["produced"] += safe_float(po.get("CompletedQuantity"))
            agg[w]["rejected"] += safe_float(po.get("RejectedQuantity"))
            
        result = []
        for w, data in agg.items():
            pending, p_pct, _ = calculate_metrics(data["planned"], data["produced"], data["rejected"])
            result.append({
                "warehouse": w,
                "planned_qty": data["planned"],
                "produced_qty": data["produced"],
                "rejected_qty": data["rejected"],
                "pending_qty": pending,
                "production_percentage": p_pct
            })
            
        return sorted(result, key=lambda x: x["produced_qty"], reverse=True)
