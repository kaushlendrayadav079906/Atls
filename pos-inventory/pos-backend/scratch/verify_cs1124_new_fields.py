import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()
res = client.get("Items('CS1124')")
target_fields = ["U_QC", "U_V_Chk", "U_LM", "U_OLNG", "U_LPK", "U_LBL", "U_MC_OR_PT"]
print("--- Checking CS1124 for all 7 UDF properties ---", flush=True)
for tf in target_fields:
    print(f"{tf}: {res.get(tf)} (in item: {tf in res})", flush=True)
