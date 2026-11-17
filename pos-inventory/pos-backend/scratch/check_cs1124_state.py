from app.services.sap.client import get_sap_client
import json

c = get_sap_client()
c.login()
item = c.get("Items('CS1124')")
keys = [
    'ItemCode', 'ItemName', 'InventoryWeight', 'PurchaseUnitWeight', 
    'SalesUnitWeight', 'U_PerPices', 'U_Drawing', 'User_Text', 
    'U_QC', 'U_V_Chk', 'U_LM', 'U_OLNG', 'U_LPK', 'U_LBL', 
    'U_MC_OR_PT', 'UpdateDate', 'UpdateTime'
]
res = {k: item.get(k) for k in keys}
print("=== SAP LIVE STATE FOR CS1124 ===")
print(json.dumps(res, indent=2))
