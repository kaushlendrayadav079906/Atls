import sys
sys.path.insert(0, '.')
from app.services.sap.client import get_sap_client
from app.api.v1.common import _fetch_from_sap

c = get_sap_client()
res = _fetch_from_sap(c)
print("Filter options fetched from SAP:")
print("  Customers count:", len(res["customers"]))
if res["customers"]:
    print("    Sample customer:", res["customers"][0])
print("  Suppliers count:", len(res["suppliers"]))
if res["suppliers"]:
    print("    Sample supplier:", res["suppliers"][0])
print("  Buyers count:", len(res["buyers"]))
if res["buyers"]:
    print("    Sample buyer:", res["buyers"][0])
print("  Warehouses count:", len(res["warehouses"]))
if res["warehouses"]:
    print("    Sample warehouse:", res["warehouses"][0])
print("  Branches count:", len(res["branches"]))
if res["branches"]:
    print("    Sample branch:", res["branches"][0])
print("  Statuses:", list(res["statuses"].keys()))
