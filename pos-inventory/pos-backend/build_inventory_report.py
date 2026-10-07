import os
import sys

BACKEND_DIR = r"c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\pos-backend"

INVENTORY_REPORT_ROUTER = """
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field
from app.api.v1.auth import get_current_user
from app.services.sap.client import get_sap_client
from app.services.sap.inventory_service import SAPInventoryService
from app.services.sap.items_service import SAPItemsService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

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

# Helper functions to fetch data
def fetch_inventory_data(warehouse: Optional[str] = None):
    # This is an expensive operation if we fetch all items, so we'll use the items service or inventory service.
    # We will use SAPItemsService to get a cached/paged list or InventoryService.get_warehouse_stock
    inv_service = SAPInventoryService()
    items_service = SAPItemsService()
    
    if warehouse:
        raw_items = inv_service.get_warehouse_stock(warehouse)
    else:
        # In a real heavy environment we might not want to fetch all, but for this report we need it.
        # Let's get up to a reasonable limit or use the items service
        raw_items = items_service.get_items(top=2000)
        
    return raw_items

def calculate_status(current_stock: float, min_stock: float) -> str:
    if current_stock <= 0:
        return "out_of_stock"
    if current_stock <= min_stock:
        return "low_stock"
    return "in_stock"


@router.get("/overview", response_model=KPIOverviewResponse)
async def get_inventory_overview(
    warehouse: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        raw_items = fetch_inventory_data(warehouse)
        
        total_products = len([i for i in raw_items if not i.get("_truncated")])
        total_stock_value = 0.0
        low_stock_items = 0
        out_of_stock = 0
        
        for item in raw_items:
            if item.get("_truncated"): continue
            
            stock = 0.0
            price = 0.0
            
            # Extract stock
            if warehouse:
                warehouses = item.get("ItemWarehouseInfoCollection", [])
                for wh in warehouses:
                    if wh.get("WarehouseCode") == warehouse:
                        stock = float(wh.get("InStock", 0.0))
                        break
            else:
                stock = float(item.get("QuantityOnStock", 0.0))
                
            # Extract price for value calculation (AvgStdPrice as fallback)
            price = float(item.get("AvgStdPrice", 0.0))
            if price == 0:
                price = float(item.get("MovingAveragePrice", 0.0))
            
            total_stock_value += (stock * price)
            
            # Simple min stock logic (SAP UDF or fallback)
            min_stock = 10.0 # Example fallback if not in SAP
            
            status = calculate_status(stock, min_stock)
            if status == "out_of_stock":
                out_of_stock += 1
            elif status == "low_stock":
                low_stock_items += 1
                
        return KPIOverviewResponse(
            total_products=total_products,
            total_stock_value=total_stock_value,
            low_stock_items=low_stock_items,
            out_of_stock=out_of_stock,
            expiring_soon=0 # Not tracking expiry in this basic implementation
        )
    except Exception as e:
        logger.error(f"Error fetching inventory overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch inventory overview")

@router.get("/distribution", response_model=StatusDistributionResponse)
async def get_inventory_distribution(
    warehouse: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        raw_items = fetch_inventory_data(warehouse)
        
        in_stock = 0
        low_stock = 0
        out_of_stock = 0
        expiring = 0 # Not implemented
        
        for item in raw_items:
            if item.get("_truncated"): continue
            
            stock = 0.0
            if warehouse:
                warehouses = item.get("ItemWarehouseInfoCollection", [])
                for wh in warehouses:
                    if wh.get("WarehouseCode") == warehouse:
                        stock = float(wh.get("InStock", 0.0))
                        break
            else:
                stock = float(item.get("QuantityOnStock", 0.0))
                
            min_stock = 10.0 
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
    current_user: dict = Depends(get_current_user)
):
    try:
        raw_items = fetch_inventory_data(warehouse)
        
        category_values = {}
        
        for item in raw_items:
            if item.get("_truncated"): continue
            
            category = item.get("U_SUBG") or item.get("ItemsGroupCode") or "Others"
            if isinstance(category, int):
                category = str(category)
                
            stock = 0.0
            if warehouse:
                warehouses = item.get("ItemWarehouseInfoCollection", [])
                for wh in warehouses:
                    if wh.get("WarehouseCode") == warehouse:
                        stock = float(wh.get("InStock", 0.0))
                        break
            else:
                stock = float(item.get("QuantityOnStock", 0.0))
                
            price = float(item.get("AvgStdPrice", 0.0))
            if price == 0:
                price = float(item.get("MovingAveragePrice", 0.0))
                
            val = stock * price
            
            if category not in category_values:
                category_values[category] = 0.0
            category_values[category] += val
            
        # Sort and limit
        sorted_cats = sorted(category_values.items(), key=lambda x: x[1], reverse=True)
        
        if limit > 0:
            sorted_cats = sorted_cats[:limit]
            
        result = [CategoryValue(category=k, stock_value=v) for k, v in sorted_cats]
        return CategoryValueResponse(categories=result)
        
    except Exception as e:
        logger.error(f"Error fetching inventory value by category: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch inventory value by category")

@router.get("/movements", response_model=MovementsResponse)
async def get_inventory_movements(
    warehouse: Optional[str] = None,
    days: int = Query(7),
    current_user: dict = Depends(get_current_user)
):
    # As per instructions, if movement data is genuinely unavailable, return explicit unavailable state.
    # SAP Stock movements require querying InventoryGenEntries/Exits or OINM table which is complex.
    return MovementsResponse(
        data=[],
        status="unavailable",
        message="Stock movement detailed history requires SAP OINM view or InventoryGenEntries/Exits access which is not fully configured in the current SAP Service Layer metadata."
    )

@router.get("/products", response_model=ProductsResponse)
async def get_inventory_products(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        raw_items = fetch_inventory_data(warehouse)
        
        filtered_items = []
        for item in raw_items:
            if item.get("_truncated"): continue
            
            item_code = item.get("ItemCode", "")
            item_name = item.get("ItemName", "")
            barcode = item.get("BarCode", "")
            
            if search:
                search_lower = search.lower()
                if search_lower not in item_code.lower() and search_lower not in item_name.lower() and search_lower not in str(barcode).lower():
                    continue
                    
            item_category = str(item.get("U_SUBG") or item.get("ItemsGroupCode") or "Others")
            if category and category.lower() != "all categories" and category.lower() != "all" and item_category != category:
                continue
                
            stock = 0.0
            if warehouse:
                warehouses = item.get("ItemWarehouseInfoCollection", [])
                for wh in warehouses:
                    if wh.get("WarehouseCode") == warehouse:
                        stock = float(wh.get("InStock", 0.0))
                        break
            else:
                stock = float(item.get("QuantityOnStock", 0.0))
                
            min_stock = 10.0
            item_status = calculate_status(stock, min_stock)
            
            if status and status.lower() != "all":
                if status == "in_stock" and item_status != "in_stock": continue
                if status == "low_stock" and item_status != "low_stock": continue
                if status == "out_of_stock" and item_status != "out_of_stock": continue
                
            price = float(item.get("AvgStdPrice", 0.0))
            if price == 0:
                price = float(item.get("MovingAveragePrice", 0.0))
                
            filtered_items.append(ProductItem(
                id=item_code,
                item_code=item_code,
                name=item_name,
                sku=item_code,
                category=item_category,
                warehouse=warehouse or "All Warehouses",
                current_stock=stock,
                min_stock=min_stock,
                stock_value=stock * price,
                status=item_status,
                last_updated=datetime.now().strftime("%Y-%m-%d %H:%M:%S") # SAP LastUpdated not always exposed
            ))
            
        total = len(filtered_items)
        total_pages = (total + limit - 1) // limit
        
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

"""

def patch_backend():
    router_path = os.path.join(BACKEND_DIR, "app", "api", "v1", "inventory_report.py")
    with open(router_path, "w") as f:
        f.write(INVENTORY_REPORT_ROUTER)
    
    init_path = os.path.join(BACKEND_DIR, "app", "api", "v1", "__init__.py")
    with open(init_path, "r") as f:
        init_content = f.read()
    
    if "inventory_report" not in init_content:
        init_content = init_content.replace(
            "from app.api.v1 import auth",
            "from app.api.v1 import auth, inventory_report"
        )
        init_content += '\nrouter.include_router(inventory_report.router, prefix="/reports/inventory", tags=["Inventory Reports"])\n'
        
        with open(init_path, "w") as f:
            f.write(init_content)
    
    print("Backend patched successfully")

if __name__ == "__main__":
    patch_backend()
