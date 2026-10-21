import sys
sys.path.insert(0, '.')
from app.services.sap.client import get_sap_client

c = get_sap_client()

# Test fetching Orders with lines and filtering by warehouse 'SH'
res = c.get("Orders?$top=50&$select=DocEntry,DocNum,CardCode,CardName,DocTotal,DocumentStatus,Cancelled,DocumentLines")
all_orders = res.get("value", [])
print(f"Total orders fetched: {len(all_orders)}")

sh_orders = [
    o for o in all_orders 
    if any(line.get("WarehouseCode") == "SH" for line in o.get("DocumentLines", []))
]
print(f"Orders with warehouse 'SH': {len(sh_orders)}")
if sh_orders:
    print(f"  First SH order: DocNum={sh_orders[0].get('DocNum')}, Card={sh_orders[0].get('CardName')}")

# Test PurchaseOrders with lines
res_po = c.get("PurchaseOrders?$top=100&$select=DocEntry,DocNum,CardCode,CardName,DocTotal,DocumentStatus,Cancelled,DocumentLines")
all_po = res_po.get("value", [])
print(f"Total POs fetched: {len(all_po)}")
sh_pos = [
    po for po in all_po
    if any(line.get("WarehouseCode") == "SH" for line in po.get("DocumentLines", []))
]
print(f"POs with warehouse 'SH': {len(sh_pos)}")
if sh_pos:
    print(f"  First SH PO: DocNum={sh_pos[0].get('DocNum')}, Card={sh_pos[0].get('CardName')}")
