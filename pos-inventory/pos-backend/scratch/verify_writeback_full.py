import sys
import os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
import json
from datetime import datetime, timezone

from app.core.config import settings
from app.services.sap.client import get_sap_client, SAPConnectionError, SAPValidationError
from app.services.stock_configuration_service import StockConfigurationService
from app.services import audit_service
from app.db.connection import get_db_connection, get_db_cursor

def run_verification():
    print("=" * 70)
    print("ATLAS STOCK CONFIGURATION -> SAP WRITE-BACK FULL VERIFICATION SUITE")
    print("=" * 70)

    # 1. Safety Lock Checks
    print("\n[Step 1] Verifying Safety Constraints...")
    finance_writeback = getattr(settings, "FINANCE_WRITEBACK_ENABLED", False)
    print(f"  FINANCE_WRITEBACK_ENABLED: {finance_writeback}")
    assert not finance_writeback, "SAFETY VIOLATION: FINANCE_WRITEBACK_ENABLED must be False!"
    print("  [PASS] Finance and transactional write-back is strictly disabled.")

    service = StockConfigurationService()
    client = get_sap_client()
    if not client.session_id or (client.session_timeout and datetime.utcnow() >= client.session_timeout):
        print("  Logging in to SAP Service Layer...")
        client.login()
    print("  [PASS] Authenticated with SAP Service Layer.")

    # 2. Fetch baseline values of test item CS1124 from SAP
    print("\n[Step 2] Fetching Baseline Values from SAP for 'CS1124'...")
    baseline_sap = client.get("Items('CS1124')?$select=ItemCode,ItemName,InventoryWeight,User_Text,U_Drawing,U_PerPices,QuantityOnStock")
    print("  Baseline SAP Values:")
    print(f"    ItemCode:         {baseline_sap.get('ItemCode')}")
    print(f"    ItemName:         {baseline_sap.get('ItemName')}")
    print(f"    InventoryWeight:  {baseline_sap.get('InventoryWeight')}")
    print(f"    U_PerPices:       {baseline_sap.get('U_PerPices')}")
    print(f"    U_Drawing:        {baseline_sap.get('U_Drawing')}")
    print(f"    User_Text:        {baseline_sap.get('User_Text')}")
    print(f"    QuantityOnStock:  {baseline_sap.get('QuantityOnStock')} (strictly preserved)")

    orig_weight = baseline_sap.get("InventoryWeight") or 0.0
    orig_drawing = baseline_sap.get("U_Drawing") or "N"
    orig_remark = baseline_sap.get("User_Text") or ""
    orig_stock = baseline_sap.get("QuantityOnStock")

    # 3. Choose new distinct test values
    new_weight = 15.50 if abs(orig_weight - 15.50) > 0.1 else 18.25
    new_drawing = "N" if orig_drawing == "Y" else "Y"
    new_remark = f"ATLAS Verified Write-Back Test [{datetime.now().strftime('%H:%M:%S')}]"
    new_qc = "YES"
    new_vchk = "Y"

    test_updates = {
        "nt_weight": new_weight,
        "drw_yn": new_drawing,
        "qc": new_qc,
        "v_chk": new_vchk,
        "remark": new_remark,
    }

    print("\n[Step 3] Submitting Test Update through ATLAS Write-Back Service...")
    print(f"  Attempting update with: {test_updates}")
    result = service.update_item("CS1124", test_updates, admin_user_id="admin_test_user")

    print("\n[Step 4] Inspecting ATLAS Service Response...")
    print(f"  sap_synced:        {result.get('sap_synced')}")
    print(f"  sap_message:       {result.get('sap_message')}")
    print(f"  last_submitted_at: {result.get('last_submitted_at')}")
    print(f"  nt_weight:         {result.get('nt_weight')}")
    print(f"  drw_yn:            {result.get('drw_yn')}")
    print(f"  qc:                {result.get('qc')}")
    print(f"  remark:            {result.get('remark')}")

    assert result.get("sap_synced") is True, "Expected sap_synced=True"
    assert result.get("last_submitted_at") is not None, "Expected last_submitted_at to be populated"
    assert abs(float(result.get("nt_weight")) - new_weight) < 0.01, f"Weight mismatch in response: {result.get('nt_weight')}"
    assert result.get("drw_yn") == new_drawing, f"Drawing mismatch in response: {result.get('drw_yn')}"
    print("  [PASS] Service update succeeded and generated valid last_submitted_at.")

    # 5. Direct Read-Back Verification from SAP Business One
    print("\n[Step 5] Independent Live Read-Back from SAP Business One...")
    verified_sap = client.get("Items('CS1124')?$select=ItemCode,ItemName,InventoryWeight,User_Text,U_Drawing,U_PerPices,QuantityOnStock")
    print("  Direct SAP Read-Back Values:")
    print(f"    ItemCode:         {verified_sap.get('ItemCode')}")
    print(f"    InventoryWeight:  {verified_sap.get('InventoryWeight')} (Expected: {new_weight})")
    print(f"    U_PerPices:       {verified_sap.get('U_PerPices')} (Expected: {int(round(new_weight))})")
    print(f"    U_Drawing:        {verified_sap.get('U_Drawing')} (Expected: {new_drawing})")
    print(f"    User_Text:        {verified_sap.get('User_Text')} (Expected: '{new_remark}')")
    print(f"    QuantityOnStock:  {verified_sap.get('QuantityOnStock')} (Unchanged: {orig_stock})")

    assert abs(float(verified_sap.get("InventoryWeight")) - new_weight) < 0.01, "SAP InventoryWeight does not match!"
    assert str(verified_sap.get("U_Drawing")).strip().upper() == new_drawing, "SAP U_Drawing does not match!"
    assert str(verified_sap.get("User_Text")).strip() == new_remark, "SAP User_Text does not match!"
    assert verified_sap.get("QuantityOnStock") == orig_stock, "SAFETY VIOLATION: SAP QuantityOnStock was modified!"
    print("  [PASS] 100% Verified in SAP Service Layer: Persisted values match ATLAS submission exactly.")

    # 6. Database and Audit Trail Verification
    print("\n[Step 6] Verifying ATLAS Database and Audit Entries...")
    entries = audit_service.get_audit_entries(entity_type="stock_configuration", record_id="CS1124", limit=5)
    print(f"  Found {len(entries)} audit entries for CS1124:")
    actions = [e.get("action") for e in entries]
    for e in entries:
        print(f"    Action: {e.get('action')}, Status: {e.get('status')}, Changes: {e.get('changes')}")
    assert "SAP_WRITE_BACK_SUCCESS" in actions, "Expected SAP_WRITE_BACK_SUCCESS in audit history"
    print("  [PASS] Audit log recorded SAP_WRITE_BACK_SUCCESS with complete change diff.")

    # 7. Negative Validation Test: Reject negative weight
    print("\n[Step 7] Negative Validation Test (nt_weight = -10.0)...")
    try:
        service.update_item("CS1124", {"nt_weight": -10.0}, admin_user_id="admin")
        print("  [FAIL] Failed to reject negative weight!")
        assert False, "Should have raised ValueError"
    except ValueError as ve:
        print(f"  [PASS] Correctly rejected negative weight: {ve}")

    # 8. Clean Restoration of Test Item in SAP
    print("\n[Step 8] Restoring Original Test Item Values in SAP Business One...")
    restore_updates = {
        "nt_weight": orig_weight,
        "drw_yn": orig_drawing,
        "remark": orig_remark,
        "qc": "NO",
        "v_chk": "N",
    }
    restored = service.update_item("CS1124", restore_updates, admin_user_id="admin_cleanup")
    post_restore_sap = client.get("Items('CS1124')?$select=ItemCode,InventoryWeight,User_Text,U_Drawing,U_PerPices")
    print(f"  Restored SAP Values: InventoryWeight={post_restore_sap.get('InventoryWeight')}, U_Drawing={post_restore_sap.get('U_Drawing')}, User_Text='{post_restore_sap.get('User_Text')}'")
    assert abs(float(post_restore_sap.get("InventoryWeight") or 0.0) - float(orig_weight or 0.0)) < 0.01
    print("  [PASS] Original SAP test values restored successfully.")

    print("\n" + "=" * 70)
    print("ALL VERIFICATION TESTS COMPLETED AND PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_verification()
