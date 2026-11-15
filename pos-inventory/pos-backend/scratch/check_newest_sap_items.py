import sys
import os
import json

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

    print("=== NEWEST ITEMS IN SAP BY CreateDate desc ===")
    try:
        res = client.get("Items", params={
            "$top": "20",
            "$orderby": "CreateDate desc",
            "$select": "ItemCode,ItemName,CreateDate,UpdateDate,Valid,Frozen,InventoryItem,SalesItem,PurchaseItem,QuantityOnStock,Mainsupplier"
        })
        items = res.get("value", [])
        print(f"Found {len(items)} items:")
        for it in items:
            print(f"  {it.get('ItemCode')} | {it.get('ItemName')} | Created: {it.get('CreateDate')} | Updated: {it.get('UpdateDate')} | Valid: {it.get('Valid')} | Frozen: {it.get('Frozen')} | Inv: {it.get('InventoryItem')} | Stock: {it.get('QuantityOnStock')} | Vendor: {it.get('Mainsupplier')}")
    except Exception as e:
        print("CreateDate query error:", e)

    print("\n=== NEWEST ITEMS IN SAP BY UpdateDate desc ===")
    try:
        res = client.get("Items", params={
            "$top": "20",
            "$orderby": "UpdateDate desc",
            "$select": "ItemCode,ItemName,CreateDate,UpdateDate,Valid,Frozen,InventoryItem,SalesItem,PurchaseItem,QuantityOnStock,Mainsupplier"
        })
        items = res.get("value", [])
        print(f"Found {len(items)} items:")
        for it in items:
            print(f"  {it.get('ItemCode')} | {it.get('ItemName')} | Created: {it.get('CreateDate')} | Updated: {it.get('UpdateDate')} | Valid: {it.get('Valid')} | Frozen: {it.get('Frozen')} | Inv: {it.get('InventoryItem')} | Stock: {it.get('QuantityOnStock')} | Vendor: {it.get('Mainsupplier')}")
    except Exception as e:
        print("UpdateDate query error:", e)

if __name__ == "__main__":
    main()

