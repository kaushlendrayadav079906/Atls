"""Stock Configuration API Endpoints for ATLAS ERP."""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
import io

from app.core.security import require_permission
from app.services.sap.client import SAPConnectionError, SAPValidationError
from app.services.stock_configuration_service import StockConfigurationService

router = APIRouter()
logger = logging.getLogger(__name__)

_service = StockConfigurationService()


@router.get("")
async def get_stock_configuration(
    response: Response,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=10000, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by SAP Code, Description, or Vendor Name"),
    vendor: Optional[str] = Query(None, description="Filter by Vendor"),
    group: Optional[str] = Query(None, description="Filter by Item Group"),
    warehouse: Optional[str] = Query(None, description="Filter by Warehouse"),
    branch: Optional[str] = Query(None, description="Filter by Branch / Warehouse Code"),
    period: Optional[str] = Query(None, description="Filter by Date Period (e.g. today, week, month, year, all)"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    refresh: bool = Query(False, description="Trigger on-demand live stock quantity sync from SAP"),
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Retrieve paginated stock configuration items, KPI statistics, filter options, and SAP connection state."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    role = str(current_user.get("role") or "").strip().lower()
    is_admin = role in ("admin", "administrator")
    if not is_admin:
        user_branch = str(current_user.get("branch_id") or "").strip()
        if user_branch:
            if branch and branch != user_branch and branch.lower() not in ("all", "all branches"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Forbidden: You can only view items for your assigned branch ({user_branch}).",
                )
            branch = user_branch

    try:
        return _service.get_items(
            page=page,
            page_size=page_size,
            search=search,
            vendor=vendor,
            group=group,
            warehouse=warehouse,
            branch=branch,
            period=period,
            date_from=date_from,
            date_to=date_to,
            refresh=refresh,
        )
    except Exception as e:
        logger.error(f"Error fetching stock configuration items: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock configuration items: {str(e)}")


@router.post("/bulk-update")
async def bulk_update_stock_items(
    payload: Dict[str, Any],
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Bulk update stock configuration items with per-row transactional status tracking."""
    items = payload.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="'items' must be a list of item objects.")

    role = str(current_user.get("role") or "").strip().lower()
    is_admin = role in ("admin", "administrator")

    # Permission check: Only Admin users can add or modify remarks
    if not is_admin:
        for item in items:
            if "remark" in item:
                code = item.get("item_code")
                existing_item = _service.get_item(code) if code else None
                incoming_rem = str(item.get("remark") or "").strip()
                existing_rem = str(existing_item.get("remark") or "").strip() if existing_item else ""
                if incoming_rem != existing_rem:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: Only authorized Admin users can add or modify remarks.",
                    )
                item.pop("remark", None)

    admin_user_id = str(current_user.get("username") or current_user.get("sub") or current_user.get("id") or "admin")
    try:
        return _service.bulk_update_items(items, admin_user_id=admin_user_id)
    except Exception as e:
        logger.error(f"Error during bulk update: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute bulk update: {str(e)}")


@router.put("/items/{item_code}")
async def update_stock_item(
    item_code: str,
    data: Dict[str, Any],
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Update user-editable stock configuration fields for a row and automatically sync to SAP."""
    role = str(current_user.get("role") or "").strip().lower()
    is_admin = role in ("admin", "administrator")
    user_branch = str(current_user.get("branch_id") or "").strip()

    # Company / Branch access restriction for non-admins
    if not is_admin and user_branch:
        existing_item = _service.get_item(item_code)
        if existing_item and existing_item.get("warehouse_code") and existing_item.get("warehouse_code") != user_branch:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You can only modify stock items assigned to your branch ({user_branch}).",
            )

    # Permission check: Only Admin users can add or modify remarks
    if "remark" in data and not is_admin:
        existing_item = _service.get_item(item_code)
        incoming_rem = str(data.get("remark") or "").strip()
        existing_rem = str(existing_item.get("remark") or "").strip() if existing_item else ""
        if incoming_rem != existing_rem:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Only authorized Admin users can add or modify remarks.",
            )
        data.pop("remark", None)

    admin_user_id = str(current_user.get("username") or current_user.get("sub") or current_user.get("id") or "admin")
    try:
        updated = _service.update_item(item_code, data, admin_user_id=admin_user_id)
        return {
            "success": updated.get("success", True),
            "partial_success": updated.get("partial_success", False),
            "item": updated.get("item") or updated,
            "item_code": item_code,
            "item_master": updated.get("item_master"),
            "purchase_order": updated.get("purchase_order"),
            "remark": updated.get("remark", ""),
            "last_submitted_at": updated.get("last_submitted_at"),
            "sap_synced": updated.get("sap_synced", False),
            "sap_message": updated.get("sap_message", ""),
            "message": updated.get("message", ""),
        }
    except (ValueError, SAPValidationError) as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except SAPConnectionError as ce:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"SAP Business One Service Layer is unreachable: {str(ce)}")
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(re))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating stock item {item_code}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update stock item: {str(e)}")


