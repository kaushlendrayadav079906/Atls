from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
import io
import csv
import logging
from cachetools import TTLCache

from app.core.security import get_current_user, require_permission
from app.services.sap.client import get_sap_client
from app.services.sap.inventory_service import SAPInventoryService
from app.services.sap.items_service import SAPItemsService

logger = logging.getLogger(__name__)

router = APIRouter()

# 5-minute TTL cache for expensive aggregate reporting queries
INVENTORY_REPORT_CACHE = TTLCache(maxsize=20, ttl=300)
ITEM_GROUPS_CACHE: Dict[int, str] = {}


# Response Schemas

class KPIOverviewResponse(BaseModel):
    total_products: int = Field(default=0)
    total_stock_value: float = Field(default=0.0)
    low_stock_items: int = Field(default=0)
    out_of_stock: int = Field(default=0)
    expiring_soon: int = Field(default=0)


class StatusDistributionStatus(BaseModel):
    status: str
    count: int
    percentage: float


class StatusDistributionResponse(BaseModel):
    total: int
    statuses: List[StatusDistributionStatus]


class CategoryValue(BaseModel):
    category: str
    stock_value: float


class CategoryValueResponse(BaseModel):
    categories: List[CategoryValue]


class MovementData(BaseModel):
    period: str
    stock_in: float
    stock_out: float


class MovementsResponse(BaseModel):
    data: List[MovementData]
    status: str = "available"
    message: Optional[str] = None


class ProductItem(BaseModel):
    id: str
    item_code: str
    name: str
    sku: str
    category: str
    warehouse: str
    current_stock: float
    min_stock: Optional[float]
    stock_value: float
    status: str
    last_updated: Optional[str]


class ProductsResponse(BaseModel):
    items: List[ProductItem]
    total: int
    page: int
    limit: int
    total_pages: int


class MovementRecord(BaseModel):
    id: str
    doc_num: str
    doc_type: str
    doc_date: str
    item_code: str
    item_name: str
    quantity: float
    warehouse: str
    comments: Optional[str] = None


class MovementsListResponse(BaseModel):
    items: List[MovementRecord]
    total: int
    page: int
    limit: int
    total_pages: int


class ValuationItem(BaseModel):
    id: str
    item_code: str
    name: str
    category: str
    warehouse: str
    current_stock: float
    unit_cost: float
    stock_value: float
    valuation_method: str
    percentage_of_total: float


class ValuationResponse(BaseModel):
    items: List[ValuationItem]
    total_stock_value: float
    total: int
    page: int
    limit: int
    total_pages: int


class LowStockItem(BaseModel):
    id: str
    item_code: str
    name: str
    category: str
    warehouse: str
    current_stock: float
    min_stock: float
    deficit: float
    status: str


class LowStockResponse(BaseModel):
    items: List[LowStockItem]
    total: int
    page: int
    limit: int
    total_pages: int


class ExpiryItem(BaseModel):
    id: str
    item_code: str
    name: str
    batch_number: str
    admission_date: Optional[str] = None
    expiration_date: Optional[str] = None
    status: str
    tracking_supported: bool = True
    notice: Optional[str] = None


class ExpiryResponse(BaseModel):
    items: List[ExpiryItem]
    total: int
    expiring_count: int
    page: int
    limit: int
    total_pages: int
    limitation_notice: Optional[str] = None


# Helpers

def get_item_groups_map() -> Dict[int, str]:
    """Fetch and cache SAP ItemGroups to translate group codes to human names."""
    global ITEM_GROUPS_CACHE
    if ITEM_GROUPS_CACHE:
        return ITEM_GROUPS_CACHE

    try:
        client = get_sap_client()
        res = client.get("ItemGroups", {"$select": "Number,GroupName", "$top": 100})
        for group in res.get("value", []):
            num = group.get("Number")
            name = group.get("GroupName")
            if num is not None and name:
                ITEM_GROUPS_CACHE[int(num)] = str(name)
    except Exception as e:
        logger.warning(f"Could not load SAP ItemGroups: {e}")
        # Default known SAP ItemGroups fallback
        ITEM_GROUPS_CACHE = {
            100: "Items",
            101: "FINISHED GOODS",
            102: "RAW MATERIAL",
            103: "CABLE",
            104: "SFG",
            105: "Packing Material",
            106: "Job Work Service",
        }
    return ITEM_GROUPS_CACHE


