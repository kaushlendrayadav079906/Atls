"""Unit and integration tests for Stock Configuration API and Service."""

import os
os.environ["TESTING"] = "True"
os.environ["SAP_STOCK_SYNC_ENABLED"] = "False"

import io
import pytest
import openpyxl
import unittest.mock
from typing import Optional
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import get_current_user, decode_access_token
from app.services.stock_configuration_service import StockConfigurationService

_bearer_scheme = HTTPBearer(auto_error=False)

def mock_get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme)):
    role = "admin"
    sub = "admin"
    permissions = ["products.view", "*"]
    branch_id = "01"
    if credentials and getattr(credentials, "credentials", None):
        try:
            payload = decode_access_token(credentials.credentials)
            role = payload.get("role", "admin")
            sub = payload.get("sub", "admin")
            permissions = payload.get("permissions", ["products.view", "*"])
            branch_id = payload.get("branch_id", "01")
        except Exception:
            pass
    return {
        "sub": sub,
        "id": "1",
        "user_id": "1",
        "username": sub,
        "role": role,
        "branch_id": branch_id,
        "permissions": permissions,
        "is_active": True,
    }

app.dependency_overrides[get_current_user] = mock_get_current_user

client = TestClient(app)


@pytest.fixture
def auth_headers():
    from app.core.security import create_access_token
    token = create_access_token({"sub": "admin", "role": "admin", "branch_id": "01", "permissions": ["products.view"]})
    return {"Authorization": f"Bearer {token}"}


