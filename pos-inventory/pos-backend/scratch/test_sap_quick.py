import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
print("Connecting to SAP...", flush=True)
from app.services.sap.client import get_sap_client
import httpx

client = get_sap_client()
print("Calling client.login()...", flush=True)
try:
    ok = client.login(timeout=httpx.Timeout(10.0))
    print(f"Login result: {ok}, session_id: {client.session_id}", flush=True)
    item = client.get("Items('CS1124')?$select=ItemCode,ItemName,InventoryWeight,User_Text,U_Drawing,U_PerPices,UpdateDate,UpdateTime")
    print("CS1124:", item, flush=True)
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}", flush=True)
