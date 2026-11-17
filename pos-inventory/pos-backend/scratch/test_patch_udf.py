import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

payload = {
    "U_QC": "Y",
    "U_V_Chk": "Y",
    "U_LM": "Y",
    "U_OLNG": "N",
    "U_LPK": "Y",
    "U_LBL": "Y",
    "U_MC_OR_PT": "Y"
}

print("Patching Items('CS1124') with new UDFs...", flush=True)
try:
    client.patch("Items('CS1124')", data=payload)
    print("PATCH succeeded!", flush=True)
except Exception as e:
    print("PATCH failed:", e, flush=True)

print("Reading back Items('CS1124')...", flush=True)
try:
    item = client.get("Items('CS1124')?$select=ItemCode,ItemName,U_QC,U_V_Chk,U_LM,U_OLNG,U_LPK,U_LBL,U_MC_OR_PT,UpdateDate,UpdateTime")
    print("Item read-back:", item, flush=True)
except Exception as e:
    print("Read-back failed:", e, flush=True)