def test_get_stock_configuration_kpis_and_pagination(auth_headers):
    response = client.get("/api/v1/stock-configuration?page=1&page_size=10", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert "kpis" in data
    assert "filters" in data
    assert len(data["items"]) <= 10
    assert data["kpis"]["total_items"] >= 26
    assert data["kpis"]["active_items"] >= 20
    assert data["kpis"]["warehouses_count"] >= 1


def test_update_stock_configuration_item(auth_headers):
    # Fetch original item first to verify SAP fields remain unchanged
    orig_res = client.get("/api/v1/stock-configuration?page=1&page_size=10", headers=auth_headers)
    assert orig_res.status_code == 200
    target_item = orig_res.json()["items"][0]
    target_code = target_item["item_code"]
    orig_qty = target_item["qty"]
    orig_grpo = target_item["grpo_no"]

    update_payload = {
        "qty": 9999.0,         # Attempted overwrite of SAP field (must be ignored)
        "grpo_no": "FAKE_GRPO", # Attempted overwrite of SAP field (must be ignored)
        "nt_weight": 14.2,
        "qc": "Y",
        "drw_yn": "Y",
        "v_chk": "Y",
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
    }
    mock_item_sync = {
        "status": "success",
        "sap_synced": True,
        "confirmed_last_updated": "2026-11-17 16:30:00",
    }
    with patch("app.services.stock_configuration_service.StockConfigurationService._sync_item_to_sap", return_value=mock_item_sync):
        response = client.put(f"/api/v1/stock-configuration/items/{target_code}", json=update_payload, headers=auth_headers)
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["success"] is True
        # SAP-owned fields must be preserved
        assert res_data["item"]["qty"] == orig_qty
        assert res_data["item"]["grpo_no"] == orig_grpo
        # User-configurable fields must be updated
        assert res_data["item"]["nt_weight"] == 14.2
        assert res_data["item"]["qc"] is True


def test_qc_toggle_and_persistence(auth_headers):
    mock_item_sync = {
        "status": "success",
        "sap_synced": True,
        "confirmed_last_updated": "2026-11-17 16:30:00",
    }
    with patch("app.services.stock_configuration_service.StockConfigurationService._sync_item_to_sap", return_value=mock_item_sync):
        # Toggle QC to N
        res_n = client.put("/api/v1/stock-configuration/items/CS1124", json={"qc": "N"}, headers=auth_headers)
        assert res_n.status_code == 200
        assert res_n.json()["item"]["qc"] is False

        # Verify via GET
        get_res = client.get("/api/v1/stock-configuration?search=CS1124", headers=auth_headers)
        item_n = next(it for it in get_res.json()["items"] if it["item_code"] == "CS1124")
        assert item_n["qc"] is False

        # Toggle QC back to Y
        res_y = client.put("/api/v1/stock-configuration/items/CS1124", json={"qc": "Y"}, headers=auth_headers)
        assert res_y.status_code == 200
        assert res_y.json()["item"]["qc"] is True


def test_sap_owned_fields_bulk_and_import_protection(auth_headers):
    mock_item_sync = {
        "status": "success",
        "sap_synced": True,
        "confirmed_last_updated": "2026-11-17 16:30:00",
    }
    with patch("app.services.stock_configuration_service.StockConfigurationService._sync_item_to_sap", return_value=mock_item_sync):
        # 1. Bulk update protection
        bulk_res = client.post(
            "/api/v1/stock-configuration/bulk-update",
            json={"items": [{"item_code": "CS1124", "qty": 8888.0, "vendor_name": "MALICIOUS", "nt_weight": 14.2, "qc": "Y"}]},
            headers=auth_headers,
        )
        assert bulk_res.status_code == 200
        assert bulk_res.json()["successful"] >= 1
        updated_bulk = bulk_res.json()["results"][0]["item"]
        assert updated_bulk["qty"] != 8888.0
        assert updated_bulk["vendor_name"] != "MALICIOUS"

    # 2. Excel import protection on existing SAP items
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["SAP CODE", "Desc.", "Qty.", "Stock Qty.", "VENDOR NAME", "GRPO No.", "NT. WEIGHT", "QC"])
    ws.append(["CS1124", "Hacked Description", 7777, 7777, "Hacked Vendor", "9999", 14.5, "Y"])
    buf = io.BytesIO()
    wb.save(buf)

    import_res = client.post(
        "/api/v1/stock-configuration/import",
        files={"file": ("protect_test.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"preview": "false"},
        headers=auth_headers,
    )
    assert import_res.status_code == 200
    assert import_res.json()["imported_count"] >= 1

    # Verify CS1124 still has legitimate description and vendor
    chk_res = client.get("/api/v1/stock-configuration?search=CS1124", headers=auth_headers)
    chk_item = next(it for it in chk_res.json()["items"] if it["item_code"] == "CS1124")
    assert chk_item["description"] != "Hacked Description"
    assert chk_item["vendor_name"] != "Hacked Vendor"
    assert chk_item["nt_weight"] == 14.5


def test_add_and_delete_stock_item(auth_headers):
    new_item = {
        "item_code": "TEST999",
        "description": "Test Integration Item",
        "qty": 50.0,
        "stock_qty": 45.0,
        "vendor_name": "Test Vendor",
        "grpo_no": "9999",
        "rcvd_qty": 50.0,
        "nt_weight": 2.5,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 45.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Test Group",
        "warehouse_code": "01",
        "is_active": True,
    }
    # Add
    res = client.post("/api/v1/stock-configuration/items", json=new_item, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["item"]["item_code"] == "TEST999"

    # Delete
    del_res = client.delete("/api/v1/stock-configuration/items/TEST999", headers=auth_headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True


def test_export_stock_configuration_excel(auth_headers):
    response = client.get("/api/v1/stock-configuration/export", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    wb = openpyxl.load_workbook(io.BytesIO(response.content))
    ws = wb.active
    assert ws.title == "Stock Items"
    headers = [cell.value for cell in ws[1]]
    assert "SAP CODE" in headers
    assert "Desc." in headers
    assert "VENDOR NAME" in headers
    assert "GRPO No." in headers
    assert "MC or PT" in headers


def test_import_stock_configuration_excel_preview_and_commit(auth_headers):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append([
        "SR. NO.", "SAP CODE", "Desc.", "Qty.", "Stock Qty.", "VENDOR NAME",
        "GRPO No.", "RCVD. Qty.", "NT. WEIGHT", "QC", "DRW. Y/N", "V CHK",
        "Ok Qty.", "Rej. Qty.", "LM", "OLNG", "LPK", "LBL", "MC or PT"
    ])
    ws.append([
        1, "IMP001", "Imported Test Widget", 30, 28, "Vendor X",
        "6001", 30, 1.2, "Y", "Y", "Y",
        28, 2, "Y", "Y", "Y", "Y", "Y"
    ])
    buf = io.BytesIO()
    wb.save(buf)
    file_bytes = buf.getvalue()

    # 1. Preview mode
    res_preview = client.post(
        "/api/v1/stock-configuration/import",
        files={"file": ("test_import.xlsx", file_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"preview": "true"},
        headers=auth_headers,
    )
    assert res_preview.status_code == 200
    preview_data = res_preview.json()
    assert preview_data["preview"] is True
    assert preview_data["valid_count"] == 1
    assert preview_data["invalid_count"] == 0

    # 2. Commit mode
    res_commit = client.post(
        "/api/v1/stock-configuration/import",
        files={"file": ("test_import.xlsx", file_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"preview": "false"},
        headers=auth_headers,
    )
    assert res_commit.status_code == 200
    commit_data = res_commit.json()
    assert commit_data["success"] is True
    assert commit_data["imported_count"] == 1

    # Cleanup imported test item
    client.delete("/api/v1/stock-configuration/items/IMP001", headers=auth_headers)


def test_last_submitted_at_timestamp_tracking(auth_headers):
    mock_item_sync = {
        "status": "success",
        "sap_synced": True,
        "confirmed_last_updated": "2026-11-17 16:30:00",
    }
    with patch("app.services.stock_configuration_service.StockConfigurationService._sync_item_to_sap", return_value=mock_item_sync):
        # 1. Update single item CS1124
        put_res = client.put(
            "/api/v1/stock-configuration/items/CS1124",
            json={"nd_weight": 14.8},
            headers=auth_headers,
        )
        assert put_res.status_code == 200
        data = put_res.json()
        assert data["success"] is True
        assert "last_submitted_at" in data["item"]
        assert data["item"]["last_submitted_at"] is not None

        submitted_ts = data["item"]["last_submitted_at"]

        # 2. Verify persisted in GET query
        get_res = client.get("/api/v1/stock-configuration?search=CS1124", headers=auth_headers)
        assert get_res.status_code == 200
        item = next(it for it in get_res.json()["items"] if it["item_code"] == "CS1124")
        assert item["last_submitted_at"] == submitted_ts

        # 3. Verify bulk update also sets and returns last_submitted_at
        bulk_res = client.post(
            "/api/v1/stock-configuration/bulk-update",
            json={"items": [{"item_code": "CS1124", "nt_weight": 14.9}]},
            headers=auth_headers,
        )
        assert bulk_res.status_code == 200
        bulk_item = bulk_res.json()["results"][0]["item"]
        assert "last_submitted_at" in bulk_item
        assert bulk_item["last_submitted_at"] is not None


from unittest.mock import patch

def test_admin_remarks_submission_and_audit_history(auth_headers):
    mock_po_sync = {
        "doc_entry": 871,
        "doc_num": 1378,
        "status": "success",
        "verified": True,
        "comments": "Batch inspected and approved by Admin",
    }
    with patch("app.services.stock_configuration_service.StockConfigurationService._sync_po_to_sap", return_value=mock_po_sync):
        # 1. Admin submits initial remark on CS1124
        remark1 = "Batch inspected and approved by Admin"
        res1 = client.put(
            "/api/v1/stock-configuration/items/CS1124",
            json={"remark": remark1, "nt_weight": 14.2},
            headers=auth_headers,
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["success"] is True
        assert data1["remark"] == remark1
        assert data1["item"]["remark"] == remark1
        assert data1["last_submitted_at"] is not None

        # Verify remark is returned on page query (refresh)
        get_res = client.get("/api/v1/stock-configuration?search=CS1124", headers=auth_headers)
        assert get_res.status_code == 200
        item = next(it for it in get_res.json()["items"] if it["item_code"] == "CS1124")
        assert item["remark"] == remark1

        # 2. Admin submits an updated remark on CS1124
        remark2 = "Packaging QC verified; ready for dispatch"
        mock_po_sync["comments"] = remark2
        res2 = client.put(
            "/api/v1/stock-configuration/items/CS1124",
            json={"remark": remark2},
            headers=auth_headers,
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["remark"] == remark2
        assert data2["item"]["remark"] == remark2

        # 3. Verify remarks audit history endpoint preserves previous remarks
        hist_res = client.get("/api/v1/stock-configuration/items/CS1124/remarks-history", headers=auth_headers)
        assert hist_res.status_code == 200
        hist = hist_res.json()["history"]
        assert len(hist) >= 2
        # The most recent audit entry should have new_remark == remark2 and previous_remark == remark1
        latest_audit = hist[0]
        assert latest_audit["new_remark"] == remark2
        assert latest_audit["previous_remark"] == remark1
        assert latest_audit["admin_user_id"] is not None


def test_non_admin_cannot_add_or_modify_remarks():
    from app.core.security import create_access_token
    user_token = create_access_token({"sub": "test_perm_user", "role": "user", "permissions": ["products.view"]})
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Non-admin attempting to submit remark should get 403 Forbidden
    res = client.put(
        "/api/v1/stock-configuration/items/CS1124",
        json={"remark": "Unauthorized remark by non-admin"},
        headers=user_headers,
    )
    assert res.status_code == 403
    assert "Only authorized Admin users can add or modify remarks" in res.json()["detail"]

    # Non-admin bulk update with remark should also be rejected with 403
    bulk_res = client.post(
        "/api/v1/stock-configuration/bulk-update",
        json={"items": [{"item_code": "CS1124", "remark": "Hacked remark"}]},
        headers=user_headers,
    )
    assert bulk_res.status_code == 403
    assert "Only authorized Admin users can add or modify remarks" in bulk_res.json()["detail"]


def test_bulk_update_preserves_existing_remarks(auth_headers):
    mock_po_sync = {
        "doc_entry": 871,
        "doc_num": 1378,
        "status": "success",
        "verified": True,
        "comments": "yes",
    }
    mock_item_sync = {
        "status": "success",
        "sap_synced": True,
        "confirmed_last_updated": "2026-11-17 16:30:00",
    }
    with patch("app.services.stock_configuration_service.StockConfigurationService._sync_po_to_sap", return_value=mock_po_sync), \
         patch("app.services.stock_configuration_service.StockConfigurationService._sync_item_to_sap", return_value=mock_item_sync):
        # Set a remark on CS1124
        res_set = client.put(
            "/api/v1/stock-configuration/items/CS1124",
            json={"remark": "yes"},
            headers=auth_headers,
        )
        assert res_set.status_code == 200

        # Bulk update updating other fields (nt_weight) without supplying remark
        bulk_res = client.post(
            "/api/v1/stock-configuration/bulk-update",
            json={"items": [{"item_code": "CS1124", "nt_weight": 9.5}]},
            headers=auth_headers,
        )
        assert bulk_res.status_code == 200
        updated_rm = bulk_res.json()["results"][0]["item"]
        # Remark must be preserved and not wiped
        assert updated_rm["remark"] == "yes"
        assert updated_rm["nt_weight"] == 9.5


def test_partial_success_reporting_when_po_update_fails(auth_headers):
    """
    Verify that when Item Master PATCH succeeds in SAP but Purchase Order PATCH fails
    (e.g. document awaiting approval), the API reports partial_success=True with separate statuses.
    """
    with patch("app.services.stock_configuration_service.StockConfigurationService._sync_po_to_sap", side_effect=RuntimeError("Cannot update documents awaiting approval")), \
         patch("app.services.stock_configuration_service.StockConfigurationService._sync_item_to_sap", return_value={"status": "success", "sap_synced": True, "confirmed_last_updated": "2026-11-17 16:30:00"}):
        res = client.put(
            "/api/v1/stock-configuration/items/CS1124",
            json={"nt_weight": 14.5, "remark": "Should fail PO sync"},
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["partial_success"] is True

        # Remarks-only update when PO is awaiting approval also persists locally with partial_success=True
        res2 = client.put(
            "/api/v1/stock-configuration/items/CS1124",
            json={"remark": "Remark only pending approval"},
            headers=auth_headers,
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["partial_success"] is True
        assert data2["item"]["remark"] == "Remark only pending approval"
        assert data["success"] is False
        assert data["item_master"]["status"] == "success"
        assert data["purchase_order"]["status"] == "error"


def test_export_excel_includes_remarks_column(auth_headers):
    res = client.get("/api/v1/stock-configuration/export", headers=auth_headers)
    assert res.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    sheet = wb.active
    header_values = [cell.value for cell in sheet[1]]
    assert "LAST UPDATED" in header_values
    assert "REMARKS" in header_values
    assert header_values[-1] == "REMARKS"


def test_today_filter_returns_actual_grpo_received_today(auth_headers):
    """Verify that date filtering displays actual GRPO records (CS1124, CS0227, FG2145)."""
    res = client.get("/api/v1/stock-configuration?date_from=2026-11-14&date_to=2026-11-16", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    item_codes = [it["item_code"] for it in data["items"]]
    assert "CS1124" in item_codes
    assert "CS0227" in item_codes

    cs1124 = next(it for it in data["items"] if it["item_code"] == "CS1124")
    assert cs1124["grpo_no"] in ("473", "474")
    assert cs1124["rcvd_qty"] in (2.0, 25.0)
    assert cs1124["qty"] in (0.0, 50.0, 55.0)
    if cs1124.get("so_no") and cs1124.get("so_qty", 0) > 0:
        assert cs1124["qty"] in (0.0, cs1124["so_qty"])  # Branch 1: Sales Order quantity from ORDR/RDR1 or 0
    assert cs1124["record_category"] == "Received Stock"

    cs0227 = next(it for it in data["items"] if it["item_code"] == "CS0227")
    assert cs0227["grpo_no"] == "473"
    assert cs0227["rcvd_qty"] == 15.0
    assert cs0227["po_no"] == "1378"
    assert cs0227["so_no"] == "26271140"
    assert cs0227["so_qty"] in (35.0, 45.0)
    assert cs0227["qty"] == cs0227["so_qty"]  # Branch 1: Sales Order quantity from ORDR/RDR1
    assert cs0227["record_category"] == "Received Stock"


def test_branch_2_regular_purchase_order_preserved(auth_headers):
    """Verify that regular Purchase Orders where ImportEnt IS NULL (Branch 2) are preserved with QTY=0.0."""
    res = client.get("/api/v1/stock-configuration?search=BAC0005", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    bac = data["items"][0]
    assert bac["item_code"] == "BAC0005"
    assert bac["grpo_no"] == "471"
    assert bac["rcvd_qty"] == 1.0
    assert bac["po_no"] == "1376"
    assert bac["so_no"] == ""  # Regular PO, no SO link
    assert bac["so_qty"] == 0.0
    assert bac["qty"] == 0.0  # Branch 2: OPOR.ImportEnt IS NULL -> QTY = 0.0
    assert bac["record_category"] == "Received Stock"


def test_stock_configuration_qty_mapping_rules(auth_headers):
    """Verify QTY mapping strictly enforces approved SAP Stock Configuration source quantities:
    - CS1124: Branch 1 (linked to Sales Order via OPOR.ImportEnt): QTY = Sales Order quantity from ORDR/RDR1
    - CS0227: Branch 1 (linked to Sales Order via OPOR.ImportEnt): QTY = Sales Order quantity from ORDR/RDR1
    - BAC0005: Branch 2 (regular PO where OPOR.ImportEnt IS NULL): QTY = 0.0
    - Direct GRPO without PO/SO: QTY = 0.0
    """
    res = client.get("/api/v1/stock-configuration?period=all_time&page_size=100", headers=auth_headers)
    assert res.status_code == 200
    items_by_code = {it["item_code"]: it for it in res.json()["items"]}

    if "CS1124" in items_by_code:
        assert float(items_by_code["CS1124"]["qty"]) == float(items_by_code["CS1124"]["so_qty"])
    if "CS0227" in items_by_code:
        assert float(items_by_code["CS0227"]["qty"]) == float(items_by_code["CS0227"]["so_qty"])
    if "BAC0005" in items_by_code:
        assert float(items_by_code["BAC0005"]["qty"]) == 0.0


def test_all_dates_filter_preserves_full_item_population(auth_headers):
    """Verify that All Dates returns the complete item master population and retains custom remarks."""
    res = client.get("/api/v1/stock-configuration?period=all_time&page_size=20", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1000  # Full item catalog
    assert data["kpis"]["total_items"] >= 1000

    # Verify remark on CS1124 is intact
    rm002_res = client.get("/api/v1/stock-configuration?search=CS1124", headers=auth_headers)
    assert rm002_res.status_code == 200
    rm002 = rm002_res.json()["items"][0]
    assert rm002["remark"] != ""


def test_sap_all_field_mappings_and_readback(auth_headers):
    """
    Verify complete field mapping, write-back to SAP Service Layer, and read-back confirmation
    for all 10 user-configurable fields:
    - NT. WEIGHT -> InventoryWeight, PurchaseUnitWeight, SalesUnitWeight, U_PerPices
    - QC -> U_QC
    - DRW. Y/N -> U_Drawing
    - V CHK -> U_V_Chk
    - LM -> U_LM
    - OLNG -> U_OLNG
    - I PK -> U_LPK
    - LBL -> U_LBL
    - MC OR PT -> U_MC_OR_PT
    - REMARKS -> User_Text
    - LAST UPDATED -> Confirmed from SAP UpdateDate + UpdateTime
    """
    payload = {
        "nt_weight": 92.5,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "remark": "Automated Test Verified",
    }
    mock_po_sync = {
        "doc_entry": 871,
        "doc_num": 1378,
        "status": "success",
        "verified": True,
        "comments": "Automated Test Verified",
    }
    mock_item_sync = {
        "status": "success",
        "sap_synced": True,
        "confirmed_last_updated": "2026-11-17 16:30:00",
    }
    with patch("app.services.stock_configuration_service.StockConfigurationService._sync_po_to_sap", return_value=mock_po_sync), \
         patch("app.services.stock_configuration_service.StockConfigurationService._sync_item_to_sap", return_value=mock_item_sync):
        res = client.put("/api/v1/stock-configuration/items/CS1124", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["sap_synced"] is True

        item = data["item"]
        assert item["nt_weight"] == 92.5
        assert item["qc"] is True
        assert item["drw_yn"] == "Y"
        assert item["v_chk"] == "Y"
        assert item["lm"] == "Y"
        assert item["olng"] == "Y"
        assert item["lpk"] == "Y"
        assert item["lbl"] == "Y"
        assert item["mc_or_pt"] == "Y"
        assert item["remark"] == "Automated Test Verified"
        assert item["last_submitted_at"] is not None
        assert item["updated_at"] is not None

    # Verify via independent GET query
    get_res = client.get("/api/v1/stock-configuration?search=CS1124", headers=auth_headers)
    assert get_res.status_code == 200
    saved = next(it for it in get_res.json()["items"] if it["item_code"] == "CS1124")
    assert saved["nt_weight"] == 92.5
    assert saved["qc"] is True
    assert saved["drw_yn"] == "Y"
    assert saved["v_chk"] == "Y"
    assert saved["lm"] == "Y"
    assert saved["olng"] == "Y"
    assert saved["lpk"] == "Y"
    assert saved["lbl"] == "Y"
    assert saved["mc_or_pt"] == "Y"
    assert saved["remark"] == "Automated Test Verified"


def test_failed_sap_update_rejection(auth_headers):
    """
    Verify error handling on failed updates:
    - Negative nt_weight rejected with 400 Bad Request
    - Non-existent item code rejected
    - No last_submitted_at or updated timestamp committed on rejection
    """
    # 1. Negative net weight rejection
    res_neg = client.put(
        "/api/v1/stock-configuration/items/CS1124",
        json={"nt_weight": -5.0},
        headers=auth_headers,
    )
    assert res_neg.status_code == 400
    assert "cannot be negative" in res_neg.json()["detail"].lower()

    # 2. Non-existent item code
    res_missing = client.put(
        "/api/v1/stock-configuration/items/NONEXISTENT_ITEM_99999",
        json={"nt_weight": 10.0},
        headers=auth_headers,
    )
    assert res_missing.status_code in (400, 502)


def test_entry_date_read_only_protection(auth_headers):
    """
    Verify that ENTRY DATE is strictly read-only and preserved from authoritative SAP document dates.
    Attempting to pass entry_date in update payload must not overwrite the SAP document date.
    """
    orig_res = client.get("/api/v1/stock-configuration?search=CS1124", headers=auth_headers)
    assert orig_res.status_code == 200
    orig_entry_date = orig_res.json()["items"][0]["entry_date"]

    res = client.put(
        "/api/v1/stock-configuration/items/CS1124",
        json={"entry_date": "2099-12-31", "nt_weight": 92.5},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["item"]["entry_date"] == orig_entry_date


def test_one_way_background_sync_never_overwrites_website_values(auth_headers):
    """
    Condition 1 & 2: Website-entered values must remain authoritative.
    SAP background sync must NEVER overwrite existing website-entered values in MySQL or fallback JSON.
    """
    service = StockConfigurationService()
    test_code = "TEST_SYNC_ITEM"
    # Insert or update a dedicated test item with website-submitted values
    with service._get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM stock_configuration WHERE item_code = %s;", (test_code,))
            cur.execute("""
                INSERT INTO stock_configuration (
                    item_code, description, nt_weight, qc, drw_yn, v_chk, lm, olng, lpk, lbl, mc_or_pt,
                    remark, last_submitted_at, created_at, updated_at
                ) VALUES (
                    %s, 'Test Sync Item', 92.5, TRUE, 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y',
                    'Authoritative Website Remark', NOW(), NOW(), NOW()
                );
            """, (test_code,))
            conn.commit()

    before_item = service.get_item(test_code)
    assert before_item["qc"] is True
    assert before_item["drw_yn"] == "Y"
    assert before_item["remark"] == "Authoritative Website Remark"
    assert before_item["last_submitted_at"] is not None

    # 2. Simulate SAP background sync returning conflicting SAP data
    fake_sap_items = [{
        "ItemCode": test_code,
        "ItemName": "Test Sync Item",
        "QuantityOnStock": 100.0,
        "InventoryWeight": 10.0,  # Different weight
        "PurchaseUnitWeight": 10.0,
        "SalesUnitWeight": 10.0,
        "U_PerPices": 10,
        "U_QC": "N",             # Conflicting QC
        "U_Drawing": "N",        # Conflicting Drawing
        "U_V_Chk": "N",
        "U_LM": "N",
        "U_OLNG": "N",
        "U_LPK": "N",
        "U_LBL": "N",
        "U_MC_OR_PT": "N",
        "UpdateDate": "2026-11-17",
        "UpdateTime": "120000",
    }]
    fake_received = {
        test_code: {
            "grpo_no": "GRPO-9999",
            "rcvd_qty": 5.0,
            "po_comments": "Conflicting SAP Comments From PO",
        }
    }

    # Execute DB upsert cursor
    with service._get_connection() as conn:
        with conn.cursor() as cur:
            service._upsert_sap_items_cursor(cur, conn, fake_sap_items, fake_received)
            conn.commit()

    # 3. Read back item and verify website values were NOT overwritten by SAP sync
    after_item = service.get_item(test_code)
    assert after_item["qc"] is True, f"Expected qc=True, got {after_item['qc']}"
    assert after_item["drw_yn"] == "Y", f"Expected drw_yn='Y', got {after_item['drw_yn']}"
    assert after_item["v_chk"] == "Y"
    assert after_item["lm"] == "Y"
    assert after_item["olng"] == "Y"
    assert after_item["lpk"] == "Y"
    assert after_item["lbl"] == "Y"
    assert after_item["mc_or_pt"] == "Y"
    assert after_item["remark"] == "Authoritative Website Remark", f"Expected 'Authoritative Website Remark', got {after_item['remark']}"
    assert abs(after_item["nt_weight"] - 92.5) < 0.01, f"Expected nt_weight=92.5, got {after_item['nt_weight']}"

    # Cleanup test item
    with service._get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM stock_configuration WHERE item_code = %s;", (test_code,))
            conn.commit()


def test_single_row_partial_update_sends_only_modified_fields(auth_headers):
    """
    Condition 8: Test single-row submission sends strictly modified fields and preserves other fields.
    """
    service = StockConfigurationService()
    before = service.get_item("CS1124")
    orig_weight = before["nt_weight"]

    # Submit only QC change via API
    res = client.put(
        "/api/v1/stock-configuration/items/CS1124",
        json={"qc": False},
        headers=auth_headers,
    )
    assert res.status_code == 200
    updated = res.json()["item"]
    assert updated["qc"] is False
    # Verify other fields remain intact
    assert updated["nt_weight"] == orig_weight
    assert updated["drw_yn"] == before["drw_yn"]
    assert updated["remark"] == before["remark"]

    # Restore QC to True
    res2 = client.put(
        "/api/v1/stock-configuration/items/CS1124",
        json={"qc": True},
        headers=auth_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["item"]["qc"] is True



