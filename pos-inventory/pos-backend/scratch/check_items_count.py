import sys
import os

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

    for code in ["CS1124", "CS0227"]:
        it = client.get(f"Items('{code}')?$select=ItemCode,ItemName,Valid,Frozen,QuantityOnStock")
        print(f"Item: {it}")

    cnt = client.get("Items/$count")
    print(f"Total Items count in SAP: {cnt}")

if __name__ == "__main__":
    main()

