import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

def main():
    client = get_sap_client()
    for attempt in range(3):
        try:
            print(f"Attempting login (attempt {attempt+1})...")
            client.login(timeout=30.0)
            print("Login success!")
            break
        except Exception as e:
            print(f"Login attempt {attempt+1} failed: {e}")
            import time
            time.sleep(2)
    else:
        print("All login attempts failed.")
        return

    print("=== FULL DETAILS FOR PO 871 ===")
    p871 = client.get("PurchaseOrders(871)")
    # print select fields
    keys = ["DocEntry", "DocNum", "Series", "DocDate", "DocDueDate", "CardCode", "CardName", 
            "DocTotal", "DocumentStatus", "PeriodIndicator", "NumAtCard", "Comments"]
    for k in keys:
        print(f"  {k}: {p871.get(k)}")
    for l in p871.get("DocumentLines", []):
        print(f"    Line: ItemCode={l.get('ItemCode')}, Desc={l.get('ItemDescription')}, Qty={l.get('Quantity')}, OpenQty={l.get('RemainingOpenQuantity')}, Whs={l.get('WarehouseCode')}, Price={l.get('Price')}")

    print("\n=== SEARCHING ALL DRAFTS FOR CS1124 / CS0227 / P02627 ===")
    for draft_entry in [23, 22, 21, 20, 19]:
        try:
            d = client.get(f"Drafts({draft_entry})")
            lines = d.get("DocumentLines", [])
            print(f"Draft {draft_entry}: DocObjectCode={d.get('DocObjectCode')}, DocNum={d.get('DocNum')}, NumAtCard={d.get('NumAtCard')}, Series={d.get('Series')}, Lines:")
            for l in lines:
                print(f"    ItemCode={l.get('ItemCode')}, Qty={l.get('Quantity')}")
        except Exception as e:
            print(f"Error fetching draft {draft_entry}:", e)

    print("\n=== SEARCHING ANY PO WITH QUANTITY 50 or 35 OR CS1124 ===")
    try:
        res = client.get("PurchaseOrders", params={"$filter": "DocumentLines/any(d: d/ItemCode eq 'CS1124')"})
        for p in res.get("value", []):
            print(f"PO with CS1124: DocEntry={p.get('DocEntry')}, DocNum={p.get('DocNum')}, Series={p.get('Series')}, DocDate={p.get('DocDate')}, Status={p.get('DocumentStatus')}")
            for l in p.get("DocumentLines", []):
                print(f"    Line: {l.get('ItemCode')}, Qty={l.get('Quantity')}, Price={l.get('Price')}")
    except Exception as e:
        print("Filter error:", e)

    print("\n=== CHECKING SERIES NAMES VIA POST SeriesService_GetDocumentSeries ===")
    try:
        res = client.post("SeriesService_GetDocumentSeries", data={"DocumentTypeParams": {"Document": "22"}})
        for s in res.get("value", []):
            print(f"PO Series: Series={s.get('Series')}, Name={s.get('Name')}, Prefix={s.get('Prefix')}")
    except Exception as e:
        print("SeriesService POST error:", e)

    try:
        res = client.post("SeriesService_GetDocumentSeries", data={"DocumentTypeParams": {"Document": "17"}})
        for s in res.get("value", []):
            print(f"SO Series: Series={s.get('Series')}, Name={s.get('Name')}, Prefix={s.get('Prefix')}")
    except Exception as e:
        print("SeriesService SO error:", e)

if __name__ == "__main__":
    main()

