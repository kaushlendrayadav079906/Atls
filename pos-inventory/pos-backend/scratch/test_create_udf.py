import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

payload = {
    "TableName": "OITM",
    "Name": "QC",
    "Description": "QC Approved",
    "Type": "db_Alpha",
    "Size": 1,
    "ValidValuesMD": [
        {"Value": "Y", "Description": "Yes"},
        {"Value": "N", "Description": "No"}
    ],
    "DefaultValue": "N"
}

print("Attempting to create UDF QC on OITM...", flush=True)
try:
    res = client.post("UserFieldsMD", data=payload)
    print("Creation successful!", res, flush=True)
except Exception as e:
    print(f"Creation result / error: {type(e).__name__}: {e}", flush=True)
