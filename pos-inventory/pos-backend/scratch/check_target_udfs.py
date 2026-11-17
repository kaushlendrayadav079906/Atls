import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()
try:
    uf = client.get("UserFieldsMD?$filter=TableName eq 'OITM' and (Name eq 'QC' or Name eq 'V_Chk' or Name eq 'LM' or Name eq 'OLNG' or Name eq 'LPK' or Name eq 'LBL' or Name eq 'MC_OR_PT')")
    print("Found UDFs on OITM:", uf.get("value", []), flush=True)
except Exception as e:
    print("Error:", e, flush=True)
