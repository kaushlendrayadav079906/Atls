"""Stock Configuration API Endpoints for ATLAS ERP."""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
import io

from app.core.security import require_permission
from app.services.stock_configuration_service import StockConfigurationService

router = APIRouter()
logger = logging.getLogger(__name__)

_service = StockConfigurationService()


@router.get("")
async def get_stock_configuration(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by SAP Code, Description, or Vendor Name"),
    vendor: Optional[str] = Query(None, description="Filter by Vendor"),
    group: Optional[str] = Query(None, description="Filter by Item Group"),
    warehouse: Optional[str] = Query(None, description="Filter by Warehouse"),
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Retrieve paginated stock configuration items, KPI statistics, filter options, and SAP connection state."""
    try:
        return _service.get_items(
            page=page,
            page_size=page_size,
            search=search,
            vendor=vendor,
            group=group,
            warehouse=warehouse,
        )
    except Exception as e:
        logger.error(f"Error fetching stock configuration items: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock configuration items: {str(e)}")


@router.put("/items/{item_code}")
async def update_stock_item(
    item_code: str,
    data: Dict[str, Any],
    current_user: dict = Depends(require_permission("products.view")),
) -> Dict[str, Any]:
    """Update user-editable stock configuration fields for a row."""
    try:
        updated = _service.update_item(item_code, data)
        return {"success": True, "item": updated}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error updating stock item {item_code}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update stock item: {str(e)}")


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
        result = _service.sync_from_sap()
        return result
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as e:
        logger.error(f"Error during SAP sync: {e}")
        raise HTTPException(status_code=500, detail=f"SAP synchronization failed: {str(e)}")


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
    current_user: dict = Depends(require_permission("products.view")),
):
    """Export filtered stock items into a formatted Excel (.xlsx) workbook preserving all business columns."""
    try:
        excel_bytes = _service.export_excel(search=search, vendor=vendor, group=group, warehouse=warehouse)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="Stock_Configuration_SAP_Items.xlsx"'},
        )
    except Exception as e:
        logger.error(f"Error during Excel export: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export Excel: {str(e)}")
