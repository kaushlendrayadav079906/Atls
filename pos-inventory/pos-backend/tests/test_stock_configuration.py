"""Unit and integration tests for Stock Configuration API and Service."""

import io
import pytest
import openpyxl
from fastapi.testclient import TestClient

from app.main import app
from app.services.stock_configuration_service import StockConfigurationService

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
    assert data["kpis"]["active_items"] >= 24
    assert data["kpis"]["inactive_items"] >= 2
    assert data["kpis"]["warehouses_count"] >= 5


def test_update_stock_configuration_item(auth_headers):
    # Fetch original item first to verify SAP fields remain unchanged
    orig_res = client.get("/api/v1/stock-configuration?page=1&page_size=10", headers=auth_headers)
    assert orig_res.status_code == 200
    orig_fg001 = next(it for it in orig_res.json()["items"] if it["item_code"] == "FG001")
    orig_qty = orig_fg001["qty"]
    orig_grpo = orig_fg001["grpo_no"]

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
    response = client.put("/api/v1/stock-configuration/items/FG001", json=update_payload, headers=auth_headers)
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
    # Toggle QC to N
    res_n = client.put("/api/v1/stock-configuration/items/FG001", json={"qc": "N"}, headers=auth_headers)
    assert res_n.status_code == 200
    assert res_n.json()["item"]["qc"] is False

    # Verify via GET
    get_res = client.get("/api/v1/stock-configuration?search=FG001", headers=auth_headers)
    item_n = next(it for it in get_res.json()["items"] if it["item_code"] == "FG001")
    assert item_n["qc"] is False

    # Toggle QC back to Y
    res_y = client.put("/api/v1/stock-configuration/items/FG001", json={"qc": "Y"}, headers=auth_headers)
    assert res_y.status_code == 200
    assert res_y.json()["item"]["qc"] is True