def resolve_category_name(raw_item: Dict[str, Any]) -> str:
    """Resolve human-readable category name for an item."""
    groups_map = get_item_groups_map()
    subg = raw_item.get("U_SUBG")
    if subg:
        return str(subg)
    
    group_code = raw_item.get("ItemsGroupCode")
    if group_code is not None:
        try:
            code_int = int(group_code)
            if code_int in groups_map:
                return groups_map[code_int]
        except (ValueError, TypeError):
            pass
        return str(group_code)
    return "Others"


def fetch_inventory_data(warehouse: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch active inventory items from SAP Business One with pagination."""
    wh_key = warehouse if (warehouse and warehouse.lower() != "all") else "all"
    cache_key = f"inv_data_{wh_key}"
    if cache_key in INVENTORY_REPORT_CACHE:
        return INVENTORY_REPORT_CACHE[cache_key]

    items_service = SAPItemsService()
    select_fields = [
        "ItemCode", "ItemName", "ItemsGroupCode", "QuantityOnStock",
        "AvgStdPrice", "MovingAveragePrice", "ItemPrices",
        "ItemWarehouseInfoCollection", "BarCode"
    ]

    try:
        raw_items = items_service.client.query_items(
            filter_str="Valid eq 'tYES' and Frozen eq 'tNO'",
            select=select_fields,
            top=2000
        ).get("value", [])
    except Exception as e:
        logger.error(f"Error fetching items from SAP: {e}")
        raw_items = []

    INVENTORY_REPORT_CACHE[cache_key] = raw_items
    return raw_items


def extract_item_stock(item: Dict[str, Any], warehouse: Optional[str] = None) -> float:
    """Extract on-hand quantity for an item (optionally filtered by warehouse)."""
    if warehouse and warehouse.lower() != "all":
        warehouses = item.get("ItemWarehouseInfoCollection", [])
        for wh in warehouses:
            if wh.get("WarehouseCode") == warehouse:
                return float(wh.get("InStock", 0.0) or 0.0)
        return 0.0
    return float(item.get("QuantityOnStock", 0.0) or 0.0)


def extract_item_price(item: Dict[str, Any]) -> float:
    """Extract item valuation unit price using SAP standard valuation sequence."""
    price = float(item.get("AvgStdPrice") or 0.0)
    if price <= 0:
        price = float(item.get("MovingAveragePrice") or 0.0)
    if price <= 0:
        prices = item.get("ItemPrices", [])
        for p in prices:
            p_val = float(p.get("Price") or 0.0)
            if p_val > 0:
                price = p_val
                break
    return price


def extract_min_stock(item: Dict[str, Any], warehouse: Optional[str] = None) -> float:
    """Extract minimum stock threshold configured in SAP, or fallback to default."""
    warehouses = item.get("ItemWarehouseInfoCollection", [])
    if warehouse and warehouse.lower() != "all":
        for wh in warehouses:
            if wh.get("WarehouseCode") == warehouse:
                ms = float(wh.get("MinimalStock") or 0.0)
                if ms > 0:
                    return ms
                break
    else:
        for wh in warehouses:
            ms = float(wh.get("MinimalStock") or 0.0)
            if ms > 0:
                return ms
    return 10.0


def calculate_status(current_stock: float, min_stock: float) -> str:
    """Derive stock status based on stock quantity and minimum threshold."""
    if current_stock <= 0:
        return "out_of_stock"
    if current_stock <= min_stock:
        return "low_stock"
    return "in_stock"


# Endpoints

@router.get("/overview", response_model=KPIOverviewResponse)
async def get_inventory_overview(
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    try:
        raw_items = fetch_inventory_data(warehouse)
        
        total_products = 0
        total_stock_value = 0.0
        low_stock_items = 0
        out_of_stock = 0
        
        for item in raw_items:
            if item.get("_truncated"):
                continue

            # Category filter
            item_cat = resolve_category_name(item)
            if category and category.lower() not in ("all", "all categories"):
                if item_cat.lower() != category.lower() and str(item.get("ItemsGroupCode")) != category:
                    continue

            total_products += 1
            stock = extract_item_stock(item, warehouse)
            price = extract_item_price(item)
            total_stock_value += (stock * price)
            
            min_stock = extract_min_stock(item, warehouse)
            status = calculate_status(stock, min_stock)
            if status == "out_of_stock":
                out_of_stock += 1
            elif status == "low_stock":
                low_stock_items += 1
                
        return KPIOverviewResponse(
            total_products=total_products,
            total_stock_value=round(total_stock_value, 2),
            low_stock_items=low_stock_items,
            out_of_stock=out_of_stock,
            expiring_soon=0
        )
    except Exception as e:
        logger.error(f"Error fetching inventory overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch inventory overview")


@router.get("/distribution", response_model=StatusDistributionResponse)
async def get_inventory_distribution(
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    try:
        raw_items = fetch_inventory_data(warehouse)
        
        in_stock = 0
        low_stock = 0
        out_of_stock = 0
        expiring = 0
        
        for item in raw_items:
            if item.get("_truncated"):
                continue

            item_cat = resolve_category_name(item)
            if category and category.lower() not in ("all", "all categories"):
                if item_cat.lower() != category.lower() and str(item.get("ItemsGroupCode")) != category:
                    continue

            stock = extract_item_stock(item, warehouse)
            min_stock = extract_min_stock(item, warehouse)
            status = calculate_status(stock, min_stock)
            
            if status == "out_of_stock":
                out_of_stock += 1
            elif status == "low_stock":
                low_stock += 1
            else:
                in_stock += 1
                
        total = in_stock + low_stock + out_of_stock + expiring
        if total == 0:
            return StatusDistributionResponse(total=0, statuses=[])
            
        return StatusDistributionResponse(
            total=total,
            statuses=[
                StatusDistributionStatus(status="in_stock", count=in_stock, percentage=round((in_stock/total)*100, 1)),
                StatusDistributionStatus(status="low_stock", count=low_stock, percentage=round((low_stock/total)*100, 1)),
                StatusDistributionStatus(status="out_of_stock", count=out_of_stock, percentage=round((out_of_stock/total)*100, 1)),
                StatusDistributionStatus(status="expiring_soon", count=expiring, percentage=0.0)
            ]
        )
    except Exception as e:
        logger.error(f"Error fetching inventory distribution: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch inventory distribution")


@router.get("/value-by-category", response_model=CategoryValueResponse)
async def get_inventory_value_by_category(
    warehouse: Optional[str] = None,
    limit: int = Query(6, alias="limit"),
    current_user: dict = Depends(require_permission("reports.view"))
):
    try:
        raw_items = fetch_inventory_data(warehouse)
        category_values: Dict[str, float] = {}
        
        for item in raw_items:
            if item.get("_truncated"):
                continue

            category_name = resolve_category_name(item)
            stock = extract_item_stock(item, warehouse)
            price = extract_item_price(item)
            val = stock * price
            
            category_values[category_name] = category_values.get(category_name, 0.0) + val
            
        # Sort by value descending
        sorted_cats = sorted(category_values.items(), key=lambda x: x[1], reverse=True)
        if limit > 0:
            sorted_cats = sorted_cats[:limit]
            
        result = [CategoryValue(category=k, stock_value=round(v, 2)) for k, v in sorted_cats]
        return CategoryValueResponse(categories=result)
        
    except Exception as e:
        logger.error(f"Error fetching inventory value by category: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch inventory value by category")


@router.get("/movements", response_model=MovementsResponse)
async def get_inventory_movements(
    warehouse: Optional[str] = None,
    period: str = Query("Week"),
    days: Optional[int] = Query(None),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    """
    Compute real chronological stock movements (In vs Out) using SAP Goods Receipts
    (InventoryGenEntries) and SAP Goods Issues (InventoryGenExits).
    """
    client = get_sap_client()
    try:
        # Fetch real SAP Goods Receipts (Stock In)
        entries_res = client.get("InventoryGenEntries", {
            "$select": "DocEntry,DocNum,DocDate,DocumentLines",
            "$top": 500
        })
        entries = entries_res.get("value", [])

        # Fetch real SAP Goods Issues (Stock Out)
        exits_res = client.get("InventoryGenExits", {
            "$select": "DocEntry,DocNum,DocDate,DocumentLines",
            "$top": 500
        })
        exits = exits_res.get("value", [])

        # Normalize period / days
        now = datetime.now()
        effective_period = period.capitalize()
        if days == 1 or effective_period == "Today":
            effective_period = "Today"
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif days == 7 or effective_period == "Week":
            effective_period = "Week"
            start_date = now - timedelta(days=6)
        elif days == 30 or effective_period == "Month":
            effective_period = "Month"
            start_date = now - timedelta(days=29)
        elif days == 365 or effective_period == "Year":
            effective_period = "Year"
            start_date = now - timedelta(days=364)
        else:
            effective_period = "Total"
            start_date = None

        if from_date:
            try:
                start_date = datetime.strptime(from_date, "%Y-%m-%d")
            except Exception:
                pass
        end_date = None
        if to_date:
            try:
                end_date = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
            except Exception:
                pass

        # Helper to parse SAP date
        def parse_date(date_str: str) -> Optional[datetime]:
            if not date_str:
                return None
            try:
                return datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                try:
                    return datetime.strptime(date_str[:10], "%Y-%m-%d")
                except Exception:
                    return None

        # Build movement buckets
        buckets: Dict[str, Dict[str, float]] = {}

        if effective_period == "Today":
            slots = ["09:00", "12:00", "15:00", "18:00", "21:00"]
            for s in slots:
                buckets[s] = {"stock_in": 0.0, "stock_out": 0.0}
        elif effective_period == "Week":
            for i in range(6, -1, -1):
                d_str = (now - timedelta(days=i)).strftime("%a")
                buckets[d_str] = {"stock_in": 0.0, "stock_out": 0.0}
        elif effective_period == "Month":
            for w in ["Week 1", "Week 2", "Week 3", "Week 4"]:
                buckets[w] = {"stock_in": 0.0, "stock_out": 0.0}
        elif effective_period in ("Year", "Total"):
            for m in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]:
                buckets[m] = {"stock_in": 0.0, "stock_out": 0.0}

        def record_movement(doc_list: List[Dict[str, Any]], is_in: bool):
            for doc in doc_list:
                doc_dt = parse_date(doc.get("DocDate"))
                if not doc_dt:
                    continue
                if start_date and doc_dt < start_date:
                    continue
                if end_date and doc_dt > end_date:
                    continue

                for line in doc.get("DocumentLines", []):
                    wh = line.get("WarehouseCode")
                    if warehouse and warehouse.lower() != "all" and wh != warehouse:
                        continue
                    qty = float(line.get("Quantity") or 0.0)

                    # Determine bucket key
                    if effective_period == "Today":
                        h = doc_dt.hour
                        if h < 11:
                            b_key = "09:00"
                        elif h < 14:
                            b_key = "12:00"
                        elif h < 17:
                            b_key = "15:00"
                        elif h < 20:
                            b_key = "18:00"
                        else:
                            b_key = "21:00"
                    elif effective_period == "Week":
                        b_key = doc_dt.strftime("%a")
                    elif effective_period == "Month":
                        day_num = doc_dt.day
                        if day_num <= 7:
                            b_key = "Week 1"
                        elif day_num <= 14:
                            b_key = "Week 2"
                        elif day_num <= 21:
                            b_key = "Week 3"
                        else:
                            b_key = "Week 4"
                    else:
                        b_key = doc_dt.strftime("%b")

                    if b_key not in buckets:
                        buckets[b_key] = {"stock_in": 0.0, "stock_out": 0.0}

                    field = "stock_in" if is_in else "stock_out"
                    buckets[b_key][field] += qty

        record_movement(entries, is_in=True)
        record_movement(exits, is_in=False)

        movement_results = [
            MovementData(
                period=k,
                stock_in=round(v["stock_in"], 1),
                stock_out=round(v["stock_out"], 1)
            )
            for k, v in buckets.items()
        ]

        return MovementsResponse(
            data=movement_results,
            status="available",
            message=f"Live SAP Goods Receipts ({len(entries)}) and Goods Issues ({len(exits)}) data."
        )

    except Exception as e:
        logger.error(f"Error fetching stock movements from SAP: {e}")
        return MovementsResponse(
            data=[],
            status="error",
            message=f"Error connecting to SAP Movement services: {str(e)}"
        )


@router.get("/products", response_model=ProductsResponse)
async def get_inventory_products(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    try:
        raw_items = fetch_inventory_data(warehouse)
        
        filtered_items = []
        for item in raw_items:
            if item.get("_truncated"):
                continue
            
            item_code = item.get("ItemCode") or ""
            item_name = item.get("ItemName") or ""
            barcode = item.get("BarCode") or ""
            
            if search:
                s = search.lower()
                if s not in item_code.lower() and s not in item_name.lower() and s not in str(barcode).lower():
                    continue
                    
            item_category = resolve_category_name(item)
            if category and category.lower() not in ("all", "all categories"):
                if item_category.lower() != category.lower() and str(item.get("ItemsGroupCode")) != category:
                    continue
                
            stock = extract_item_stock(item, warehouse)
            min_stock = extract_min_stock(item, warehouse)
            item_status = calculate_status(stock, min_stock)
            
            if status and status.lower() != "all":
                if status == "in_stock" and item_status != "in_stock":
                    continue
                if status == "low_stock" and item_status != "low_stock":
                    continue
                if status == "out_of_stock" and item_status != "out_of_stock":
                    continue
                
            price = extract_item_price(item)
            
            filtered_items.append(ProductItem(
                id=item_code,
                item_code=item_code,
                name=item_name,
                sku=item_code,
                category=item_category,
                warehouse=warehouse if (warehouse and warehouse.lower() != "all") else "All Warehouses",
                current_stock=stock,
                min_stock=min_stock,
                stock_value=round(stock * price, 2),
                status=item_status,
                last_updated=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))
            
        total = len(filtered_items)
        total_pages = max(1, (total + limit - 1) // limit)
        
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_items = filtered_items[start_idx:end_idx]
        
        return ProductsResponse(
            items=paginated_items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
        
    except Exception as e:
        logger.error(f"Error fetching inventory products: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch inventory products")


@router.get("/movements-list", response_model=MovementsListResponse)
async def get_inventory_movements_list(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    warehouse: Optional[str] = None,
    search: Optional[str] = None,
    movement_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    """List detailed SAP stock movement records (Receipts, Issues, Transfers)."""
    client = get_sap_client()
    try:
        all_records: List[MovementRecord] = []

        # 1. Goods Receipts (Stock In)
        if not movement_type or movement_type in ("all", "Stock In"):
            res = client.get("InventoryGenEntries", {"$select": "DocEntry,DocNum,DocDate,Comments,DocumentLines", "$top": 500})
            for doc in res.get("value", []):
                d_date = (doc.get("DocDate") or "")[:10]
                if from_date and d_date < from_date:
                    continue
                if to_date and d_date > to_date:
                    continue
                for l in doc.get("DocumentLines", []):
                    wh = l.get("WarehouseCode") or ""
                    if warehouse and warehouse.lower() != "all" and wh != warehouse:
                        continue
                    item_code = l.get("ItemCode") or ""
                    item_name = l.get("ItemDescription") or item_code
                    if search and (search.lower() not in item_code.lower() and search.lower() not in item_name.lower()):
                        continue
                    all_records.append(MovementRecord(
                        id=f"GR-{doc.get('DocEntry')}-{l.get('LineNum', 0)}",
                        doc_num=f"GR-{doc.get('DocNum') or doc.get('DocEntry')}",
                        doc_type="Stock In",
                        doc_date=d_date,
                        item_code=item_code,
                        item_name=item_name,
                        quantity=float(l.get("Quantity") or 0.0),
                        warehouse=wh,
                        comments=doc.get("Comments") or "Goods Receipt"
                    ))

        # 2. Goods Issues (Stock Out)
        if not movement_type or movement_type in ("all", "Stock Out"):
            res = client.get("InventoryGenExits", {"$select": "DocEntry,DocNum,DocDate,Comments,DocumentLines", "$top": 500})
            for doc in res.get("value", []):
                d_date = (doc.get("DocDate") or "")[:10]
                if from_date and d_date < from_date:
                    continue
                if to_date and d_date > to_date:
                    continue
                for l in doc.get("DocumentLines", []):
                    wh = l.get("WarehouseCode") or ""
                    if warehouse and warehouse.lower() != "all" and wh != warehouse:
                        continue
                    item_code = l.get("ItemCode") or ""
                    item_name = l.get("ItemDescription") or item_code
                    if search and (search.lower() not in item_code.lower() and search.lower() not in item_name.lower()):
                        continue
                    all_records.append(MovementRecord(
                        id=f"GI-{doc.get('DocEntry')}-{l.get('LineNum', 0)}",
                        doc_num=f"GI-{doc.get('DocNum') or doc.get('DocEntry')}",
                        doc_type="Stock Out",
                        doc_date=d_date,
                        item_code=item_code,
                        item_name=item_name,
                        quantity=-abs(float(l.get("Quantity") or 0.0)),
                        warehouse=wh,
                        comments=doc.get("Comments") or "Goods Issue"
                    ))

        # 3. Stock Transfers
        if not movement_type or movement_type in ("all", "Transfer"):
            res = client.get("StockTransfers", {"$select": "DocEntry,DocDate,Comments,StockTransferLines", "$top": 100})
            for doc in res.get("value", []):
                d_date = (doc.get("DocDate") or "")[:10]
                if from_date and d_date < from_date:
                    continue
                if to_date and d_date > to_date:
                    continue
                for l in doc.get("StockTransferLines", []):
                    from_wh = l.get("FromWarehouseCode") or ""
                    to_wh = l.get("WarehouseCode") or ""
                    if warehouse and warehouse.lower() != "all" and (warehouse not in (from_wh, to_wh)):
                        continue
                    item_code = l.get("ItemCode") or ""
                    item_name = l.get("ItemDescription") or item_code
                    if search and (search.lower() not in item_code.lower() and search.lower() not in item_name.lower()):
                        continue
                    all_records.append(MovementRecord(
                        id=f"ST-{doc.get('DocEntry')}-{l.get('LineNum', 0)}",
                        doc_num=f"ST-{doc.get('DocEntry')}",
                        doc_type="Transfer",
                        doc_date=d_date,
                        item_code=item_code,
                        item_name=item_name,
                        quantity=float(l.get("Quantity") or 0.0),
                        warehouse=f"{from_wh} -> {to_wh}",
                        comments=doc.get("Comments") or "Stock Transfer"
                    ))

        # Sort chronologically descending
        all_records.sort(key=lambda x: x.doc_date, reverse=True)

        total = len(all_records)
        total_pages = max(1, (total + limit - 1) // limit)
        start = (page - 1) * limit
        items = all_records[start:start + limit]

        return MovementsListResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
    except Exception as e:
        logger.error(f"Error fetching movement list: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock movements list")


@router.get("/valuation", response_model=ValuationResponse)
async def get_inventory_valuation(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    """Detailed valuation report breakdown by item, cost method, and share of total value."""
    try:
        raw_items = fetch_inventory_data(warehouse)
        
        # Calculate overall total stock value first
        total_valuation = 0.0
        all_valuation_items = []

        for item in raw_items:
            if item.get("_truncated"):
                continue

            stock = extract_item_stock(item, warehouse)
            price = extract_item_price(item)
            val = stock * price
            total_valuation += val

        for item in raw_items:
            if item.get("_truncated"):
                continue

            item_code = item.get("ItemCode") or ""
            item_name = item.get("ItemName") or ""
            if search and (search.lower() not in item_code.lower() and search.lower() not in item_name.lower()):
                continue

            item_cat = resolve_category_name(item)
            if category and category.lower() not in ("all", "all categories"):
                if item_cat.lower() != category.lower() and str(item.get("ItemsGroupCode")) != category:
                    continue

            stock = extract_item_stock(item, warehouse)
            price = extract_item_price(item)
            val = stock * price
            
            method = "Moving Average" if float(item.get("MovingAveragePrice") or 0) > 0 else (
                "Standard Cost" if float(item.get("AvgStdPrice") or 0) > 0 else "Price List Base"
            )
            pct = round((val / total_valuation * 100), 2) if total_valuation > 0 else 0.0

            all_valuation_items.append(ValuationItem(
                id=item_code,
                item_code=item_code,
                name=item_name,
                category=item_cat,
                warehouse=warehouse if (warehouse and warehouse.lower() != "all") else "All Warehouses",
                current_stock=stock,
                unit_cost=round(price, 2),
                stock_value=round(val, 2),
                valuation_method=method,
                percentage_of_total=pct
            ))

        # Sort by stock value descending
        all_valuation_items.sort(key=lambda x: x.stock_value, reverse=True)

        total = len(all_valuation_items)
        total_pages = max(1, (total + limit - 1) // limit)
        start = (page - 1) * limit
        items = all_valuation_items[start:start + limit]

        return ValuationResponse(
            items=items,
            total_stock_value=round(total_valuation, 2),
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
    except Exception as e:
        logger.error(f"Error fetching stock valuation: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stock valuation")


@router.get("/low-stock", response_model=LowStockResponse)
async def get_inventory_low_stock(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    """Items where stock is less than or equal to configured minimum threshold."""
    try:
        raw_items = fetch_inventory_data(warehouse)
        low_items: List[LowStockItem] = []

        for item in raw_items:
            if item.get("_truncated"):
                continue

            item_code = item.get("ItemCode") or ""
            item_name = item.get("ItemName") or ""
            if search and (search.lower() not in item_code.lower() and search.lower() not in item_name.lower()):
                continue

            item_cat = resolve_category_name(item)
            if category and category.lower() not in ("all", "all categories"):
                if item_cat.lower() != category.lower() and str(item.get("ItemsGroupCode")) != category:
                    continue

            stock = extract_item_stock(item, warehouse)
            min_stock = extract_min_stock(item, warehouse)

            # Low stock criteria: stock > 0 and stock <= min_stock
            if 0 < stock <= min_stock:
                deficit = max(0.0, min_stock - stock)
                low_items.append(LowStockItem(
                    id=item_code,
                    item_code=item_code,
                    name=item_name,
                    category=item_cat,
                    warehouse=warehouse if (warehouse and warehouse.lower() != "all") else "All Warehouses",
                    current_stock=stock,
                    min_stock=min_stock,
                    deficit=round(deficit, 2),
                    status="Low Stock"
                ))

        # Sort by deficit descending
        low_items.sort(key=lambda x: x.deficit, reverse=True)

        total = len(low_items)
        total_pages = max(1, (total + limit - 1) // limit)
        start = (page - 1) * limit
        items = low_items[start:start + limit]

        return LowStockResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
    except Exception as e:
        logger.error(f"Error fetching low stock report: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch low stock report")


@router.get("/expiry", response_model=ExpiryResponse)
async def get_inventory_expiry(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    """Fetch real batch numbers and expiration tracking from SAP Business One."""
    client = get_sap_client()
    try:
        res = client.get("BatchNumberDetails", {
            "$select": "DocEntry,ItemCode,ItemDescription,Batch,AdmissionDate,ExpirationDate,Status",
            "$top": 100
        })
        batches = res.get("value", [])

        # Also get serials if batches are scarce
        serials_res = client.get("SerialNumberDetails", {
            "$select": "DocEntry,ItemCode,ItemDescription,SerialNumber,AdmissionDate,ExpirationDate",
            "$top": 50
        })
        serials = serials_res.get("value", [])

        records: List[ExpiryItem] = []
        expiring_count = 0

        for b in batches:
            item_code = b.get("ItemCode") or ""
            item_name = b.get("ItemDescription") or item_code
            if search and (search.lower() not in item_code.lower() and search.lower() not in item_name.lower()):
                continue

            adm_date = (b.get("AdmissionDate") or "")[:10] or None
            exp_date = (b.get("ExpirationDate") or "")[:10] or None
            
            notice = None
            if not exp_date:
                notice = "Expiration Date not configured on batch in SAP"
            else:
                expiring_count += 1

            records.append(ExpiryItem(
                id=f"B-{b.get('DocEntry')}",
                item_code=item_code,
                name=item_name,
                batch_number=b.get("Batch") or "-",
                admission_date=adm_date,
                expiration_date=exp_date,
                status=b.get("Status") or "Active",
                tracking_supported=exp_date is not None,
                notice=notice
            ))

        for s in serials:
            item_code = s.get("ItemCode") or ""
            item_name = s.get("ItemDescription") or item_code
            if search and (search.lower() not in item_code.lower() and search.lower() not in item_name.lower()):
                continue

            adm_date = (s.get("AdmissionDate") or "")[:10] or None
            exp_date = (s.get("ExpirationDate") or "")[:10] or None
            
            notice = None
            if not exp_date:
                notice = "Warranty/Expiration Date not configured on serial in SAP"
            else:
                expiring_count += 1

            records.append(ExpiryItem(
                id=f"S-{s.get('DocEntry')}",
                item_code=item_code,
                name=item_name,
                batch_number=s.get("SerialNumber") or "-",
                admission_date=adm_date,
                expiration_date=exp_date,
                status="Serial Registered",
                tracking_supported=exp_date is not None,
                notice=notice
            ))

        total = len(records)
        total_pages = max(1, (total + limit - 1) // limit)
        start = (page - 1) * limit
        items = records[start:start + limit]

        limitation_notice = (
            "SAP Business One Batch & Serial tracking is active. "
            "For items where expiration dates are unconfigured in SAP Master Data, batches are preserved as active without estimated dates."
        )

        return ExpiryResponse(
            items=items,
            total=total,
            expiring_count=expiring_count,
            page=page,
            limit=limit,
            total_pages=total_pages,
            limitation_notice=limitation_notice
        )
    except Exception as e:
        logger.error(f"Error fetching batch expiry data from SAP: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch batch expiry report")


@router.get("/export")
async def export_inventory_csv(
    tab: str = Query("summary"),
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_permission("reports.view"))
):
    """Generate live CSV export for any of the 5 Inventory Report tabs."""
    output = io.StringIO()
    writer = csv.writer(output)

    clean_tab = tab.lower().replace(" ", "_")

    if clean_tab in ("summary", "stock_summary"):
        writer.writerow(["#", "Product Name", "SKU / ItemCode", "Category", "Warehouse", "Current Stock", "Min Stock", "Stock Value (INR)", "Status", "Last Updated"])
        raw_items = fetch_inventory_data(warehouse)
        idx = 1
        for item in raw_items:
            if item.get("_truncated"): continue
            item_code = item.get("ItemCode") or ""
            item_name = item.get("ItemName") or ""
            if search and (search.lower() not in item_code.lower() and search.lower() not in item_name.lower()):
                continue
            item_cat = resolve_category_name(item)
            if category and category.lower() not in ("all", "all categories"):
                if item_cat.lower() != category.lower() and str(item.get("ItemsGroupCode")) != category:
                    continue
            stock = extract_item_stock(item, warehouse)
            min_stock = extract_min_stock(item, warehouse)
            item_status = calculate_status(stock, min_stock)
            if status and status.lower() != "all" and item_status != status:
                continue
            price = extract_item_price(item)
            writer.writerow([
                idx, item_name, item_code, item_cat,
                warehouse or "All Warehouses", stock, min_stock, round(stock * price, 2),
                item_status.replace("_", " ").title(), datetime.now().strftime("%Y-%m-%d")
            ])
            idx += 1

    elif clean_tab == "stock_movements":
        writer.writerow(["#", "Doc #", "Movement Type", "Date", "Item Code", "Item Name", "Warehouse", "Quantity", "Remarks"])
        client = get_sap_client()
        idx = 1
        # Receipts
        res_in = client.get("InventoryGenEntries", {"$select": "DocNum,DocEntry,DocDate,Comments,DocumentLines", "$top": 500})
        for doc in res_in.get("value", []):
            d_date = (doc.get("DocDate") or "")[:10]
            for l in doc.get("DocumentLines", []):
                writer.writerow([idx, f"GR-{doc.get('DocNum') or doc.get('DocEntry')}", "Stock In", d_date, l.get("ItemCode"), l.get("ItemDescription"), l.get("WarehouseCode"), l.get("Quantity"), doc.get("Comments") or "Goods Receipt"])
                idx += 1
        # Issues
        res_out = client.get("InventoryGenExits", {"$select": "DocNum,DocEntry,DocDate,Comments,DocumentLines", "$top": 500})
        for doc in res_out.get("value", []):
            d_date = (doc.get("DocDate") or "")[:10]
            for l in doc.get("DocumentLines", []):
                writer.writerow([idx, f"GI-{doc.get('DocNum') or doc.get('DocEntry')}", "Stock Out", d_date, l.get("ItemCode"), l.get("ItemDescription"), l.get("WarehouseCode"), -abs(float(l.get("Quantity") or 0.0)), doc.get("Comments") or "Goods Issue"])
                idx += 1

    elif clean_tab == "stock_valuation":
        writer.writerow(["#", "Item Code", "Product Name", "Category", "Warehouse", "Current Stock", "Unit Cost (INR)", "Total Stock Value (INR)", "Valuation Method"])
        raw_items = fetch_inventory_data(warehouse)
        idx = 1
        for item in raw_items:
            if item.get("_truncated"): continue
            item_code = item.get("ItemCode") or ""
            item_name = item.get("ItemName") or ""
            item_cat = resolve_category_name(item)
            stock = extract_item_stock(item, warehouse)
            price = extract_item_price(item)
            method = "Moving Average" if float(item.get("MovingAveragePrice") or 0) > 0 else (
                "Standard Cost" if float(item.get("AvgStdPrice") or 0) > 0 else "Price List Base"
            )
            writer.writerow([idx, item_code, item_name, item_cat, warehouse or "All Warehouses", stock, round(price, 2), round(stock * price, 2), method])
            idx += 1

    elif clean_tab == "low_stock_report":
        writer.writerow(["#", "Item Code", "Product Name", "Category", "Warehouse", "Current Stock", "Min Threshold", "Deficit Qty", "Status"])
        raw_items = fetch_inventory_data(warehouse)
        idx = 1
        for item in raw_items:
            if item.get("_truncated"): continue
            stock = extract_item_stock(item, warehouse)
            min_stock = extract_min_stock(item, warehouse)
            if 0 < stock <= min_stock:
                writer.writerow([idx, item.get("ItemCode"), item.get("ItemName"), resolve_category_name(item), warehouse or "All Warehouses", stock, min_stock, round(min_stock - stock, 2), "Low Stock"])
                idx += 1

    elif clean_tab == "expiry_report":
        writer.writerow(["#", "Batch / Serial #", "Item Code", "Product Name", "Admission Date", "Expiration Date", "Status"])
        client = get_sap_client()
        idx = 1
        res = client.get("BatchNumberDetails", {"$select": "DocEntry,ItemCode,ItemDescription,Batch,AdmissionDate,ExpirationDate,Status", "$top": 100})
        for b in res.get("value", []):
            writer.writerow([idx, b.get("Batch") or "-", b.get("ItemCode"), b.get("ItemDescription"), (b.get("AdmissionDate") or "")[:10], (b.get("ExpirationDate") or "")[:10] or "Not Configured in SAP", b.get("Status") or "Active"])
            idx += 1

    csv_data = output.getvalue()
    filename = f"inventory_{clean_tab}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
