"""Google Sheets Integration API Endpoints

Provides secure endpoints for:
- Connection verification and testing
- Worksheet listing
- Column header preview
- Stock Configuration data retrieval (Read-Only)
- Integration configuration storage and status tracking
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.security import get_current_user
from app.schemas.google_sheets import (
    GoogleSheetsBulkStockResponse,
    GoogleSheetsBulkUpdateStockRequest,
    GoogleSheetsConnectRequest,
    GoogleSheetsConfigRequest,
    GoogleSheetsCreateStockRecordRequest,
    GoogleSheetsHeadersResponse,
    GoogleSheetsSingleRecordResponse,
    GoogleSheetsStatusResponse,
    GoogleSheetsStockRecordsResponse,
    GoogleSheetsTestRequest,
    GoogleSheetsTestResponse,
    GoogleSheetsUpdateStockRecordRequest,
    GoogleSheetsWorksheetsResponse,
    WorksheetItem,
)
from app.services.google_sheets_service import (
    GoogleSheetsServiceError,
    extract_spreadsheet_id,
    google_sheets_service,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_company_id(current_user: Dict[str, Any]) -> str:
    """Extract company/tenant ID from user or default to SAP Company DB."""
    return str(
        current_user.get("company_id")
        or getattr(settings, "SAP_COMPANY_DB", "default")
        or "default"
    )


def _check_settings_permission(current_user: Dict[str, Any]) -> None:
    """Ensure user is either an admin or possesses settings/products privileges."""
    role = str(current_user.get("role") or "").strip().lower()
    if role in ("admin", "administrator"):
        return
    perms = set(current_user.get("permissions") or [])
    if (
        "*" in perms
        or "settings.view" in perms
        or "settings.manage" in perms
        or "products.view" in perms
        or "products.manage" in perms
        or "products.edit" in perms
    ):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to manage Google Sheets integrations. Requires Administrator or Settings privileges.",
    )


def _check_view_permission(current_user: Dict[str, Any]) -> None:
    """Ensure user has permission to view stock or settings."""
    role = str(current_user.get("role") or "").strip().lower()
    if role in ("admin", "administrator"):
        return
    perms = set(current_user.get("permissions") or [])
    if "*" in perms or "products.view" in perms or "settings.view" in perms:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to view Stock records.",
    )


def _check_edit_permission(current_user: Dict[str, Any]) -> None:
    """Ensure user has permission to create or edit stock records."""
    role = str(current_user.get("role") or "").strip().lower()
    if role in ("admin", "administrator"):
        return
    perms = set(current_user.get("permissions") or [])
    if (
        "*" in perms
        or "products.edit" in perms
        or "products.manage" in perms
        or "settings.manage" in perms
    ):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to modify Stock records. Requires Products Edit or Administrator privileges.",
    )


# ------------------------------------------------------------------------------
# 1. Status
# ------------------------------------------------------------------------------

@router.get(
    "/status",
    response_model=GoogleSheetsStatusResponse,
    summary="Get Google Sheets integration status",
)
async def get_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsStatusResponse:
    """Retrieve the current connection state, active configuration, and service account health."""
    _check_view_permission(current_user)
    company_id = _get_company_id(current_user)

    cfg = google_sheets_service.get_configuration(company_id)
    sa_configured = google_sheets_service.is_service_account_configured()
    sa_email = google_sheets_service.get_service_account_email()

    spreadsheet_id = cfg.get("spreadsheet_id")
    worksheets_list: list[str] = []
    connection_status = cfg.get("connection_status") or "not_connected"
    error_message = cfg.get("last_error")
    activation_url = None

    if not sa_configured:
        connection_status = "authentication_failed"
        error_message = error_message or "Google Service Account credentials file not found or empty."
    elif not spreadsheet_id:
        connection_status = "configuration_missing"
    elif connection_status == "api_not_enabled":
        if error_message:
            url_match = re.search(r"https?://[^\s\"']+", error_message)
            if url_match:
                activation_url = url_match.group(0).rstrip(".")
        if not activation_url:
            activation_url = "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview"

    # If configured and connected, attempt to fetch current sheet names
    if spreadsheet_id and connection_status == "connected" and sa_configured:
        try:
            ws_items = google_sheets_service.get_worksheets(spreadsheet_id)
            worksheets_list = [w["name"] for w in ws_items]
        except Exception:
            pass

    # Determine verified permission mode
    is_ro = getattr(settings, "GOOGLE_SHEETS_READ_ONLY", False)
    perm_mode = "not_verified"
    if connection_status == "connected":
        perm_mode = "read_only" if is_ro else "read_write"

    return GoogleSheetsStatusResponse(
        configured=bool(spreadsheet_id),
        connection_status=connection_status,
        spreadsheet_id=spreadsheet_id,
        spreadsheet_name=cfg.get("spreadsheet_name"),
        spreadsheet_url=cfg.get("spreadsheet_url"),
        worksheet_name=cfg.get("worksheet_name"),
        header_row=cfg.get("header_row", 1),
        data_start_row=cfg.get("data_start_row", 2),
        last_tested_at=cfg.get("last_tested_at"),
        last_successful_sync_at=cfg.get("last_successful_sync_at"),
        service_account_configured=sa_configured,
        service_account_email=sa_email,
        error_message=error_message,
        worksheets=worksheets_list,
        activation_url=activation_url,
        read_only=is_ro,
        permission_mode=perm_mode,
    )


# ------------------------------------------------------------------------------
# 2. Connect
# ------------------------------------------------------------------------------

@router.post(
    "/connect",
    response_model=GoogleSheetsTestResponse,
    summary="Connect and verify a Google Spreadsheet",
)
async def connect_sheet(
    payload: GoogleSheetsConnectRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsTestResponse:
    """
    Validate spreadsheet URL or ID, verify API access, load spreadsheet metadata,
    and update the connection status to 'connected'.
    """
    _check_settings_permission(current_user)
    company_id = _get_company_id(current_user)

    raw_input = payload.spreadsheet_url or payload.spreadsheet_id
    if not raw_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a Google Sheets URL or Spreadsheet ID.",
        )

    try:
        spreadsheet_id = extract_spreadsheet_id(raw_input)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message, "connection_status": exc.connection_status},
        )

    try:
        test_result = google_sheets_service.test_connection(
            company_id=company_id,
            spreadsheet_id=spreadsheet_id,
        )

        current_cfg = google_sheets_service.get_configuration(company_id)
        current_cfg["spreadsheet_id"] = spreadsheet_id
        if payload.spreadsheet_url:
            current_cfg["spreadsheet_url"] = payload.spreadsheet_url
        if test_result.get("spreadsheet_name"):
            current_cfg["spreadsheet_name"] = test_result["spreadsheet_name"]
        current_cfg["connection_status"] = "connected"
        current_cfg["last_error"] = None
        google_sheets_service.save_configuration(company_id, current_cfg)

        return GoogleSheetsTestResponse(
            success=True,
            connection_status="connected",
            spreadsheet_id=spreadsheet_id,
            spreadsheet_name=test_result.get("spreadsheet_name"),
            worksheets=test_result.get("worksheets", []),
            service_account_email=test_result.get("service_account_email"),
            message=f"Connected successfully to spreadsheet '{test_result.get('spreadsheet_name')}'.",
            tested_at=test_result.get("tested_at", ""),
        )

    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
                "service_account_email": exc.details.get("service_account_email"),
            },
        )
    except Exception as exc:
        logger.error("Unexpected error connecting to Google Sheet: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while connecting to Google Sheets: {str(exc)}",
        )


# ------------------------------------------------------------------------------
# 3. Test Connection
# ------------------------------------------------------------------------------

@router.post(
    "/test",
    response_model=GoogleSheetsTestResponse,
    summary="Test Google Sheets connection diagnostics",
)
async def test_connection(
    payload: Optional[GoogleSheetsTestRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsTestResponse:
    """Run an on-demand diagnostic test on the configured or provided spreadsheet."""
    _check_settings_permission(current_user)
    company_id = _get_company_id(current_user)

    target_id: Optional[str] = None
    target_worksheet: Optional[str] = None
    target_header_row: int = 1

    if payload:
        target_worksheet = payload.worksheet_name
        target_header_row = payload.header_row or 1
        if payload.spreadsheet_url:
            try:
                target_id = extract_spreadsheet_id(payload.spreadsheet_url)
            except GoogleSheetsServiceError as exc:
                raise HTTPException(
                    status_code=exc.status_code,
                    detail={"message": exc.message, "connection_status": exc.connection_status},
                )
        elif payload.spreadsheet_id:
            try:
                target_id = extract_spreadsheet_id(payload.spreadsheet_id)
            except GoogleSheetsServiceError as exc:
                raise HTTPException(
                    status_code=exc.status_code,
                    detail={"message": exc.message, "connection_status": exc.connection_status},
                )

    try:
        result = google_sheets_service.test_connection(
            company_id=company_id,
            spreadsheet_id=target_id,
            worksheet_name=target_worksheet,
            header_row=target_header_row,
        )
        return GoogleSheetsTestResponse(**result)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
                "service_account_email": exc.details.get("service_account_email"),
            },
        )
    except Exception as exc:
        logger.error("Connection test failure: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Connection test failed: {str(exc)}",
        )


# ------------------------------------------------------------------------------
# 4. Worksheets
# ------------------------------------------------------------------------------

@router.get(
    "/worksheets",
    response_model=GoogleSheetsWorksheetsResponse,
    summary="Fetch available worksheets in the spreadsheet",
)
async def get_worksheets(
    spreadsheet_id: Optional[str] = Query(None, description="Optional override spreadsheet ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsWorksheetsResponse:
    """List all worksheet tabs within the configured Google Sheet."""
    _check_view_permission(current_user)
    company_id = _get_company_id(current_user)

    target_id = spreadsheet_id
    if not target_id:
        cfg = google_sheets_service.get_configuration(company_id)
        target_id = cfg.get("spreadsheet_id")

    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No spreadsheet is currently configured. Please connect a spreadsheet first.",
        )

    try:
        target_id = extract_spreadsheet_id(target_id)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    try:
        cfg = google_sheets_service.get_configuration(company_id)
        sheet_title = cfg.get("spreadsheet_name") or "Spreadsheet"

        items = google_sheets_service.get_worksheets(target_id)
        ws_items = [
            WorksheetItem(
                name=it["name"],
                index=it["index"],
                row_count=it.get("row_count"),
                column_count=it.get("column_count"),
            )
            for it in items
        ]

        return GoogleSheetsWorksheetsResponse(
            spreadsheet_id=target_id,
            spreadsheet_name=sheet_title,
            worksheets=ws_items,
        )
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
            },
        )
    except Exception as exc:
        logger.error("Failed to fetch worksheets: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch worksheets: {str(exc)}",
        )


# ------------------------------------------------------------------------------
# 5. Headers Preview
# ------------------------------------------------------------------------------

@router.get(
    "/headers",
    response_model=GoogleSheetsHeadersResponse,
    summary="Preview column headers from selected worksheet",
)
async def get_headers(
    worksheet_name: str = Query(..., description="Target worksheet tab name"),
    header_row: int = Query(1, ge=1, description="Row number containing column headers (1-based)"),
    spreadsheet_id: Optional[str] = Query(None, description="Optional override spreadsheet ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsHeadersResponse:
    """Fetch column headers from the selected worksheet."""
    _check_view_permission(current_user)
    company_id = _get_company_id(current_user)

    target_id = spreadsheet_id
    if not target_id:
        cfg = google_sheets_service.get_configuration(company_id)
        target_id = cfg.get("spreadsheet_id")

    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No spreadsheet is configured. Please connect a spreadsheet first.",
        )

    try:
        target_id = extract_spreadsheet_id(target_id)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    try:
        headers_info = google_sheets_service.get_headers(
            spreadsheet_id=target_id,
            worksheet_name=worksheet_name,
            header_row=header_row,
        )
        return GoogleSheetsHeadersResponse(**headers_info)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
            },
        )
    except Exception as exc:
        logger.error("Failed to fetch headers: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch headers: {str(exc)}",
        )


# ------------------------------------------------------------------------------
# 6. Stock Configuration Data Retrieval (Read-Only)
# ------------------------------------------------------------------------------

@router.get(
    "/stock-records",
    response_model=GoogleSheetsStockRecordsResponse,
    summary="Fetch Stock Configuration records from Google Sheets (Read-Only)",
)
@router.get(
    "/records",
    response_model=GoogleSheetsStockRecordsResponse,
    include_in_schema=False,
)
async def get_stock_records(
    worksheet_name: Optional[str] = Query(None, description="Target worksheet tab name (defaults to configured)"),
    header_row: Optional[int] = Query(None, ge=1, description="Header row index"),
    data_start_row: Optional[int] = Query(None, ge=2, description="Data start row index"),
    limit: int = Query(100, ge=1, le=1000, description="Max rows to fetch for preview"),
    spreadsheet_id: Optional[str] = Query(None, description="Optional override spreadsheet ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsStockRecordsResponse:
    """
    Read-only retrieval of Stock Configuration records from the connected Google Sheet.
    Dynamically maps the 22 expected fields to spreadsheet headers.
    """
    _check_view_permission(current_user)
    company_id = _get_company_id(current_user)

    cfg = google_sheets_service.get_configuration(company_id)
    target_id = spreadsheet_id or cfg.get("spreadsheet_id")

    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No spreadsheet is configured. Please connect a spreadsheet first.",
        )

    try:
        target_id = extract_spreadsheet_id(target_id)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    target_ws = worksheet_name or cfg.get("worksheet_name") or "Stock Configuration"
    h_row = header_row if header_row is not None else cfg.get("header_row", 1)
    d_row = data_start_row if data_start_row is not None else cfg.get("data_start_row", 2)

    try:
        data = google_sheets_service.get_stock_configuration_records(
            spreadsheet_id=target_id,
            worksheet_name=target_ws,
            header_row=h_row,
            data_start_row=d_row,
            limit=limit,
        )
        return GoogleSheetsStockRecordsResponse(**data)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
            },
        )
    except Exception as exc:
        logger.error("Failed to fetch stock records from Google Sheet: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stock records: {str(exc)}",
        )


# ------------------------------------------------------------------------------
# 7. Save Configuration
# ------------------------------------------------------------------------------

@router.post(
    "/configuration",
    response_model=GoogleSheetsStatusResponse,
    summary="Save Google Sheets integration settings",
)
async def save_configuration(
    payload: GoogleSheetsConfigRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsStatusResponse:
    """Save or update spreadsheet mapping parameters with row validation."""
    _check_settings_permission(current_user)
    company_id = _get_company_id(current_user)

    try:
        validated_id = extract_spreadsheet_id(payload.spreadsheet_id)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    current_cfg = google_sheets_service.get_configuration(company_id)
    merged_data = {
        **current_cfg,
        "spreadsheet_id": validated_id,
        "spreadsheet_url": payload.spreadsheet_url or current_cfg.get("spreadsheet_url"),
        "spreadsheet_name": payload.spreadsheet_name or current_cfg.get("spreadsheet_name"),
        "worksheet_name": payload.worksheet_name or current_cfg.get("worksheet_name"),
        "header_row": payload.header_row,
        "data_start_row": payload.data_start_row,
    }

    try:
        saved = google_sheets_service.save_configuration(company_id, merged_data)
        sa_configured = google_sheets_service.is_service_account_configured()
        sa_email = google_sheets_service.get_service_account_email()

        conn_st = saved.get("connection_status") or "connected"
        is_ro = getattr(settings, "GOOGLE_SHEETS_READ_ONLY", False)
        perm_mode = "not_verified"
        if conn_st == "connected":
            perm_mode = "read_only" if is_ro else "read_write"

        return GoogleSheetsStatusResponse(
            configured=bool(saved.get("spreadsheet_id")),
            connection_status=conn_st,
            spreadsheet_id=saved.get("spreadsheet_id"),
            spreadsheet_name=saved.get("spreadsheet_name"),
            spreadsheet_url=saved.get("spreadsheet_url"),
            worksheet_name=saved.get("worksheet_name"),
            header_row=saved.get("header_row", 1),
            data_start_row=saved.get("data_start_row", 2),
            last_tested_at=saved.get("last_tested_at"),
            last_successful_sync_at=saved.get("last_successful_sync_at"),
            service_account_configured=sa_configured,
            service_account_email=sa_email,
            error_message=saved.get("last_error"),
            read_only=is_ro,
            permission_mode=perm_mode,
        )
    except GoogleSheetsServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        logger.error("Failed to save Google Sheets configuration: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save configuration: {str(exc)}",
        )


# ------------------------------------------------------------------------------
# 8. Disconnect
# ------------------------------------------------------------------------------

@router.delete(
    "/disconnect",
    summary="Disconnect Google Sheets integration",
)
async def disconnect(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Disconnect active Google Sheet, reset status, and clear configured spreadsheet reference."""
    _check_settings_permission(current_user)
    company_id = _get_company_id(current_user)

    try:
        google_sheets_service.disconnect(company_id)
        return {
            "status": "not_connected",
            "message": "Google Sheets integration has been disconnected.",
        }
    except Exception as exc:
        logger.error("Failed to disconnect Google Sheets: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect Google Sheets: {str(exc)}",
        )


