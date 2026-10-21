import sys
sys.path.insert(0, '.')
from app.services.sap.client import get_sap_client

client = get_sap_client()

# 1. Test DocumentLines warehouse filter on Orders
try:
    res = client.get("/Orders?$top=1&$filter=DocumentLines/any(l: l/WarehouseCode eq 'SH')")
    print("Orders warehouse filter: SUCCESS! Count:", len(res.get("value", [])))
except Exception as e:
    print("Orders warehouse filter ERROR:", e)

# 2. Test substringof search
try:
    res = client.get("/Orders?$top=1&$filter=substringof('Amazon', CardName)")
    print("Orders substringof search: SUCCESS! Count:", len(res.get("value", [])))
except Exception as e:
    print("Orders substringof ERROR:", e)

# 3. Test SalesPersonCode filter
try:
    res = client.get("/Orders?$top=1&$filter=SalesPersonCode eq -1")
    print("Orders SalesPersonCode filter: SUCCESS! Count:", len(res.get("value", [])))
except Exception as e:
    print("Orders SalesPersonCode ERROR:", e)

# 4. Test BPL_IDAssignedToInvoice filter
try:
    res = client.get("/Orders?$top=1&$filter=BPL_IDAssignedToInvoice eq 1")
    print("Orders Branch filter: SUCCESS! Count:", len(res.get("value", [])))
except Exception as e:
    print("Orders Branch ERROR:", e)

# 5. Test Date filter
try:
    res = client.get("/Orders?$top=1&$filter=DocDate ge '2025-01-01' and DocDate le '2026-12-31'")
    print("Orders Date filter: SUCCESS! Count:", len(res.get("value", [])))
except Exception as e:
    print("Orders Date ERROR:", e)

# 6. Test ProductionOrders filter
try:
    res = client.get("/ProductionOrders?$top=1&$filter=Warehouse eq 'SH' and ProductionOrderStatus eq 'boposPlanned'")
    print("ProductionOrders filter: SUCCESS! Count:", len(res.get("value", [])))
except Exception as e:
    print("ProductionOrders ERROR:", e)
