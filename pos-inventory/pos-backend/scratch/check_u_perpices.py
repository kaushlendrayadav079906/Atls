import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.abspath('pos-inventory/pos-backend/.env'))
sys.path.insert(0, os.path.abspath('pos-inventory/pos-backend'))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()
item = client.get("Items('CS1124')")
for k in ['U_PerPices', 'InventoryWeight', 'PurchaseUnitWeight', 'SalesUnitWeight', 'U_Drawing', 'U_QC', 'U_V_Chk', 'U_LM', 'U_OLNG', 'U_LPK', 'U_LBL', 'U_MC_OR_PT', 'User_Text', 'UpdateDate', 'UpdateTime', 'CreateDate', 'CreateTime']:
    print(f"{k}: {repr(item.get(k))} ({type(item.get(k)).__name__})")
