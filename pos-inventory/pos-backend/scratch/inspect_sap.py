import sys
sys.path.insert(0, '.')
from app.services.sap.client import get_sap_client

client = get_sap_client()

# Check Items
try:
    res = client.get("/Items?$top=1&$select=ItemCode,ItemName,DefaultWarehouse,ItemWarehouseInfoCollection")
    if res.get("value"):
        it = res["value"][0]
        print("ItemCode:", it.get("ItemCode"))
        print("DefaultWarehouse:", it.get("DefaultWarehouse"))
        whs_coll = it.get("ItemWarehouseInfoCollection", [])
        print("ItemWarehouseInfoCollection count:", len(whs_coll))
        if whs_coll:
            print("  First whs entry:", whs_coll[0])
except Exception as e:
    print("Items query error:", e)

# Check BusinessPartners
try:
    res = client.get("/BusinessPartners?$top=5&$select=CardCode,CardName,CardType,Valid,Frozen")
    print("BusinessPartners sample:")
    for bp in res.get("value", []):
        print(f"  {bp.get('CardCode')} | {bp.get('CardName')} | {bp.get('CardType')} | Valid={bp.get('Valid')}")
except Exception as e:
    print("BP query error:", e)

# Check SalesPersons
try:
    res = client.get("/SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName,Active")
    print("SalesPersons sample:")
    for sp in res.get("value", []):
        print(f"  {sp.get('SalesEmployeeCode')} | {sp.get('SalesEmployeeName')} | Active={sp.get('Active')}")
except Exception as e:
    print("SalesPersons query error:", e)

# Check Warehouses
try:
    res = client.get("/Warehouses?$select=WarehouseCode,WarehouseName")
    print("Warehouses sample:")
    for wh in res.get("value", []):
        print(f"  {wh.get('WarehouseCode')} | {wh.get('WarehouseName')}")
except Exception as e:
    print("Warehouses query error:", e)

# Check BusinessPlaces (Branches)
try:
    res = client.get("/BusinessPlaces?$select=BPLID,BPLName")
    print("BusinessPlaces (Branches) sample:")
    for bp in res.get("value", []):
        print(f"  {bp.get('BPLID')} | {bp.get('BPLName')}")
except Exception as e:
    print("BusinessPlaces query error:", e)
