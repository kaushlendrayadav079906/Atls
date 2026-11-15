import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

def main():
    client = get_sap_client()
    for attempt in range(3):
        try:
            client.login(timeout=30.0)
            break
        except Exception:
            pass

    select_fields = "ItemCode,ItemName,QuantityOnStock,Valid,Frozen,ItemsGroupCode,Mainsupplier,CreateDate,UpdateDate"
    filter_str = "Valid eq 'tYES' and Frozen eq 'tNO'"

    t0 = time.time()
    page = 0
    total_fetched = 0
    max_pages = 25  # Test 25 pages = 2,500 items

    while page < max_pages:
        res = client.get("Items", params={
            "$filter": filter_str,
            "$select": select_fields,
            "$top": 100,
            "$skip": page * 100,
            "$orderby": "UpdateDate desc"
        })
        items = res.get("value", [])
        if not items:
            break
        total_fetched += len(items)
        page += 1
        if len(items) < 100:
            break

    dur = time.time() - t0
    print(f"Fetched {total_fetched} items across {page} pages in {dur:.2f}s ({total_fetched/dur:.1f} items/sec)")

if __name__ == "__main__":
    main()

