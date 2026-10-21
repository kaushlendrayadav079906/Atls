"""Common API endpoints for metadata and filter options populated directly from SAP Business One."""

import time
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.services.sap.client import get_sap_client, SAPConnectionError

router = APIRouter()
logger = logging.getLogger(__name__)

_FILTER_CACHE: Optional[Dict[str, Any]] = None
_FILTER_CACHE_TS: float = 0.0
_FILTER_CACHE_TTL = 300.0  # 5 minutes cache

def _fetch_from_sap(client) -> Dict[str, Any]:
    # 1. Customers
    customers = []
    try:
        res = client.get("BusinessPartners?$top=100&$filter=CardType eq 'cCustomer' and Valid eq 'tYES'&$select=CardCode,CardName&$orderby=CardName asc")
        for c in res.get("value", []):
            code = c.get("CardCode")
            name = c.get("CardName")
            if code and name:
                customers.append({"code": code, "id": code, "name": name})
    except Exception as e:
        logger.error(f"Error fetching customers for filter options: {e}")

    # 2. Suppliers
    suppliers = []
    try:
        res = client.get("BusinessPartners?$top=100&$filter=CardType eq 'cSupplier' and Valid eq 'tYES'&$select=CardCode,CardName&$orderby=CardName asc")
        for s in res.get("value", []):
            code = s.get("CardCode")
            name = s.get("CardName")
            if code and name:
                suppliers.append({"code": code, "id": code, "name": name})
    except Exception as e:
        logger.error(f"Error fetching suppliers for filter options: {e}")

    # 3. Buyers / Sales Persons
    buyers = []
    try:
        res = client.get("SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName,Active&$orderby=SalesEmployeeName asc")
        for sp in res.get("value", []):
            code = sp.get("SalesEmployeeCode")
            name = sp.get("SalesEmployeeName")
            if code is not None and name and sp.get("Active") != "tNO":
                buyers.append({"code": str(code), "id": str(code), "name": name})
    except Exception as e:
        logger.error(f"Error fetching buyers for filter options: {e}")

    # 4. Warehouses
    warehouses = []
    try:
        res = client.get("Warehouses?$filter=Inactive eq 'tNO'&$select=WarehouseCode,WarehouseName&$orderby=WarehouseCode asc")
        for wh in res.get("value", []):
            code = wh.get("WarehouseCode")
            name = wh.get("WarehouseName")
            if code:
                warehouses.append({"code": code, "id": code, "name": name or code})
    except Exception as e:
        logger.error(f"Error fetching warehouses for filter options: {e}")

    # 5. Branches (BusinessPlaces)
    branches = []
    try:
        res = client.get("BusinessPlaces?$select=BPLID,BPLName,Disabled&$orderby=BPLName asc")
        for bp in res.get("value", []):
            bpl_id = bp.get("BPLID")
            bpl_name = bp.get("BPLName")
            disabled = bp.get("Disabled")
            if bpl_id is not None and disabled != "tYES":
                branches.append({"id": bpl_id, "code": str(bpl_id), "name": bpl_name or f"Branch {bpl_id}"})
    except Exception as e:
        logger.error(f"Error fetching branches for filter options: {e}")

    statuses = {
        "orders": [
            {"value": "pending", "label": "Pending"},
            {"value": "completed", "label": "Received"},
            {"value": "cancelled", "label": "Cancelled"}
        ],
        "purchase_orders": [
            {"value": "pending", "label": "Pending"},
            {"value": "received", "label": "Received"},
            {"value": "cancelled", "label": "Cancelled"}
        ],
        "invoices": [
            {"value": "open", "label": "Open"},
            {"value": "closed", "label": "Paid / Closed"},
            {"value": "cancelled", "label": "Cancelled"}
        ],
        "production": [
            {"value": "boposPlanned", "label": "Planned"},
            {"value": "boposReleased", "label": "Released"},
            {"value": "boposClosed", "label": "Closed"},
            {"value": "boposCancelled", "label": "Cancelled"}
        ]
    }

    return {
        "customers": customers,
        "suppliers": suppliers,
        "buyers": buyers,
        "warehouses": warehouses,
        "branches": branches,
        "statuses": statuses
    }


@router.get("/filter-options")
def get_filter_options(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns verified SAP dropdown filter options for ATLAS modules.
    Enforces user branch authorization so unauthorized branches are not visible.
    """
    global _FILTER_CACHE, _FILTER_CACHE_TS
    now = time.time()
    
    if _FILTER_CACHE is None or (now - _FILTER_CACHE_TS > _FILTER_CACHE_TTL):
        try:
            client = get_sap_client()
            _FILTER_CACHE = _fetch_from_sap(client)
            _FILTER_CACHE_TS = now
        except Exception as e:
            logger.error(f"Failed to refresh filter options from SAP: {e}")
            if _FILTER_CACHE is None:
                raise HTTPException(status_code=502, detail="SAP Business One filter metadata unavailable.")

    # Branch authorization filtering:
    # If the user is assigned to a specific branch and is not admin, restrict the branch list
    data = dict(_FILTER_CACHE)
    user_branch = current_user.get("branch_id")
    user_role = str(current_user.get("role") or "").lower()
    
    if user_branch and user_role not in ("admin", "administrator"):
        # Restrict visible branches to authorized branch only
        data["branches"] = [b for b in data.get("branches", []) if str(b["id"]) == str(user_branch)]
    
    return data
