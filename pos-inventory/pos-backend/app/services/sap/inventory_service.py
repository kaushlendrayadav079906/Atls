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
        Get all items stock in a warehouse.

        Paginates SAP results via $skip to avoid silent truncation.
        Returns all pages up to a safe maximum (MAX_PAGES). If the SAP
        response would exceed that cap, a warning is logged and callers
        receive the partial result with a ``{"_truncated": True}`` sentinel
        appended so they can surface an explicit incomplete-data state. Page
        failures propagate so callers cannot treat partial pages as complete.
        """
        PAGE_SIZE = 500
        MAX_PAGES = 20  # cap at 10 000 items; raise once confirmed with client
        all_items: List[Dict[str, Any]] = []
        skip = 0

        for page_num in range(MAX_PAGES):
            try:
                params = {
                    "$select": "ItemCode,ItemName,QuantityOnStock,ItemWarehouseInfoCollection",
                    "$top": PAGE_SIZE,
                    "$skip": skip,
                }
                response = self.client.get("Items", params)
            except Exception as e:
                logger.error(f"Error fetching warehouse stock (page {page_num}, skip={skip}): {e}")
                raise

            page = response.get("value", [])
            all_items.extend(page)
            if len(page) < PAGE_SIZE:
                break  # Last page – done
            skip += PAGE_SIZE
        else:
            # Loop exhausted MAX_PAGES without reaching end
            logger.warning(
                "get_warehouse_stock: result cap reached (warehouse=%r, max_items=%d). "
                "Increase MAX_PAGES or add a tighter filter.",
                warehouse, MAX_PAGES * PAGE_SIZE,
            )
            all_items.append({"_truncated": True})

        return all_items

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