# ------------------------------------------------------------------------------
# 9. Stock Configuration Writes (Phase 2)
# ------------------------------------------------------------------------------

@router.post(
    "/stock-records",
    response_model=GoogleSheetsSingleRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Stock Configuration record in Google Sheets",
)
async def create_stock_record(
    payload: GoogleSheetsCreateStockRecordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsSingleRecordResponse:
    """
    Append a new Stock Configuration record directly to the configured Google Sheet.
    Generates a unique Record ID if not supplied.
    Strictly writes to Google Sheets; never writes to SAP Business One.
    """
    _check_edit_permission(current_user)
    company_id = _get_company_id(current_user)

    try:
        data = google_sheets_service.create_stock_configuration_record(
            company_id=company_id,
            data=payload.dict(),
            current_user=current_user,
        )
        return GoogleSheetsSingleRecordResponse(**data)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
            },
        )
    except Exception as exc:
        logger.error("Failed to create stock record in Google Sheet: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stock record: {str(exc)}",
        )


@router.put(
    "/stock-records/{record_id}",
    response_model=GoogleSheetsSingleRecordResponse,
    summary="Update an existing Stock Configuration record in Google Sheets",
)
async def update_stock_record(
    record_id: str,
    payload: GoogleSheetsUpdateStockRecordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsSingleRecordResponse:
    """
    Update permitted fields of an existing Stock Configuration row in Google Sheets
    identified by its permanent Record ID (or item_code).
    Enforces optimistic concurrency checks if expected_updated_at is provided.
    Strictly writes to Google Sheets; never writes to SAP Business One.
    """
    _check_edit_permission(current_user)
    company_id = _get_company_id(current_user)

    try:
        data = google_sheets_service.update_stock_configuration_record(
            company_id=company_id,
            record_id=record_id,
            data=payload.dict(exclude_unset=True),
            current_user=current_user,
        )
        return GoogleSheetsSingleRecordResponse(**data)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
            },
        )
    except Exception as exc:
        logger.error("Failed to update stock record in Google Sheet: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update stock record: {str(exc)}",
        )


