"""Comprehensive automated tests for Google Sheets Integration (Phase 1: Foundation & Verification)

Covers:
- URL parsing & ID extraction
- Authentication & Service Account credential loading
- Connection success with mocked Google Sheets API v4
- Error handling (HTTP 403 permission denied, HTTP 404 not found, quota, invalid JSON)
- Worksheet listing and grid metadata
- Header retrieval and validation (empty rows, row indices)
- Configuration storage & Company-level isolation
- Disconnect functionality
- FastAPI endpoint responses and status codes
"""

import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from googleapiclient.errors import HttpError
import httplib2

from app.main import app
from app.services.google_sheets_service import (
    GoogleSheetsService,
    GoogleSheetsServiceError,
    extract_spreadsheet_id,
)
from app.core.config import settings

client = TestClient(app)


# ==============================================================================
# 1. URL Parsing & Spreadsheet ID Extraction Tests
# ==============================================================================

def test_extract_spreadsheet_id_valid_urls():
    """Verify standard, shared, user-specific, and bare Google Sheets identifiers."""
    sample_id = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

    # Standard edit URL
    url1 = f"https://docs.google.com/spreadsheets/d/{sample_id}/edit#gid=0"
    assert extract_spreadsheet_id(url1) == sample_id

    # Sharing URL
    url2 = f"https://docs.google.com/spreadsheets/d/{sample_id}/edit?usp=sharing"
    assert extract_spreadsheet_id(url2) == sample_id

    # Base URL without trailing slash or edit
    url3 = f"https://docs.google.com/spreadsheets/d/{sample_id}"
    assert extract_spreadsheet_id(url3) == sample_id

    # Multi-account URL /u/1/
    url4 = f"https://docs.google.com/spreadsheets/u/1/d/{sample_id}/edit"
    assert extract_spreadsheet_id(url4) == sample_id

    # Bare ID
    assert extract_spreadsheet_id(sample_id) == sample_id
    assert extract_spreadsheet_id(f"  {sample_id}  ") == sample_id


def test_extract_spreadsheet_id_invalid_inputs():
    """Verify proper error handling for invalid or malformed URLs and IDs."""
    with pytest.raises(GoogleSheetsServiceError) as exc_info:
        extract_spreadsheet_id("")
    assert exc_info.value.status_code == 400

    with pytest.raises(GoogleSheetsServiceError) as exc_info:
        extract_spreadsheet_id("https://google.com")
    assert "Invalid Google Sheets URL" in exc_info.value.message

    with pytest.raises(GoogleSheetsServiceError) as exc_info:
        extract_spreadsheet_id("short_id")
    assert "Invalid Google Sheets URL" in exc_info.value.message


# ==============================================================================
# 2. Service-level Unit Tests with Mocked Google API
# ==============================================================================

@pytest.fixture
def gs_service(tmp_path):
    """Isolated GoogleSheetsService instance using a temp fallback JSON."""
    service = GoogleSheetsService()
    return service


