import sys, os
backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)
from app.services.stock_configuration_service import stock_configuration_service
from app.services.sap.client import get_sap_client

print("--- Testing update_item for CS0227 ---", flush=True)
res_cs0227 = stock_configuration_service.update_item(
    item_code="CS0227",
    data={
        "nt_weight": 14.50,
        "drw_yn": "Y",
        "remark": "Bearing inspection OK",
        "qc": True,
        "v_chk": "Y",
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y"
    },
    admin_user_id="test_admin"
)
print("Update CS0227 result:", res_cs0227.get("success"), res_cs0227.get("sap_synced"), flush=True)

print("--- Testing update_item for FG2145 ---", flush=True)
res_fg2145 = stock_configuration_service.update_item(
    item_code="FG2145",
    data={
        "nt_weight": 25.00,
        "drw_yn": "N",
        "remark": "Hex Male Part Verified",
        "qc": False,
        "v_chk": "Y",
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y"
    },
    admin_user_id="test_admin"
)
print("Update FG2145 result:", res_fg2145.get("success"), res_fg2145.get("sap_synced"), flush=True)

print("--- Reading back from SAP Service Layer ---", flush=True)
client = get_sap_client()
client.login()
for code in ["CS0227", "CS1124", "FG2145"]:
    res = client.get(f"Items('{code}')")
    print(f"=== {code} in SAP ===")
    print(f"InventoryWeight: {res.get('InventoryWeight')}")
    print(f"PurchaseUnitWeight: {res.get('PurchaseUnitWeight')}")
    print(f"SalesUnitWeight: {res.get('SalesUnitWeight')}")
    print(f"U_PerPices: {res.get('U_PerPices')}")
    print(f"U_Drawing: {res.get('U_Drawing')}")
    print(f"User_Text: {res.get('User_Text')}")
    print(f"UpdateDate: {res.get('UpdateDate')} {res.get('UpdateTime')}")