def test_sap_owned_fields_bulk_and_import_protection(auth_headers):
    # 1. Bulk update protection
    bulk_res = client.post(
        "/api/v1/stock-configuration/bulk-update",
        json={"items": [{"item_code": "FG001", "qty": 8888.0, "vendor_name": "MALICIOUS", "nt_weight": 14.2, "qc": "Y"}]},
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
    ws.append(["FG001", "Hacked Description", 7777, 7777, "Hacked Vendor", "9999", 14.5, "Y"])
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

    # Verify FG001 still has legitimate description and vendor
    chk_res = client.get("/api/v1/stock-configuration?search=FG001", headers=auth_headers)
    chk_item = next(it for it in chk_res.json()["items"] if it["item_code"] == "FG001")
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
    # 1. Update single item FG001
    put_res = client.put(
        "/api/v1/stock-configuration/items/FG001",
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
    get_res = client.get("/api/v1/stock-configuration?search=FG001", headers=auth_headers)
    assert get_res.status_code == 200
    item = next(it for it in get_res.json()["items"] if it["item_code"] == "FG001")
    assert item["last_submitted_at"] == submitted_ts

    # 3. Verify bulk update also sets and returns last_submitted_at
    bulk_res = client.post(
        "/api/v1/stock-configuration/bulk-update",
        json={"items": [{"item_code": "FG001", "nt_weight": 14.9}]},
        headers=auth_headers,
    )
    assert bulk_res.status_code == 200
    bulk_item = bulk_res.json()["results"][0]["item"]
    assert "last_submitted_at" in bulk_item
    assert bulk_item["last_submitted_at"] is not None


def test_admin_remarks_submission_and_audit_history(auth_headers):
    # 1. Admin submits initial remark on FG001
    remark1 = "Batch inspected and approved by Admin"
    res1 = client.put(
        "/api/v1/stock-configuration/items/FG001",
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
    get_res = client.get("/api/v1/stock-configuration?search=FG001", headers=auth_headers)
    assert get_res.status_code == 200
    item = next(it for it in get_res.json()["items"] if it["item_code"] == "FG001")
    assert item["remark"] == remark1

    # 2. Admin submits an updated remark on FG001
    remark2 = "Packaging QC verified; ready for dispatch"
    res2 = client.put(
        "/api/v1/stock-configuration/items/FG001",
        json={"remark": remark2},
        headers=auth_headers,
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["remark"] == remark2
    assert data2["item"]["remark"] == remark2

    # 3. Verify remarks audit history endpoint preserves previous remarks
    hist_res = client.get("/api/v1/stock-configuration/items/FG001/remarks-history", headers=auth_headers)
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
        "/api/v1/stock-configuration/items/FG001",
        json={"remark": "Unauthorized remark by non-admin"},
        headers=user_headers,
    )
    assert res.status_code == 403
    assert "Only authorized Admin users can add or modify remarks" in res.json()["detail"]

    # Non-admin bulk update with remark should also be rejected with 403
    bulk_res = client.post(
        "/api/v1/stock-configuration/bulk-update",
        json={"items": [{"item_code": "FG001", "remark": "Hacked remark"}]},
        headers=user_headers,
    )
    assert bulk_res.status_code == 403
    assert "Only authorized Admin users can add or modify remarks" in bulk_res.json()["detail"]


def test_bulk_update_preserves_existing_remarks(auth_headers):
    # Set a remark on RM002
    res_set = client.put(
        "/api/v1/stock-configuration/items/RM002",
        json={"remark": "Special Raw Material Grade A"},
        headers=auth_headers,
    )
    assert res_set.status_code == 200

    # Bulk update updating other fields (nt_weight) without supplying remark
    bulk_res = client.post(
        "/api/v1/stock-configuration/bulk-update",
        json={"items": [{"item_code": "RM002", "nt_weight": 9.5}]},
        headers=auth_headers,
    )
    assert bulk_res.status_code == 200
    updated_rm = bulk_res.json()["results"][0]["item"]
    # Remark must be preserved and not wiped
    assert updated_rm["remark"] == "Special Raw Material Grade A"
    assert updated_rm["nt_weight"] == 9.5


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
    """Verify that selecting Today displays today's actual GRPO records (CS1124, CS0227, FG2145)."""
    res = client.get("/api/v1/stock-configuration?period=today", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    item_codes = [it["item_code"] for it in data["items"]]
    assert "CS1124" in item_codes
    assert "CS0227" in item_codes

    cs1124 = next(it for it in data["items"] if it["item_code"] == "CS1124")
    assert cs1124["grpo_no"] == "473"
    assert cs1124["rcvd_qty"] == 25.0
    assert cs1124["po_no"] == "1378"
    assert cs1124["so_no"] == "26271140"
    assert cs1124["so_qty"] == 50.0
    assert cs1124["qty"] == 50.0  # Business rule: SO QTY = SUM(RDR1.Quantity)
    assert cs1124["record_category"] == "Received Stock"
    assert cs1124["grn_date"] == "2026-11-14"

    cs0227 = next(it for it in data["items"] if it["item_code"] == "CS0227")
    assert cs0227["grpo_no"] == "473"
    assert cs0227["rcvd_qty"] == 15.0
    assert cs0227["po_no"] == "1378"
    assert cs0227["so_no"] == "26271140"
    assert cs0227["so_qty"] == 35.0
    assert cs0227["qty"] == 35.0  # Business rule: SO QTY = SUM(RDR1.Quantity)
    assert cs0227["record_category"] == "Received Stock"


def test_branch_2_regular_purchase_order_preserved(auth_headers):
    """Verify that regular Purchase Orders where ImportEnt IS NULL (Branch 2) are preserved."""
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
    assert bac["qty"] == 0.0  # Business rule: SO QTY = 0 for regular purchase orders
    assert bac["record_category"] == "Received Stock"


def test_stock_configuration_qty_mapping_rules(auth_headers):
    """Verify QTY mapping strictly enforces reference SQL logic:
    - SO QTY = SUM(RDR1.Quantity) for linked Sales Orders.
    - SO QTY = 0 for regular Purchase Orders where OPOR.ImportEnt IS NULL.
    - No substitution with PO quantity, GRPO received quantity, or seed data.
    """
    res = client.get("/api/v1/stock-configuration?period=all_time&page_size=100", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()["items"]
    for item in items:
        so_no = str(item.get("so_no") or "").strip()
        so_qty = float(item.get("so_qty") or 0.0)
        qty = float(item.get("qty") or 0.0)
        if so_no and so_qty > 0:
            assert qty == so_qty, f"Item {item.get('item_code')} has SO {so_no} with SO QTY {so_qty} but qty={qty}"
        else:
            assert qty == 0.0, f"Item {item.get('item_code')} without SO link must have qty=0.0, found {qty}"


def test_all_dates_filter_preserves_full_item_population(auth_headers):
    """Verify that All Dates returns the complete item master population and retains custom remarks."""
    res = client.get("/api/v1/stock-configuration?period=all_time&page_size=20", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1000  # Full item catalog
    assert data["kpis"]["total_items"] >= 1000

    # Verify remark on RM002 is intact
    rm002_res = client.get("/api/v1/stock-configuration?search=RM002", headers=auth_headers)
    assert rm002_res.status_code == 200
    rm002 = rm002_res.json()["items"][0]
    assert rm002["remark"] == "Special Raw Material Grade A"

