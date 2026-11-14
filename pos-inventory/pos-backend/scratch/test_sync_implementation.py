import sys
import os
import time
from datetime import datetime
import psycopg2
import psycopg2.extras

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

    from app.services.stock_configuration_service import StockConfigurationService
    service = StockConfigurationService()

    print("Connecting to DB...")
    with service._get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM stock_configuration;")
            initial_count = cur.fetchone()[0]
            print(f"Initial DB count: {initial_count}")

            cur.execute("SELECT COALESCE(MAX(sr_no), 0) FROM stock_configuration;")
            max_sr = cur.fetchone()[0]
            print(f"Current MAX(sr_no): {max_sr}")

            # Check if AMIT001, SFG02495, CS1124 exist before
            cur.execute("SELECT item_code FROM stock_configuration WHERE item_code IN ('AMIT001', 'SFG02495', 'CS1124');")
            found = [r[0] for r in cur.fetchall()]
            print(f"Test items in DB before sync: {found}")

    # Now let's test fetching first 20 pages (2,000 items) sorted by UpdateDate desc
    print("\nFetching first 2,000 items sorted by UpdateDate desc...")
    t0 = time.time()
    select_fields = "ItemCode,ItemName,QuantityOnStock,Valid,Frozen,ItemsGroupCode,Mainsupplier,CreateDate,UpdateDate"
    filter_str = "Valid eq 'tYES' and Frozen eq 'tNO'"

    all_fetched = []
    page = 0
    while page < 20:
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
        all_fetched.extend(items)
        page += 1
        if len(items) < 100:
            break

    print(f"Fetched {len(all_fetched)} items from SAP in {time.time()-t0:.2f}s")

    # Let's check if AMIT001, SFG02495, CS1124 are in fetched items
    codes = [x.get("ItemCode") for x in all_fetched]
    for c in ["AMIT001", "SFG02495", "CS1124", "CS0227", "FG3114"]:
        print(f"  {c} in fetched? {'YES' if c in codes else 'NO'}")

if __name__ == "__main__":
    main()

