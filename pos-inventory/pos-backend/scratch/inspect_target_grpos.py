import os
import sys
import json

backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.services.sap.client import get_sap_client

def inspect_grpos():
    c = get_sap_client()
    c.login()

    for doc_num in [472, 473, 474]:
        res = c.get(f"PurchaseDeliveryNotes?$filter=DocNum eq {doc_num}")
        val = res.get("value", [])
        if not val:
            print(f"GRPO {doc_num} not found!")
            continue
        g = val[0]
        print(f"\n=================== GRPO DocNum {doc_num} (DocEntry {g.get('DocEntry')}) ===================")
        print(f"  DocDate: {g.get('DocDate')}")
        print(f"  CardCode: {g.get('CardCode')}, CardName: {g.get('CardName')}")
        print(f"  Cancelled: {g.get('Cancelled')}, DocStatus: {g.get('DocumentStatus')}")
        print(f"  Comments: {repr(g.get('Comments'))}")
        print(f"  U_SONo: {g.get('U_SONo')}")
        for l in g.get("DocumentLines", []):
            print(f"    LineNum: {l.get('LineNum')}, ItemCode: {l.get('ItemCode')}, Desc: {l.get('ItemDescription')}")
            print(f"      Quantity: {l.get('Quantity')}, RemainingOpenQuantity: {l.get('RemainingOpenQuantity')}")
            print(f"      BaseType: {l.get('BaseType')}, BaseEntry: {l.get('BaseEntry')}, BaseLine: {l.get('BaseLine')}")
            
            # If base PO exists, fetch base PO
            if l.get("BaseType") == 22 and l.get("BaseEntry"):
                po_entry = l.get("BaseEntry")
                po = c.get(f"PurchaseOrders({po_entry})")
                if po:
                    print(f"      ---> Base PO DocEntry {po_entry}: DocNum={po.get('DocNum')}, DocDate={po.get('DocDate')}")
                    print(f"           ImportFileNum / ImportEnt: {po.get('ImportFileNum')}")
                    print(f"           Comments: {repr(po.get('Comments'))}")
                    for pl in po.get("DocumentLines", []):
                        if pl.get("LineNum") == l.get("BaseLine") or pl.get("ItemCode") == l.get("ItemCode"):
                            print(f"           PO Line {pl.get('LineNum')}: Qty={pl.get('Quantity')}, OpenQty={pl.get('RemainingOpenQuantity')}")
                    
                    # If ImportFileNum is set, check Sales Order
                    imp = po.get("ImportFileNum")
                    if imp:
                        try:
                            so_res = c.get(f"Orders?$filter=DocNum eq {int(imp)}")
                            so_val = so_res.get("value", [])
                            if so_val:
                                so = so_val[0]
                                print(f"           ---> Linked SO DocNum {imp} (DocEntry {so.get('DocEntry')}): DocDate={so.get('DocDate')}")
                                for sl in so.get("DocumentLines", []):
                                    if sl.get("ItemCode") == l.get("ItemCode"):
                                        print(f"                SO Line: Item={sl.get('ItemCode')}, Qty={sl.get('Quantity')}, OpenQty={sl.get('RemainingOpenQuantity')}")
                        except Exception as e:
                            print(f"           Error fetching SO: {e}")

if __name__ == "__main__":
    inspect_grpos()
