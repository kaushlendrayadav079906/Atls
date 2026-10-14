import time
import threading
from typing import List, Dict, Any, Optional, Tuple
import logging

from app.services.sap.client import get_sap_client

logger = logging.getLogger(__name__)

_WAREHOUSES_CACHE: Optional[Tuple[List[Dict[str, Any]], float]] = None
_WAREHOUSES_CACHE_LOCK = threading.Lock()
_WAREHOUSES_CACHE_TTL = 3600.0  # 1 hour


class SAPWarehousesService:
    """Service for SAP Warehouses (Branches) operations"""

    def __init__(self):
        self.client = get_sap_client()

    def get_warehouses(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Fetch all active (non-inactive) warehouses from SAP with 1-hour in-memory cache.

        Returns:
            List of warehouse dicts with WarehouseCode, WarehouseName, Location
        """
        global _WAREHOUSES_CACHE
        now = time.time()
        if not force_refresh:
            with _WAREHOUSES_CACHE_LOCK:
                if _WAREHOUSES_CACHE is not None:
                    data, timestamp = _WAREHOUSES_CACHE
                    if now - timestamp < _WAREHOUSES_CACHE_TTL:
                        return data

        try:
            params = {
                "$select": "WarehouseCode,WarehouseName,Location,Inactive",
                "$filter": "Inactive eq 'tNO'",
                "$orderby": "WarehouseCode asc",
            }
            response = self.client.get("Warehouses", params)
            wh_list = response.get("value", [])
            with _WAREHOUSES_CACHE_LOCK:
                _WAREHOUSES_CACHE = (wh_list, now)
            return wh_list
        except Exception as e:
            logger.error(f"Error fetching warehouses from SAP: {e}")
            with _WAREHOUSES_CACHE_LOCK:
                if _WAREHOUSES_CACHE is not None:
                    return _WAREHOUSES_CACHE[0]
            raise

    def get_warehouse(self, warehouse_code: str) -> Dict[str, Any]:
        """Fetch a single warehouse by its code."""
        try:
            response = self.client.get(f"Warehouses('{warehouse_code}')")
            return response
        except Exception as e:
            logger.error(f"Error fetching warehouse {warehouse_code}: {e}")
            raise
