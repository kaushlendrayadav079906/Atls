import sys
import os
sys.path.insert(0, os.path.abspath("."))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

res = client.get("UserFieldsMD?$filter=TableName eq 'PDN1'&$select=TableName,Name,Description,Type,Size,EditSize")
udfs = res.get("value", [])
print(f"=== Table: PDN1 ({len(udfs)} UDFs) ===")
for u in udfs:
    print(f"  Name: U_{u.get('Name')}, Description: {u.get('Description')}, Type: {u.get('Type')}, Size: {u.get('Size')}")
