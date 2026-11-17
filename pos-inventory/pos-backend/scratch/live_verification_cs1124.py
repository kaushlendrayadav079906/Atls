import sys
import os
import json
from dotenv import load_dotenv

# Load backend configuration
env_path = os.path.abspath("pos-inventory/pos-backend/.env")
load_dotenv(env_path)
sys.path.insert(0, os.path.abspath("pos-inventory/pos-backend"))

from app.services.sap.client import get_sap_client
from app.services.stock_configuration_service import StockConfigurationService

def run_verification():
    print("=== LIVE SAP WRITE-BACK & READ-BACK VERIFICATION: CS1124 ===")
    client = get_sap_client()
    client.login()

    select_props = "ItemCode,ItemName,InventoryWeight,PurchaseUnitWeight,SalesUnitWeight,User_Text,U_Drawing,U_PerPices,U_QC,U_V_Chk,U_LM,U_OLNG,U_LPK,U_LBL,U_MC_OR_PT,UpdateDate,UpdateTime,CreateDate"

    # Step 1: Pre-Submission Baseline Read directly from SAP Service Layer
    print("\n--- 1. BEFORE SUBMISSION (Direct SAP Read-Back) ---")
    before_sap = client.get("Items('CS1124')", params={"$select": select_props})
    print(f"ItemCode: {before_sap.get('ItemCode')}")
    print(f"NT. WEIGHT (U_PerPices): {before_sap.get('U_PerPices')}")
    print(f"NT. WEIGHT (InventoryWeight): {before_sap.get('InventoryWeight')}")
    print(f"QC (U_QC): {before_sap.get('U_QC')}")
    print(f"DRW. Y/N (U_Drawing): {before_sap.get('U_Drawing')}")
    print(f"V CHK (U_V_Chk): {before_sap.get('U_V_Chk')}")
    print(f"LM (U_LM): {before_sap.get('U_LM')}")
    print(f"OLNG (U_OLNG): {before_sap.get('U_OLNG')}")
    print(f"I PK (U_LPK): {before_sap.get('U_LPK')}")
    print(f"LBL (U_LBL): {before_sap.get('U_LBL')}")
    print(f"MC OR PT (U_MC_OR_PT): {before_sap.get('U_MC_OR_PT')}")
    print(f"REMARKS (User_Text): {repr(before_sap.get('User_Text'))}")
    print(f"LAST UPDATED (UpdateDate + UpdateTime): {before_sap.get('UpdateDate')} {before_sap.get('UpdateTime')}")
    print(f"ENTRY DATE (CreateDate): {before_sap.get('CreateDate')}")

    # Step 2: Submission Payload
    print("\n--- 2. SUBMITTED PAYLOAD ---")
    submit_payload = {
        "nt_weight": 95.5,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "remark": "Live Verification Test 2026-11-17 Verified",
    }
    print(json.dumps(submit_payload, indent=2))

    # Step 3: Execute Update via StockConfigurationService
    print("\n--- 3. EXECUTING SERVICE UPDATE & SAP WRITE-BACK ---")
    svc = StockConfigurationService()
    service_result = svc.update_item("CS1124", submit_payload, admin_user_id="admin")
    print(f"Update Result Success: {service_result.get('sap_synced')}")
    print(f"SAP Message: {service_result.get('sap_message')}")
    print(f"Updated At (SAP-confirmed): {service_result.get('updated_at')}")
    print(f"Last Submitted At: {service_result.get('last_submitted_at')}")

    # Step 4: Independent Read-Back directly from SAP Service Layer
    print("\n--- 4. POST-SUBMISSION SAP READ-BACK (Independent Verification) ---")
    after_sap = client.get("Items('CS1124')", params={"$select": select_props})
    print(f"ItemCode: {after_sap.get('ItemCode')}")
    print(f"NT. WEIGHT (U_PerPices): {after_sap.get('U_PerPices')}")
    print(f"NT. WEIGHT (InventoryWeight): {after_sap.get('InventoryWeight')}")
    print(f"QC (U_QC): {after_sap.get('U_QC')}")
    print(f"DRW. Y/N (U_Drawing): {after_sap.get('U_Drawing')}")
    print(f"V CHK (U_V_Chk): {after_sap.get('U_V_Chk')}")
    print(f"LM (U_LM): {after_sap.get('U_LM')}")
    print(f"OLNG (U_OLNG): {after_sap.get('U_OLNG')}")
    print(f"I PK (U_LPK): {after_sap.get('U_LPK')}")
    print(f"LBL (U_LBL): {after_sap.get('U_LBL')}")
    print(f"MC OR PT (U_MC_OR_PT): {after_sap.get('U_MC_OR_PT')}")
    print(f"REMARKS (User_Text): {repr(after_sap.get('User_Text'))}")
    print(f"LAST UPDATED (UpdateDate + UpdateTime): {after_sap.get('UpdateDate')} {after_sap.get('UpdateTime')}")

    # Step 5: Assert All Field Values
    assert after_sap.get("U_PerPices") == 96, f"Expected 96, got {after_sap.get('U_PerPices')}"
    assert abs(float(after_sap.get("InventoryWeight")) - 95.5) < 0.01, f"Weight mismatch"
    assert after_sap.get("U_QC") == "Y", f"QC mismatch"
    assert after_sap.get("U_Drawing") == "Y", f"Drawing mismatch"
    assert after_sap.get("U_V_Chk") == "Y", f"V_Chk mismatch"
    assert after_sap.get("U_LM") == "Y", f"LM mismatch"
    assert after_sap.get("U_OLNG") == "Y", f"OLNG mismatch"
    assert after_sap.get("U_LPK") == "Y", f"LPK mismatch"
    assert after_sap.get("U_LBL") == "Y", f"LBL mismatch"
    assert after_sap.get("U_MC_OR_PT") == "Y", f"MC_OR_PT mismatch"
    assert after_sap.get("User_Text") == "Live Verification Test 2026-11-17 Verified", f"User_Text mismatch"
    print("\n>>> ALL INDEPENDENT SAP READ-BACK ASSERTIONS PASSED! <<<")

    # Step 6: Verify Frontend-facing API response
    print("\n--- 5. FINAL FRONTEND-FACING DISPLAY ITEM ---")
    frontend_item = svc.get_item("CS1124")
    print(f"Item Code: {frontend_item.get('item_code')}")
    print(f"Description: {frontend_item.get('description')}")
    print(f"NT. WEIGHT: {frontend_item.get('nt_weight')}")
    print(f"QC: {frontend_item.get('qc')}")
    print(f"DRW. Y/N: {frontend_item.get('drw_yn')}")
    print(f"V CHK: {frontend_item.get('v_chk')}")
    print(f"LM: {frontend_item.get('lm')}")
    print(f"OLNG: {frontend_item.get('olng')}")
    print(f"I PK: {frontend_item.get('lpk')}")
    print(f"LBL: {frontend_item.get('lbl')}")
    print(f"MC OR PT: {frontend_item.get('mc_or_pt')}")
    print(f"REMARKS: {frontend_item.get('remark')}")
    print(f"ENTRY DATE: {frontend_item.get('entry_date')}")
    print(f"LAST UPDATED: {frontend_item.get('updated_at')}")
    print(f"LAST SUBMITTED AT: {frontend_item.get('last_submitted_at')}")

if __name__ == "__main__":
    run_verification()
