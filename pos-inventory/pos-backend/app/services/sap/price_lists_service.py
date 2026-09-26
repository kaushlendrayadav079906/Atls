"""SAP Price Lists service - Pricing management"""

from typing import Dict, Any, List, Optional
import logging

from app.services.sap.client import get_sap_client


logger = logging.getLogger(__name__)


class SAPPriceListsService:
    """Service for SAP Price Lists operations"""
    
    def __init__(self):
        self.client = get_sap_client()
    
    def get_price_lists(self) -> List[Dict[str, Any]]:
        """
        Get all price lists from SAP
        
        Returns:
            List of price lists
        """
        try:
            params = {
                "$select": "PriceListNo,PriceListName,IsGrossPrice,Active",
                "$filter": "Active eq 'tYES'",
            }
            
            response = self.client.get("PriceLists", params)
            return response.get("value", [])
            
        except Exception as e:
            logger.error(f"Error fetching price lists: {str(e)}")
            return []
    
    def get_item_price(self, item_code: str, price_list: int) -> Optional[float]:
        """
        Get item price from specific price list
        
        Args:
            item_code: SAP ItemCode
            price_list: Price list number
            
        Returns:
            Price or None
        """
        try:
            endpoint = f"Items('{item_code}')"
            params = {
                "$select": "ItemCode,ItemPrices"
            }
            
            item = self.client.get(endpoint, params)
            item_prices = item.get("ItemPrices", [])
            
            for price_entry in item_prices:
                if price_entry.get("PriceList") == price_list:
                    return price_entry.get("Price")
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching item price: {str(e)}")
            return None
