import sys, os, time
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.services.stock_configuration_service import stock_configuration_service
from app.services.sap.client import get_sap_client
from app.db.connection import get_db_connection, get_db_cursor

client = get_sap_client()
client.login()

# Target fields to test individually on CS1124
test_cases = [
    {
        "field": "qc",
        "sap_property": "U_QC",
        "atlas_value": True,
        "expected_sap": "Y",
    },
    {
        "field": "v_chk",
        "sap_property": "U_V_Chk",
        "atlas_value": "Y",
        "expected_sap": "Y",
    },
    {
        "field": "lm",
        "sap_property": "U_LM",
        "atlas_value": "Y",
        "expected_sap": "Y",
    },
    {
        "field": "olng",
        "sap_property": "U_OLNG",
        "atlas_value": "Y",
        "expected_sap": "Y",
    },
    {
        "field": "lpk",
        "sap_property": "U_LPK",
        "atlas_value": "Y",
        "expected_sap": "Y",
    },
    {
        "field": "lbl",
        "sap_property": "U_LBL",
        "atlas_value": "Y",
        "expected_sap": "Y",
    },
    {
        "field": "mc_or_pt",
        "sap_property": "U_MC_OR_PT",
        "atlas_value": "Y",
        "expected_sap": "Y",
    },
]

print("=================================================================", flush=True)
print("STARTING INDIVIDUAL FIELD WRITE-BACK & VERIFICATION ON CS1124", flush=True)
print("=================================================================", flush=True)

results = []

for tc in test_cases:
    f_name = tc["field"]
    sap_prop = tc["sap_property"]
    val_to_submit = tc["atlas_value"]
    expected_sap = tc["expected_sap"]

    print(f"\n--- Testing Field: {f_name.upper()} ({sap_prop}) ---", flush=True)

    # 1. Record original SAP value
    pre_item = client.get(f"Items('CS1124')?$select=ItemCode,{sap_prop},UpdateDate,UpdateTime")
    orig_val = pre_item.get(sap_prop)
    print(f"1. Original SAP value: {orig_val}", flush=True)

    # 2. Submit new value via ATLAS service
    submit_payload = {f_name: val_to_submit}
    t0 = time.time()
    try:
        update_res = stock_configuration_service.update_item("CS1124", submit_payload, admin_user_id="integration_tester")
        duration = round(time.time() - t0, 2)
        sap_synced = update_res.get("sap_synced")
        print(f"2. ATLAS update_item completed in {duration}s. sap_synced: {sap_synced}", flush=True)
    except Exception as e:
        print(f"2. FAILED to update in ATLAS: {e}", flush=True)
        results.append({
            "field": f_name.upper(),
            "sap_property": sap_prop,
            "orig_sap": orig_val,
            "submitted": val_to_submit,
            "readback_sap": None,
            "status": "FAIL",
            "error": str(e)
        })
        continue

    # 3. Read back value directly from SAP Service Layer
    post_item = client.get(f"Items('CS1124')?$select=ItemCode,{sap_prop},UpdateDate,UpdateTime")
    readback_val = post_item.get(sap_prop)
    print(f"3. Read-back value from SAP: {readback_val} (UpdateDate: {post_item.get('UpdateDate')} {post_item.get('UpdateTime')})", flush=True)

    # 4. Check DB state
    with get_db_connection() as conn:
        with get_db_cursor(conn, dict_cursor=True) as cur:
            cur.execute(f"SELECT {f_name}, last_submitted_at, updated_at FROM stock_configuration WHERE item_code = 'CS1124'")
            db_row = cur.fetchone()
            print(f"4. ATLAS DB persisted row: {db_row}", flush=True)

    # 5. Verification
    passed = (str(readback_val).strip().upper() == str(expected_sap).strip().upper())
    status_str = "PASS" if passed else "FAIL"
    print(f"5. Test Result: {status_str} (Expected: '{expected_sap}', Actual in SAP: '{readback_val}')", flush=True)

    results.append({
        "field": f_name.upper(),
        "sap_property": sap_prop,
        "orig_sap": orig_val,
        "submitted": val_to_submit,
        "readback_sap": readback_val,
        "db_val": db_row.get(f_name) if db_row else None,
        "last_submitted_at": str(db_row.get("last_submitted_at")) if db_row else None,
        "status": status_str,
    })

print("\n=================================================================", flush=True)
print("SUMMARY OF INDIVIDUAL FIELD TEST RESULTS", flush=True)
print("=================================================================", flush=True)
for r in results:
    print(f"Field: {r['field']:<10} | SAP Prop: {r['sap_property']:<12} | Orig: {str(r['orig_sap']):<6} | Submitted: {str(r['submitted']):<6} | SAP Read: {str(r['readback_sap']):<6} | Status: {r['status']}", flush=True)