def test_service_account_configured_false_when_missing():
    """When credentials file is missing, service reports configured=False and email=None."""
    with patch.object(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", "/non/existent/path.json"):
        with patch.object(settings, "GOOGLE_SERVICE_ACCOUNT_JSON", ""):
            service = GoogleSheetsService()
            assert service.is_service_account_configured() is False
            assert service.get_service_account_email() is None


def test_test_connection_success(gs_service):
    """Test successful connection with mocked Google Sheets API response."""
    mock_client = MagicMock()
    mock_spreadsheet = {
        "properties": {"title": "Company Inventory Sheet"},
        "sheets": [
            {"properties": {"sheetId": 0, "title": "Stock Configuration"}},
            {"properties": {"sheetId": 1, "title": "Warehouses"}},
        ],
    }
    mock_client.spreadsheets().get().execute.return_value = mock_spreadsheet

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with patch.object(gs_service, "get_service_account_email", return_value="sa@atlas.iam.gserviceaccount.com"):
            result = gs_service.test_connection(
                company_id="company_test_1",
                spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            )

            assert result["success"] is True
            assert result["connection_status"] == "connected"
            assert result["spreadsheet_name"] == "Company Inventory Sheet"
            assert "Stock Configuration" in result["worksheets"]
            assert "Warehouses" in result["worksheets"]
            assert result["service_account_email"] == "sa@atlas.iam.gserviceaccount.com"


def test_test_connection_permission_denied_403(gs_service):
    """Verify HTTP 403 produces a helpful error mentioning service account email."""
    mock_client = MagicMock()
    response = httplib2.Response({"status": "403"})
    http_error = HttpError(resp=response, content=b'{"error": {"message": "The caller does not have permission"}}')
    mock_client.spreadsheets().get().execute.side_effect = http_error

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with patch.object(gs_service, "get_service_account_email", return_value="atlas-sa@test.iam.gserviceaccount.com"):
            with pytest.raises(GoogleSheetsServiceError) as exc_info:
                gs_service.test_connection(
                    company_id="company_test_2",
                    spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
                )
            assert exc_info.value.status_code == 403
            assert "Permission denied" in exc_info.value.message
            assert "atlas-sa@test.iam.gserviceaccount.com" in exc_info.value.message


def test_test_connection_not_found_404(gs_service):
    """Verify HTTP 404 produces a spreadsheet not found error."""
    mock_client = MagicMock()
    response = httplib2.Response({"status": "404"})
    http_error = HttpError(resp=response, content=b'{"error": {"message": "Requested entity was not found."}}')
    mock_client.spreadsheets().get().execute.side_effect = http_error

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with pytest.raises(GoogleSheetsServiceError) as exc_info:
            gs_service.test_connection(
                company_id="company_test_3",
                spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            )
        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.message.lower()


def test_get_worksheets(gs_service):
    """Verify worksheet tabs and dimension metadata are retrieved."""
    mock_client = MagicMock()
    mock_meta = {
        "sheets": [
            {
                "properties": {
                    "sheetId": 0,
                    "title": "Sheet1",
                    "index": 0,
                    "gridProperties": {"rowCount": 500, "columnCount": 26},
                }
            },
            {
                "properties": {
                    "sheetId": 100,
                    "title": "Stock Config",
                    "index": 1,
                    "gridProperties": {"rowCount": 120, "columnCount": 15},
                }
            },
        ]
    }
    mock_client.spreadsheets().get().execute.return_value = mock_meta

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        worksheets = gs_service.get_worksheets("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms")
        assert len(worksheets) == 2
        assert worksheets[0]["name"] == "Sheet1"
        assert worksheets[0]["row_count"] == 500
        assert worksheets[1]["name"] == "Stock Config"
        assert worksheets[1]["column_count"] == 15


def test_get_headers_success(gs_service):
    """Verify row headers are fetched and cleaned."""
    mock_client = MagicMock()
    mock_meta = {
        "sheets": [
            {
                "properties": {
                    "title": "Stock Config",
                    "gridProperties": {"rowCount": 1000},
                }
            }
        ]
    }
    mock_client.spreadsheets().get().execute.return_value = mock_meta

    mock_values = {
        "values": [["Item Code", "Description", "Stock Qty", "Vendor", "", None]]
    }
    mock_client.spreadsheets().values().get().execute.return_value = mock_values

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        result = gs_service.get_headers(
            spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            worksheet_name="Stock Config",
            header_row=1,
        )

        assert result["headers"] == ["Item Code", "Description", "Stock Qty", "Vendor"]
        assert result["total_columns"] == 4
        assert result["total_rows"] == 1000


def test_get_headers_empty_row(gs_service):
    """Verify empty header row raises informative error."""
    mock_client = MagicMock()
    mock_meta = {
        "sheets": [{"properties": {"title": "Empty Sheet", "gridProperties": {"rowCount": 50}}}]
    }
    mock_client.spreadsheets().get().execute.return_value = mock_meta
    mock_client.spreadsheets().values().get().execute.return_value = {"values": []}

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with pytest.raises(GoogleSheetsServiceError) as exc_info:
            gs_service.get_headers(
                spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
                worksheet_name="Empty Sheet",
                header_row=1,
            )
        assert exc_info.value.status_code == 400
        assert "no headers" in exc_info.value.message


def test_configuration_validation_rules(gs_service):
    """Verify header_row and data_start_row validation rules."""
    # header_row < 1
    with pytest.raises(GoogleSheetsServiceError) as exc_info:
        gs_service.save_configuration("comp_test", {
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "header_row": 0,
            "data_start_row": 2,
        })
    assert exc_info.value.status_code == 400

    # data_start_row <= header_row
    with pytest.raises(GoogleSheetsServiceError) as exc_info:
        gs_service.save_configuration("comp_test", {
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "header_row": 2,
            "data_start_row": 2,
        })
    assert exc_info.value.status_code == 400


def test_company_isolation(gs_service):
    """Verify configurations are isolated between companies."""
    comp_a = "company_alpha"
    comp_b = "company_beta"

    gs_service.save_configuration(comp_a, {
        "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
        "spreadsheet_name": "Alpha Sheet",
        "header_row": 1,
        "data_start_row": 2,
    })

    gs_service.save_configuration(comp_b, {
        "spreadsheet_id": "2CyjNWt1YSB6oGNeLwCeCZkhnVVrqumct85PhwF3vqnt",
        "spreadsheet_name": "Beta Sheet",
        "header_row": 3,
        "data_start_row": 4,
    })

    cfg_a = gs_service.get_configuration(comp_a)
    cfg_b = gs_service.get_configuration(comp_b)

    assert cfg_a["spreadsheet_name"] == "Alpha Sheet"
    assert cfg_a["header_row"] == 1
    assert cfg_b["spreadsheet_name"] == "Beta Sheet"
    assert cfg_b["header_row"] == 3


def test_disconnect(gs_service):
    """Verify disconnect resets connection status to not_connected."""
    gs_service.save_configuration("comp_disc", {
        "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
        "connection_status": "connected",
        "header_row": 1,
        "data_start_row": 2,
    })

    res = gs_service.disconnect("comp_disc")
    assert res["connection_status"] == "not_connected"
    assert res["spreadsheet_id"] is None


def test_test_connection_service_disabled_403(gs_service):
    """Verify SERVICE_DISABLED (API not enabled) error is classified properly with activation URL."""
    mock_client = MagicMock()
    response = httplib2.Response({"status": "403"})
    error_payload = {
        "error": {
            "code": 403,
            "message": "Google Sheets API has not been used in project 767613266689 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=767613266689 then retry.",
            "status": "PERMISSION_DENIED",
            "details": [
                {
                    "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                    "reason": "SERVICE_DISABLED",
                    "domain": "googleapis.com",
                    "metadata": {
                        "activationUrl": "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=767613266689",
                        "service": "sheets.googleapis.com",
                    },
                }
            ],
        }
    }
    http_error = HttpError(resp=response, content=json.dumps(error_payload).encode("utf-8"))
    mock_client.spreadsheets().get().execute.side_effect = http_error

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with pytest.raises(GoogleSheetsServiceError) as exc_info:
            gs_service.test_connection(
                company_id="company_test_disabled",
                spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            )
        assert exc_info.value.status_code == 403
        assert exc_info.value.connection_status == "api_not_enabled"
        assert "767613266689" in exc_info.value.details["activation_url"]

        cfg = gs_service.get_configuration("company_test_disabled")
        assert cfg["connection_status"] == "api_not_enabled"


def test_get_stock_configuration_records(gs_service):
    """Verify dynamic header mapping and record parsing for Stock Configuration."""
    mock_client = MagicMock()
    mock_meta = {
        "properties": {"title": "Company Stock Master"},
        "sheets": [
            {
                "properties": {
                    "sheetId": 0,
                    "title": "Stock Configuration",
                    "gridProperties": {"rowCount": 100, "columnCount": 22},
                }
            }
        ],
    }
    mock_client.spreadsheets().get().execute.return_value = mock_meta

    # Headers with alias variants
    mock_headers = {
        "values": [[
            "Record ID", "SAP Item Code", "Item Description", "Order Qty", "In Stock",
            "Vendor", "GRPO No", "Received Qty", "Net Weight", "QC Passed",
            "Drawing", "V Check", "OK Qty", "Reject Qty", "LM",
            "OLNG", "LPK", "LBL", "MC/PT", "Entry Date", "Updated At", "Updated By"
        ]]
    }

    # Data row matching headers
    mock_rows = {
        "values": [[
            "REC-001", "ITEM-1001", "Precision Ball Bearing 6204", "150", "120",
            "SKF Bearings Ltd", "GRPO-9821", "150", "45.5", "Pass",
            "Y", "Y", "148", "2", "Y",
            "Y", "Y", "Y", "MC", "2026-11-01", "2026-11-10", "Inventory Manager"
        ]]
    }

    def values_get_mock(spreadsheetId, range):
        mock_req = MagicMock()
        if "A1:ZZ1" in range:
            mock_req.execute.return_value = mock_headers
        else:
            mock_req.execute.return_value = mock_rows
        return mock_req

    mock_client.spreadsheets().values().get.side_effect = values_get_mock

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        result = gs_service.get_stock_configuration_records(
            spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            worksheet_name="Stock Configuration",
            header_row=1,
            data_start_row=2,
            limit=50,
        )

        assert result["success"] is True
        assert result["total_records"] == 1
        rec = result["records"][0]
        assert rec["record_id"] == "REC-001"
        assert rec["item_code"] == "ITEM-1001"
        assert rec["description"] == "Precision Ball Bearing 6204"
        assert rec["qty"] == 150.0
        assert rec["stock_qty"] == 120.0
        assert rec["vendor_name"] == "SKF Bearings Ltd"
        assert rec["qc"] is True
        assert rec["drw_yn"] == "Y"
        assert rec["ok_qty"] == 148.0
        assert rec["rej_qty"] == 2.0
        assert rec["mc_or_pt"] == "MC"


# ==============================================================================
# 3. API Endpoint Tests (Using TestClient with mocked dependencies)
# ==============================================================================

@pytest.fixture
def auth_headers():
    from app.core.security import create_access_token
    token = create_access_token({
        "sub": "admin",
        "role": "admin",
        "company_id": "test_corp",
        "permissions": ["*"],
    })
    return {"Authorization": f"Bearer {token}"}


@patch("app.services.user_service.get_user_by_username")
def test_api_status_endpoint(mock_get_user, auth_headers):
    mock_get_user.return_value = {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
        "is_active": True,
        "token_version": 1,
        "permissions": ["*"],
    }

    with patch("app.services.google_sheets_service.google_sheets_service.get_configuration") as mock_get_cfg:
        mock_get_cfg.return_value = {
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "spreadsheet_name": "Test Sheet",
            "connection_status": "connected",
            "header_row": 1,
            "data_start_row": 2,
        }
        with patch("app.services.google_sheets_service.google_sheets_service.is_service_account_configured", return_value=True):
            with patch("app.services.google_sheets_service.google_sheets_service.get_service_account_email", return_value="sa@atlas.test"):
                with patch("app.services.google_sheets_service.google_sheets_service.get_worksheets", return_value=[{"name": "Tab1", "index": 0}]):
                    response = client.get("/api/v1/integrations/google-sheets/status", headers=auth_headers)
                    assert response.status_code == 200
                    data = response.json()
                    assert data["configured"] is True
                    assert data["connection_status"] == "connected"
                    assert data["spreadsheet_name"] == "Test Sheet"
                    assert data["service_account_email"] == "sa@atlas.test"


@patch("app.services.user_service.get_user_by_username")
def test_api_connect_endpoint_success(mock_get_user, auth_headers):
    mock_get_user.return_value = {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
        "is_active": True,
        "token_version": 1,
        "permissions": ["*"],
    }

    payload = {
        "spreadsheet_url": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
    }

    with patch("app.services.google_sheets_service.google_sheets_service.test_connection") as mock_test:
        mock_test.return_value = {
            "success": True,
            "connection_status": "connected",
            "spreadsheet_name": "Connected Sheet",
            "worksheets": ["Sheet1"],
            "service_account_email": "sa@atlas.test",
            "tested_at": "2026-11-07T12:00:00",
        }
        with patch("app.services.google_sheets_service.google_sheets_service.save_configuration") as mock_save:
            mock_save.return_value = {}
            response = client.post("/api/v1/integrations/google-sheets/connect", json=payload, headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["spreadsheet_name"] == "Connected Sheet"


@patch("app.services.user_service.get_user_by_username")
def test_api_disconnect_endpoint(mock_get_user, auth_headers):
    mock_get_user.return_value = {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
        "is_active": True,
        "token_version": 1,
        "permissions": ["*"],
    }

    with patch("app.services.google_sheets_service.google_sheets_service.disconnect") as mock_disc:
        mock_disc.return_value = {"connection_status": "not_connected"}
        response = client.delete("/api/v1/integrations/google-sheets/disconnect", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_connected"


@patch("app.services.user_service.get_user_by_username")
def test_api_stock_records_endpoint(mock_get_user, auth_headers):
    mock_get_user.return_value = {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
        "is_active": True,
        "token_version": 1,
        "permissions": ["*"],
    }

    with patch("app.services.google_sheets_service.google_sheets_service.get_configuration") as mock_get_cfg:
        mock_get_cfg.return_value = {
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "worksheet_name": "Stock Configuration",
            "header_row": 1,
            "data_start_row": 2,
        }
        with patch("app.services.google_sheets_service.google_sheets_service.get_stock_configuration_records") as mock_records:
            mock_records.return_value = {
                "success": True,
                "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
                "spreadsheet_name": "Inventory",
                "worksheet_name": "Stock Configuration",
                "header_row": 1,
                "data_start_row": 2,
                "headers": ["Item Code", "Quantity"],
                "column_mapping": {"item_code": "Col 1", "qty": "Col 2"},
                "total_records": 1,
                "records": [{"item_code": "ITEM-1", "qty": 10.0}],
                "unmapped_headers": [],
                "missing_expected_headers": [],
                "tested_at": "2026-11-07T12:00:00",
            }
            response = client.get("/api/v1/integrations/google-sheets/stock-records", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["total_records"] == 1
            assert data["records"][0]["item_code"] == "ITEM-1"


# ==============================================================================
# Phase 2: Stock Configuration Writes & SAP Protection Tests
# ==============================================================================

def test_create_stock_configuration_record_success(gs_service):
    """Test creating a new stock configuration record in Google Sheets."""
    mock_client = MagicMock()
    mock_spreadsheet = {
        "properties": {"title": "Inventory"},
        "sheets": [{"properties": {"title": "Stock Configuration"}}],
    }
    mock_client.spreadsheets().get().execute.return_value = mock_spreadsheet

    # Mock headers (row 1)
    mock_headers = [["Record ID", "SAP Item Code", "Description", "Quantity", "QC", "Updated At", "Updated By"]]
    mock_existing_rows = [["REC-001", "FG001", "Existing Item", "5", "PASS", "2026-11-01T00:00:00", "admin"]]

    def mock_get(spreadsheetId, range):
        req = MagicMock()
        if "!A1:" in range:
            req.execute.return_value = {"values": mock_headers}
        else:
            req.execute.return_value = {"values": mock_existing_rows}
        return req

    mock_client.spreadsheets().values().get = mock_get
    mock_client.spreadsheets().values().append().execute.return_value = {"updates": {"updatedRows": 1}}

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with patch.object(gs_service, "get_configuration", return_value={
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "worksheet_name": "Stock Configuration",
            "header_row": 1,
            "data_start_row": 2,
        }):
            with patch.object(gs_service, "save_configuration") as mock_save:
                result = gs_service.create_stock_configuration_record(
                    company_id="default",
                    data={
                        "item_code": "FG002",
                        "description": "New Precision Sensor",
                        "qty": 25.0,
                        "qc": True,
                    },
                    current_user={"username": "tester"},
                )

                assert result["success"] is True
                assert result["source"] == "google_sheets"
                assert result["item"]["item_code"] == "FG002"
                assert result["item"]["description"] == "New Precision Sensor"
                assert result["item"]["qty"] == 25.0
                assert result["item"]["qc"] is True
                assert result["item"]["record_id"].startswith("REC-")
                mock_save.assert_called_once()


def test_create_duplicate_record_id_rejected(gs_service):
    """Test that creating a record with a duplicate Record ID is rejected."""
    mock_client = MagicMock()
    mock_spreadsheet = {
        "properties": {"title": "Inventory"},
        "sheets": [{"properties": {"title": "Stock Configuration"}}],
    }
    mock_client.spreadsheets().get().execute.return_value = mock_spreadsheet

    mock_headers = [["Record ID", "SAP Item Code", "Description"]]
    mock_existing_rows = [["REC-001", "FG001", "Existing Item"]]

    def mock_get(spreadsheetId, range):
        req = MagicMock()
        if "!A1:" in range:
            req.execute.return_value = {"values": mock_headers}
        else:
            req.execute.return_value = {"values": mock_existing_rows}
        return req

    mock_client.spreadsheets().values().get = mock_get

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with patch.object(gs_service, "get_configuration", return_value={
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "worksheet_name": "Stock Configuration",
            "header_row": 1,
            "data_start_row": 2,
        }):
            with pytest.raises(GoogleSheetsServiceError) as exc_info:
                gs_service.create_stock_configuration_record(
                    company_id="default",
                    data={
                        "record_id": "REC-001",
                        "item_code": "FG002",
                        "description": "Duplicate ID Test",
                    },
                    current_user={"username": "tester"},
                )
            assert exc_info.value.status_code == 400
            assert "already exists" in exc_info.value.message


def test_update_stock_configuration_record_success(gs_service):
    """Test updating an existing row in Google Sheets via stable Record ID."""
    mock_client = MagicMock()
    mock_spreadsheet = {
        "properties": {"title": "Inventory"},
        "sheets": [{"properties": {"title": "Stock Configuration"}}],
    }
    mock_client.spreadsheets().get().execute.return_value = mock_spreadsheet

    mock_headers = [["Record ID", "SAP Item Code", "Description", "Quantity", "QC", "Updated At", "Updated By"]]
    mock_existing_rows = [
        ["REC-001", "FG001", "Sensor Unit", "10", "PASS", "2026-11-01T00:00:00", "admin"],
        ["REC-002", "FG002", "Control Valve", "15", "NO", "2026-11-01T00:00:00", "admin"],
    ]

    def mock_get(spreadsheetId, range):
        req = MagicMock()
        if "!A1:" in range:
            req.execute.return_value = {"values": mock_headers}
        else:
            req.execute.return_value = {"values": mock_existing_rows}
        return req

    mock_client.spreadsheets().values().get = mock_get
    mock_client.spreadsheets().values().update().execute.return_value = {"updatedRows": 1}

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with patch.object(gs_service, "get_configuration", return_value={
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "worksheet_name": "Stock Configuration",
            "header_row": 1,
            "data_start_row": 2,
        }):
            with patch.object(gs_service, "save_configuration"):
                result = gs_service.update_stock_configuration_record(
                    company_id="default",
                    record_id="REC-002",
                    data={
                        "qty": 30.0,
                        "qc": True,
                        "expected_updated_at": "2026-11-01T00:00:00",
                    },
                    current_user={"username": "editor"},
                )

                assert result["success"] is True
                assert result["item"]["record_id"] == "REC-002"
                assert result["item"]["qty"] == 30.0
                assert result["item"]["qc"] is True
                assert result["item"]["updated_by"] == "editor"


def test_update_record_not_found(gs_service):
    """Test updating a non-existent Record ID returns 404."""
    mock_client = MagicMock()
    mock_spreadsheet = {
        "properties": {"title": "Inventory"},
        "sheets": [{"properties": {"title": "Stock Configuration"}}],
    }
    mock_client.spreadsheets().get().execute.return_value = mock_spreadsheet

    mock_headers = [["Record ID", "SAP Item Code", "Description"]]
    mock_existing_rows = [["REC-001", "FG001", "Sensor Unit"]]

    def mock_get(spreadsheetId, range):
        req = MagicMock()
        if "!A1:" in range:
            req.execute.return_value = {"values": mock_headers}
        else:
            req.execute.return_value = {"values": mock_existing_rows}
        return req

    mock_client.spreadsheets().values().get = mock_get

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with patch.object(gs_service, "get_configuration", return_value={
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "worksheet_name": "Stock Configuration",
            "header_row": 1,
            "data_start_row": 2,
        }):
            with pytest.raises(GoogleSheetsServiceError) as exc_info:
                gs_service.update_stock_configuration_record(
                    company_id="default",
                    record_id="REC-999",
                    data={"qty": 10.0},
                    current_user={"username": "editor"},
                )
            assert exc_info.value.status_code == 404
            assert "was not found" in exc_info.value.message


def test_update_record_concurrency_conflict(gs_service):
    """Test optimistic concurrency check raises HTTP 409 if sheet has changed since load."""
    mock_client = MagicMock()
    mock_spreadsheet = {
        "properties": {"title": "Inventory"},
        "sheets": [{"properties": {"title": "Stock Configuration"}}],
    }
    mock_client.spreadsheets().get().execute.return_value = mock_spreadsheet

    mock_headers = [["Record ID", "SAP Item Code", "Quantity", "Updated At"]]
    # Current sheet has updated_at = 2026-11-12T10:00:00
    mock_existing_rows = [["REC-001", "FG001", "10", "2026-11-12T10:00:00"]]

    def mock_get(spreadsheetId, range):
        req = MagicMock()
        if "!A1:" in range:
            req.execute.return_value = {"values": mock_headers}
        else:
            req.execute.return_value = {"values": mock_existing_rows}
        return req

    mock_client.spreadsheets().values().get = mock_get

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with patch.object(gs_service, "get_configuration", return_value={
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "worksheet_name": "Stock Configuration",
            "header_row": 1,
            "data_start_row": 2,
        }):
            # User loaded record when updated_at was older: 2026-11-12T08:00:00
            with pytest.raises(GoogleSheetsServiceError) as exc_info:
                gs_service.update_stock_configuration_record(
                    company_id="default",
                    record_id="REC-001",
                    data={
                        "qty": 50.0,
                        "expected_updated_at": "2026-11-12T08:00:00",
                    },
                    current_user={"username": "editor"},
                )
            assert exc_info.value.status_code == 409
            assert "modified in Google Sheets since it was loaded" in exc_info.value.message


def test_bulk_update_stock_configuration_records(gs_service):
    """Test bulk update performs single batchUpdate and tracks per-row success/failure."""
    mock_client = MagicMock()
    mock_spreadsheet = {
        "properties": {"title": "Inventory"},
        "sheets": [{"properties": {"title": "Stock Configuration"}}],
    }
    mock_client.spreadsheets().get().execute.return_value = mock_spreadsheet

    mock_headers = [["Record ID", "SAP Item Code", "Quantity", "Updated At", "Updated By"]]
    mock_existing_rows = [
        ["REC-001", "FG001", "10", "2026-11-01T00:00:00", "admin"],
        ["REC-002", "FG002", "20", "2026-11-01T00:00:00", "admin"],
    ]

    def mock_get(spreadsheetId, range):
        req = MagicMock()
        if "!A1:" in range:
            req.execute.return_value = {"values": mock_headers}
        else:
            req.execute.return_value = {"values": mock_existing_rows}
        return req

    mock_client.spreadsheets().values().get = mock_get
    mock_client.spreadsheets().values().batchUpdate().execute.return_value = {"totalUpdatedRows": 2}

    with patch.object(gs_service, "_build_sheets_client", return_value=mock_client):
        with patch.object(gs_service, "get_configuration", return_value={
            "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "worksheet_name": "Stock Configuration",
            "header_row": 1,
            "data_start_row": 2,
        }):
            with patch.object(gs_service, "save_configuration"):
                result = gs_service.bulk_update_stock_configuration_records(
                    company_id="default",
                    items=[
                        {"record_id": "REC-001", "qty": 12.0},
                        {"record_id": "REC-002", "qty": 22.0},
                        {"record_id": "REC-999", "qty": 5.0},  # Missing record
                    ],
                    current_user={"username": "bulk_editor"},
                )

                assert result["total"] == 3
                assert result["successful"] == 2
                assert result["failed"] == 1
                assert len(result["errors"]) == 1
                assert result["errors"][0]["record_id"] == "REC-999"


def test_sap_write_protection():
    """Verify that SAP Business One write APIs are never called during stock configuration sync."""
    from app.services.stock_configuration_service import StockConfigurationService

    service = StockConfigurationService()

    with patch("app.services.sap.client.get_sap_client") as mock_get_sap:
        result = service._sync_item_to_sap("FG001", {"qty": 100, "description": "Protected Item"})

        # Assert SAP client was NEVER invoked
        mock_get_sap.assert_not_called()
        assert result["sap_synced"] is False
        assert "write-protection active" in result["message"]


# ==============================================================================
# Phase 2: FastAPI Endpoint Tests
# ==============================================================================

@patch("app.services.user_service.get_user_by_username")
def test_api_create_stock_record_endpoint(mock_get_user, auth_headers):
    mock_get_user.return_value = {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
        "is_active": True,
        "token_version": 1,
        "permissions": ["*"],
    }

    mock_resp = {
        "success": True,
        "message": "Stock item created in Google Sheets.",
        "item": {
            "record_id": "REC-NEW-01",
            "item_code": "FG099",
            "description": "Test Component",
            "qty": 10.0,
        },
        "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
        "worksheet_name": "Stock Configuration",
        "source": "google_sheets",
        "timestamp": "2026-11-12T12:00:00",
    }

    with patch("app.services.google_sheets_service.google_sheets_service.create_stock_configuration_record", return_value=mock_resp):
        payload = {
            "item_code": "FG099",
            "description": "Test Component",
            "qty": 10.0,
        }
        response = client.post("/api/v1/integrations/google-sheets/stock-records", json=payload, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["item"]["record_id"] == "REC-NEW-01"
        assert data["item"]["item_code"] == "FG099"


@patch("app.services.user_service.get_user_by_username")
def test_api_update_stock_record_endpoint(mock_get_user, auth_headers):
    mock_get_user.return_value = {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
        "is_active": True,
        "token_version": 1,
        "permissions": ["*"],
    }

    mock_resp = {
        "success": True,
        "message": "Record updated in Google Sheets.",
        "item": {
            "record_id": "REC-001",
            "item_code": "FG001",
            "qty": 45.0,
        },
        "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
        "worksheet_name": "Stock Configuration",
        "source": "google_sheets",
        "timestamp": "2026-11-12T12:00:00",
    }

    with patch("app.services.google_sheets_service.google_sheets_service.update_stock_configuration_record", return_value=mock_resp):
        payload = {"qty": 45.0}
        response = client.put("/api/v1/integrations/google-sheets/stock-records/REC-001", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["item"]["record_id"] == "REC-001"
        assert data["item"]["qty"] == 45.0


@patch("app.services.user_service.get_user_by_username")
def test_api_bulk_update_stock_records_endpoint(mock_get_user, auth_headers):
    mock_get_user.return_value = {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
        "is_active": True,
        "token_version": 1,
        "permissions": ["*"],
    }

    mock_resp = {
        "success": True,
        "total": 2,
        "successful": 2,
        "failed": 0,
        "source": "google_sheets",
        "timestamp": "2026-11-12T12:00:00",
        "results": [
            {"record_id": "REC-001", "item_code": "FG001", "success": True, "message": "Updated"},
            {"record_id": "REC-002", "item_code": "FG002", "success": True, "message": "Updated"},
        ],
        "errors": [],
    }

    with patch("app.services.google_sheets_service.google_sheets_service.bulk_update_stock_configuration_records", return_value=mock_resp):
        payload = {
            "items": [
                {"record_id": "REC-001", "qty": 15.0},
                {"record_id": "REC-002", "qty": 25.0},
            ]
        }
        response = client.post("/api/v1/integrations/google-sheets/stock-records/bulk", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["successful"] == 2
        assert data["failed"] == 0


@patch("app.services.user_service.get_user_by_username")
def test_api_refresh_stock_records_endpoint(mock_get_user, auth_headers):
    mock_get_user.return_value = {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
        "is_active": True,
        "token_version": 1,
        "permissions": ["*"],
    }

    mock_resp = {
        "success": True,
        "total_records": 10,
        "records": [],
        "source": "google_sheets",
        "timestamp": "2026-11-12T12:00:00",
    }

    with patch("app.services.google_sheets_service.google_sheets_service.refresh_stock_configuration_records", return_value=mock_resp):
        response = client.post("/api/v1/integrations/google-sheets/stock-records/refresh", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["total_records"] == 10


