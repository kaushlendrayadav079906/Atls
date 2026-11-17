import sys
import os
sys.path.insert(0, os.path.abspath("."))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

# Query all UserFieldsMD in the company database
res = client.get("UserFieldsMD?$top=100&$select=TableName,Name,Description,Type,Size,EditSize")
udfs = res.get("value", [])
print(f"Total UDFs found in initial batch: {len(udfs)}")

# Group by table
by_table = {}
for u in udfs:
    t = u.get("TableName")
    by_table.setdefault(t, []).append(u)

for t, fields in by_table.items():
    print(f"\n--- Table: {t} ({len(fields)} fields) ---")
    for f in fields:
        print(f"  U_{f.get('Name')}: {f.get('Description')} ({f.get('Type')}, size={f.get('Size')})")

# If there's nextLink, fetch more
next_link = res.get("odata.nextLink")
while next_link:
    print(f"\nFetching next page: {next_link}")
    # strip base url if needed
    ep = next_link.split("/b1s/v1/")[-1] if "/b1s/v1/" in next_link else next_link
    res = client.get(ep)
    more_udfs = res.get("value", [])
    print(f"Fetched {len(more_udfs)} more UDFs")
    for u in more_udfs:
        t = u.get("TableName")
        print(f"  [{t}] U_{u.get('Name')}: {u.get('Description')} ({u.get('Type')}, size={u.get('Size')})")
    next_link = res.get("odata.nextLink")
