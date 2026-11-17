import os
import sys
import json
from datetime import datetime

backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from app.services.sap.client import get_sap_client

def audit_sap_metadata_and_udfs():
    client = get_sap_client()
    client.login()
    print("=== Connected to SAP Service Layer ===")

    # 1. Query UserFieldsMD for OITM, OPDN, PDN1
    for tbl in ["OITM", "PDN1", "OPDN", "POR1", "OPOR"]:
        res = client.get("UserFieldsMD", params={"$filter": f"TableName eq '{tbl}'", "$select": "Name,Type,Size,Description,DefaultValue"})
        udfs = res.get("value", [])
        print(f"\n--- UserFieldsMD for {tbl} (Total: {len(udfs)}) ---")
        for u in udfs:
            print(f"  U_{u.get('Name')}: {u.get('Description')} (Type: {u.get('Type')}, Size: {u.get('Size')}, Default: {u.get('DefaultValue')})")

    # 2. Inspect CS1124 before
    print("\n--- Current Values for Items('CS1124') ---")
    item = client.get("Items('CS1124')", params={"$select": "ItemCode,ItemName,InventoryWeight,PurchaseUnitWeight,SalesUnitWeight,U_PerPices,U_Drawing,User_Text,UpdateDate,UpdateTime"})
    for k, v in item.items():
        print(f"  {k}: {repr(v)}")

if __name__ == "__main__":
    audit_sap_metadata_and_udfs()
