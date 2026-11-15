import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

def main():
    client = get_sap_client()
    client.login(timeout=30.0)
    print("Logged in!")

    print("\n=== RECENT GOODS RECEIPT POs (PurchaseDeliveryNotes) ===")
    try:
        res = client.get("PurchaseDeliveryNotes", params={"$top": "5", "$orderby": "DocEntry desc"})
        for gr in res.get("value", []):
            print(f"GRPO DocEntry={gr.get('DocEntry')}, DocNum={gr.get('DocNum')}, Date={gr.get('DocDate')}, Vendor={gr.get('CardName')}")
            for l in gr.get("DocumentLines", []):
                print(f"   Line: ItemCode={l.get('ItemCode')}, Qty={l.get('Quantity')}, BaseEntry={l.get('BaseEntry')}, BaseType={l.get('BaseType')}")
    except Exception as e:
        print("GRPO error:", e)

if __name__ == "__main__":
    main()

