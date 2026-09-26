"""SAP Warehouses service – Branch/warehouse management"""

from typing import List, Dict, Any
import logging

from app.services.sap.client import get_sap_client

logger = logging.getLogger(__name__)


class SAPWarehousesService:
    """Service for SAP Warehouses (Branches) operations"""

    def __init__(self):
        self.client = get_sap_client()

    def get_warehouses(self) -> List[Dict[str, Any]]:
        """
        Fetch all active (non-inactive) warehouses from SAP.

        Returns:
            List of warehouse dicts with WarehouseCode, WarehouseName, Location
        """
        try:
            params = {
                "$select": "WarehouseCode,WarehouseName,Location,Inactive",
                "$filter": "Inactive eq 'tNO'",
                "$orderby": "WarehouseCode asc",
            }
            response = self.client.get("Warehouses", params)
            return response.get("value", [])
        except Exception as e:
            logger.error(f"Error fetching warehouses from SAP: {e}")
            raise

    def get_warehouse(self, warehouse_code: str) -> Dict[str, Any]:
        """Fetch a single warehouse by its code."""
        try:
            response = self.client.get(f"Warehouses('{warehouse_code}')")
            return response
        except Exception as e:
            logger.error(f"Error fetching warehouse {warehouse_code}: {e}")
            raise