@router.post(
    "/stock-records/bulk",
    response_model=GoogleSheetsBulkStockResponse,
    summary="Bulk update multiple Stock Configuration records in Google Sheets",
)
@router.put(
    "/stock-records/bulk",
    response_model=GoogleSheetsBulkStockResponse,
    summary="Bulk update multiple Stock Configuration records in Google Sheets",
)
async def bulk_update_stock_records(
    payload: GoogleSheetsBulkUpdateStockRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GoogleSheetsBulkStockResponse:
    """
    Bulk update modified or all stock configuration records in Google Sheets using a single batch update call.
    Tracks and returns per-record success and error statuses.
    Strictly writes to Google Sheets; never writes to SAP Business One.
    """
    _check_edit_permission(current_user)
    company_id = _get_company_id(current_user)

    try:
        data = google_sheets_service.bulk_update_stock_configuration_records(
            company_id=company_id,
            items=payload.items,
            current_user=current_user,
        )
        return GoogleSheetsBulkStockResponse(**data)
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
            },
        )
    except Exception as exc:
        logger.error("Failed to bulk update stock records in Google Sheet: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update stock records: {str(exc)}",
        )


@router.post(
    "/stock-records/refresh",
    summary="Refresh stock configuration records from Google Sheets",
)
async def refresh_stock_records(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Force reload stock configuration records from Google Sheets and update last sync timestamp.
    """
    _check_view_permission(current_user)
    company_id = _get_company_id(current_user)

    try:
        return google_sheets_service.refresh_stock_configuration_records(
            company_id=company_id,
            current_user=current_user,
        )
    except GoogleSheetsServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": exc.message,
                "connection_status": exc.connection_status,
                "activation_url": exc.details.get("activation_url"),
            },
        )
    except Exception as exc:
        logger.error("Failed to refresh stock records from Google Sheet: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh stock records: {str(exc)}",
        )
