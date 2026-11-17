import os
import sys
import json

backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.services.sap.client import get_sap_client

def test():
    c = get_sap_client()
    c.login()

    res = c.get("PurchaseDeliveryNotes", params={
        "$orderby": "DocEntry desc",
        "$top": 10,
        "$select": "DocEntry,DocNum,DocDate,CardName,Cancelled,DocumentStatus,DocumentLines"
    })
    items = res.get("value", [])
    print(f"Top 10 GRPOs by DocEntry desc (Total: {len(items)}):")
    for g in items:
        lines_summary = [(l.get("LineNum"), l.get("ItemCode"), l.get("Quantity"), l.get("RemainingOpenQuantity"), l.get("BaseType"), l.get("BaseEntry")) for l in g.get("DocumentLines", [])]
        print(f"  DocEntry={g.get('DocEntry')}, DocNum={g.get('DocNum')}, Date={g.get('DocDate')}, Vendor={g.get('CardName')}, Status={g.get('DocumentStatus')}, Cancelled={g.get('Cancelled')}, Lines={lines_summary}")

if __name__ == "__main__":
    test()
