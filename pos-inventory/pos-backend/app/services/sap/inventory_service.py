"""SAP Inventory service - Stock management"""

from typing import Dict, Any, List, Optional
import logging

from app.services.sap.client import get_sap_client


logger = logging.getLogger(__name__)


class SAPInventoryService:
    """Service for SAP Inventory operations"""
    
    def __init__(self):
        self.client = get_sap_client()
    
    def get_item_stock(self, item_code: str, warehouse: Optional[str] = None) -> float:
        """
        Get item stock quantity
        
        Args:
            item_code: SAP ItemCode
            warehouse: Warehouse code (optional)
            
        Returns:
            Stock quantity
        """
        try:
            # Get item with warehouse info
            endpoint = f"Items('{item_code}')"
            params = {
                "$select": "ItemCode,QuantityOnStock,ItemWarehouseInfoCollection"
            }
            
            item = self.client.get(endpoint, params)
            
            if not warehouse:
                return item.get("QuantityOnStock", 0.0)
            
            # Get warehouse-specific stock
            warehouses = item.get("ItemWarehouseInfoCollection", [])
            for wh in warehouses:
                if wh.get("WarehouseCode") == warehouse:
                    return wh.get("InStock", 0.0)
            
            return 0.0
            
        except Exception as e:
            logger.error(f"Error fetching stock for item {item_code}: {str(e)}")
            return 0.0
    
    def get_warehouse_stock(self, warehouse: str) -> List[Dict[str, Any]]:
        """
        Get all items stock in a warehouse
        
        Args:
            warehouse: Warehouse code
            
        Returns:
            List of items with stock info
        """
        try:
            params = {
                "$filter": f"ItemWarehouseInfoCollection/any(w: w/WarehouseCode eq '{warehouse}')",
                "$select": "ItemCode,ItemName,QuantityOnStock,ItemWarehouseInfoCollection",
                "$top": 1000,
            }
            
            response = self.client.get("Items", params)
            return response.get("value", [])
            
        except Exception as e:
            logger.error(f"Error fetching warehouse stock: {str(e)}")
            return []
    
    def check_stock_availability(self, item_code: str, quantity: float, 
                                 warehouse: Optional[str] = None) -> bool:
        """
        Check if sufficient stock is available
        
        Args:
            item_code: SAP ItemCode
            quantity: Required quantity
            warehouse: Warehouse code (optional)
            
        Returns:
            True if stock available
        """
        try:
            current_stock = self.get_item_stock(item_code, warehouse)
            return current_stock >= quantity
            
        except Exception as e:
            logger.error(f"Error checking stock availability: {str(e)}")
            return False
