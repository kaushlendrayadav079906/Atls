import sys
import os
from dotenv import load_dotenv
load_dotenv(os.path.abspath("pos-inventory/pos-backend/.env"))
sys.path.insert(0, os.path.abspath("pos-inventory/pos-backend"))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

# Inspect current CS1124 values
props = "ItemCode,ItemName,InventoryWeight,PurchaseUnitWeight,SalesUnitWeight,U_PerPices,U_Drawing,User_Text,U_QC,U_V_Chk,U_LM,U_OLNG,U_LPK,U_LBL,U_MC_OR_PT,UpdateDate,UpdateTime,CreateDate"
item = client.get(f"Items('CS1124')?$select={props}")
print("BEFORE:")
for k, v in item.items():
    if not k.startswith("@"):
        print(f"  {k}: {repr(v)}")