@router.get("/items/{item_code}/remarks-history")
async def get_item_remarks_history(
    item_code: str,
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Retrieve audit history of remarks for a stock configuration item."""
    try:
        history = _service.get_remark_history(item_code)
        return {"item_code": item_code, "history": history}
    except Exception as e:
        logger.error(f"Error retrieving remark history for {item_code}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve remark history: {str(e)}")


@router.post("/items")
async def add_stock_item(
    data: Dict[str, Any],
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Manually add a new item to stock configuration."""
    try:
        item = _service.add_item(data)
        return {"success": True, "item": item}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error adding stock item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add stock item: {str(e)}")


@router.delete("/items/{item_code}")
async def delete_stock_item(
    item_code: str,
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Delete an item from stock configuration."""
    try:
        _service.delete_item(item_code)
        return {"success": True, "message": f"Item {item_code} removed successfully."}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        logger.error(f"Error deleting stock item {item_code}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete stock item: {str(e)}")


@router.post("/sync")
async def sync_stock_from_sap(
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Trigger live SAP Business One synchronization for stock items and warehouses."""
    try:
        import asyncio
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, _service.sync_from_sap)
        return result
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as e:
        logger.error(f"Error during SAP sync: {e}")
        raise HTTPException(status_code=500, detail=f"SAP synchronization failed: {str(e)}")


@router.post("/refresh")
async def refresh_stock_from_sap(
    payload: Optional[Dict[str, Any]] = None,
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Fast on-demand live stock quantity sync from SAP Business One without heavy full-table rebuild."""
    try:
        item_codes = None
        if payload and isinstance(payload.get("item_codes"), list):
            item_codes = payload["item_codes"]
        import asyncio
        import functools
        loop = asyncio.get_running_loop()
        func = functools.partial(_service.refresh_live_stock_from_sap, item_codes=item_codes)
        result = await loop.run_in_executor(None, func)
        return result
    except Exception as e:
        logger.error(f"Error during live SAP refresh: {e}")
        raise HTTPException(status_code=500, detail=f"Live SAP refresh failed: {str(e)}")


@router.get("/sync-status")
async def get_sync_status(
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Retrieve the real-time status of the SAP synchronization background worker."""
    from app.services.stock_configuration_service import stock_sync_worker
    sap_health = _service._get_sap_health_status()
    worker_status = stock_sync_worker.get_status()
    return {
        **worker_status,
        "sap_status": sap_health.get("status", "disconnected"),
        "sap_message": sap_health.get("message", ""),
    }


@router.post("/import")
async def import_stock_excel(
    file: UploadFile = File(...),
    preview: bool = Form(True),
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Import stock items from an Excel (.xlsx) or CSV file with validation and preview options."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    ext = file.filename.lower().split(".")[-1]
    if ext not in ["xlsx", "xls", "csv"]:
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV file.")

    try:
        file_bytes = await file.read()
        return _service.import_excel(file_bytes, file.filename, preview=preview)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error during Excel import: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process Excel import: {str(e)}")


@router.get("/export")
async def export_stock_excel(
    search: Optional[str] = Query(None),
    vendor: Optional[str] = Query(None),
    group: Optional[str] = Query(None),
    warehouse: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("products.view")),
):
    """Export filtered stock items into a formatted Excel (.xlsx) workbook preserving all business columns."""
    try:
        excel_bytes = _service.export_excel(
            search=search,
            vendor=vendor,
            group=group,
            warehouse=warehouse,
            branch=branch,
            period=period,
            date_from=date_from,
            date_to=date_to,
        )
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="Stock_Configuration_SAP_Items.xlsx"'},
        )
    except Exception as e:
        logger.error(f"Error during Excel export: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export Excel: {str(e)}")
