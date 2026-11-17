import os
import sys
import json

backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.services.sap.client import get_sap_client

def inspect_po_871():
    c = get_sap_client()
    c.login()

    po = c.get("PurchaseOrders(871)")
    print(f"PO DocEntry=871: DocNum={po.get('DocNum')}, Date={po.get('DocDate')}, Vendor={po.get('CardName')}")
    print(f"  ImportFileNum: {po.get('ImportFileNum')}")
    print(f"  Comments: {po.get('Comments')}")
    print(f"  Cancelled: {po.get('Cancelled')}, Status: {po.get('DocumentStatus')}")
    for pl in po.get("DocumentLines", []):
        print(f"  Line {pl.get('LineNum')}: Item={pl.get('ItemCode')}, Desc={pl.get('ItemDescription')}, Qty={pl.get('Quantity')}, OpenQty={pl.get('RemainingOpenQuantity')}")

    imp = po.get("ImportFileNum")
    if imp:
        print(f"\nChecking linked Sales Order for ImportFileNum={imp}:")
        try:
            so_res = c.get("Orders", params={"$filter": f"DocNum eq {int(imp)}"})
            sos = so_res.get("value", [])
            for so in sos:
                print(f"  SO DocEntry={so.get('DocEntry')}, DocNum={so.get('DocNum')}, Date={so.get('DocDate')}, Card={so.get('CardName')}")
                for sl in so.get("DocumentLines", []):
                    print(f"    Line {sl.get('LineNum')}: Item={sl.get('ItemCode')}, Qty={sl.get('Quantity')}, OpenQty={sl.get('RemainingOpenQuantity')}")
        except Exception as e:
            print("  Error fetching SO:", e)

if __name__ == "__main__":
    inspect_po_871()
