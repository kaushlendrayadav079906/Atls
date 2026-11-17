import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

print("--- Querying UserFieldsMD for OITM and PDN1 ---", flush=True)
try:
    uf_res = client.get("UserFieldsMD?$top=200&$filter=TableName eq 'OITM' or TableName eq 'PDN1'")
    value = uf_res.get("value", [])
    print(f"Total UDFs found on OITM/PDN1: {len(value)}", flush=True)
    for u in value:
        print(f"Table: {u.get('TableName')}, FieldID: {u.get('FieldID')}, Name: {u.get('Name')}, Type: {u.get('Type')}, Size: {u.get('Size')}, Description: {u.get('Description')}", flush=True)
except Exception as e:
    print(f"Error querying UserFieldsMD: {e}", flush=True)

print("--- Inspecting all properties of Items('CS1124') ---", flush=True)
try:
    cs1124 = client.get("Items('CS1124')")
    u_keys = {k: v for k, v in cs1124.items() if k.startswith("U_")}
    print("CS1124 U_ fields:", u_keys, flush=True)
    target_names = ["QC", "V_CHK", "VCHK", "LM", "OLNG", "LPK", "IPK", "LBL", "MC_OR_PT", "MCORPT"]
    found = {k: v for k, v in cs1124.items() if any(t.lower() in k.lower() for t in target_names)}
    print("Target matches in CS1124:", found, flush=True)
except Exception as e:
    print(f"Error querying CS1124: {e}", flush=True)
