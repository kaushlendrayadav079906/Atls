import sys
sys.path.insert(0, '.')
from app.services.sap.client import get_sap_client

client = get_sap_client()
endpoints = [
    'PurchaseOrders', 
    'Invoices', 
    'PurchaseInvoices', 
    'ProductionOrders', 
    'BusinessPartners', 
    'Items', 
    'Warehouses', 
    'BusinessPlaces', 
    'SalesPersons'
]

for ep in endpoints:
    try:
        res = client.get(f"/{ep}?$top=1")
        items = res.get("value", [])
        print(f"{ep}: OK (count={len(items)})")
        if items:
            sample = items[0]
            # print some useful keys
            keys = [k for k in sample.keys() if not k.startswith("odata")][:8]
            print(f"  sample fields: {keys}")
    except Exception as e:
        print(f"{ep}: ERROR: {e}")
