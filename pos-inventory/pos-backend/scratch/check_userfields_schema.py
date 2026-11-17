import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

# Inspect one existing UserFieldMD to see the exact structure
res = client.get("UserFieldsMD(TableName='OITM',FieldID=8)")
print("Sample UserFieldsMD on OITM:", res, flush=True)
