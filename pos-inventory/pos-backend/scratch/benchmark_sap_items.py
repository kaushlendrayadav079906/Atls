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
    # Benchmark 5 pages of 100
    for page in range(5):
        p_t0 = time.time()
        res = client.get("Items", params={
            "$filter": filter_str,
            "$select": select_fields,
            "$top": 100,
            "$skip": page * 100,
            "$orderby": "UpdateDate desc"
        })
        items = res.get("value", [])
        print(f"Page {page+1}: fetched {len(items)} items in {time.time()-p_t0:.2f}s")

    total_time = time.time() - t0
    print(f"500 items in {total_time:.2f}s (avg {total_time/5:.2f}s per 100 items)")

if __name__ == "__main__":
    main()

