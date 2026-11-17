import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()
for code in ["CS0227", "CS1124", "FG2145"]:
    res = client.get(f"Items('{code}')")
    print(f"=== {code} ===")
    print(f"ItemName: {res.get('ItemName')}")
    print(f"InventoryWeight: {res.get('InventoryWeight')}")
    print(f"PurchaseUnitWeight: {res.get('PurchaseUnitWeight')}")
    print(f"SalesUnitWeight: {res.get('SalesUnitWeight')}")
    print(f"U_PerPices: {res.get('U_PerPices')}")
    print(f"U_Drawing: {res.get('U_Drawing')}")
    print(f"User_Text: {res.get('User_Text')}")
    print(f"QuantityOnStock: {res.get('QuantityOnStock')}")
    print(f"UpdateDate: {res.get('UpdateDate')} UpdateTime: {res.get('UpdateTime')}")
