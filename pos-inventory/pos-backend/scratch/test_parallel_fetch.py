import sys
import os
import time
from concurrent.futures import ThreadPoolExecutor

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

    def fetch_page(skip):
        return client.get("Items", params={
            "$filter": filter_str,
            "$select": select_fields,
            "$top": 100,
            "$skip": skip,
            "$orderby": "UpdateDate desc"
        }).get("value", [])

    t0 = time.time()
    # Fetch 10 pages (1,000 items) in parallel with 5 workers
    skips = [i * 100 for i in range(10)]
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(fetch_page, skips))

    total_items = sum(len(p) for p in results)
    dur = time.time() - t0
    print(f"Parallel fetch: {total_items} items in {dur:.2f}s ({total_items/dur:.1f} items/sec)")

if __name__ == "__main__":
    main()

