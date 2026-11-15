import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

def main():
    client = get_sap_client()
    for attempt in range(3):
        try:
            client.login(timeout=30.0)
            print("Login success!")
            break
        except Exception as e:
            print(f"Login attempt {attempt+1} failed: {e}")
            import time
            time.sleep(2)
    else:
        print("Login failed.")
        return

    print("--- PO with params dict ---")
    res = client.get("PurchaseOrders", params={"$top": "5", "$orderby": "DocEntry desc"})
    for p in res.get("value", []):
        print(f"PO DocEntry={p.get('DocEntry')}, DocNum={p.get('DocNum')}, Series={p.get('Series')}, Date={p.get('DocDate')}, Status={p.get('DocumentStatus')}")

    print("\n--- PO search 1378 with params dict ---")
    res2 = client.get("PurchaseOrders", params={"$filter": "DocNum eq 1378"})
    for p in res2.get("value", []):
        print(f"PO DocEntry={p.get('DocEntry')}, DocNum={p.get('DocNum')}, Series={p.get('Series')}, Lines:")
        for l in p.get("DocumentLines", []):
            print(f"   Line: ItemCode={l.get('ItemCode')}, Qty={l.get('Quantity')}, OpenQty={l.get('RemainingOpenQuantity')}")

if __name__ == "__main__":
    main()

