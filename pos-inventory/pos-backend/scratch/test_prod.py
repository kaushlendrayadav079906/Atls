import sys
sys.path.insert(0, '.')
from app.services.sap.client import get_sap_client

c = get_sap_client()

# 1. Warehouse + Status
f1 = "Warehouse eq 'SH' and ProductionOrderStatus eq 'boposPlanned'"
res1 = c.get(f"ProductionOrders?$top=5&$filter={f1}&$inlinecount=allpages&$select=AbsoluteEntry,DocumentNumber,ItemNo,Warehouse,ProductionOrderStatus")
print("1. Warehouse + Status count:", res1.get("odata.count"), "items:", len(res1.get("value", [])))

# 2. Date range on PostingDate
f2 = "PostingDate ge '2023-01-01' and PostingDate le '2023-12-31'"
res2 = c.get(f"ProductionOrders?$top=5&$filter={f2}&$inlinecount=allpages&$select=AbsoluteEntry,DocumentNumber,PostingDate")
print("2. Date range count:", res2.get("odata.count"), "items:", len(res2.get("value", [])))

# 3. Search: substringof on ItemNo or DocumentNumber
f3 = "substringof('FG', ItemNo)"
res3 = c.get(f"ProductionOrders?$top=5&$filter={f3}&$inlinecount=allpages&$select=AbsoluteEntry,DocumentNumber,ItemNo")
print("3. Substring on ItemNo count:", res3.get("odata.count"), "items:", len(res3.get("value", [])))

# 4. Search by DocumentNumber eq 1
f4 = "DocumentNumber eq 1"
res4 = c.get(f"ProductionOrders?$top=5&$filter={f4}&$inlinecount=allpages&$select=AbsoluteEntry,DocumentNumber,ItemNo")
print("4. DocumentNumber eq 1 count:", res4.get("odata.count"), "items:", len(res4.get("value", [])))
