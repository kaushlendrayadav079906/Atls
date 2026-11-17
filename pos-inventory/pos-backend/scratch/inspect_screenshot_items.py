import os
import sys
import json

backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from app.services.sap.client import get_sap_client

def inspect_items_and_grpos():
    client = get_sap_client()
    client.login()
    print("=== Connected to SAP Service Layer ===")

    test_codes = ["CS0227", "CS1124", "FG2145"]

    print("\n" + "="*80)
    print("1. ITEM MASTER (OITM) DETAILS")
    print("="*80)
    for code in test_codes:
        item = client.get(f"Items('{code}')")
        print(f"\nItem: {code} - {item.get('ItemName')}")
        print(f"  InventoryWeight:    {item.get('InventoryWeight')}")
        print(f"  PurchaseUnitWeight: {item.get('PurchaseUnitWeight')}")
        print(f"  SalesUnitWeight:    {item.get('SalesUnitWeight')}")
        print(f"  U_PerPices:         {item.get('U_PerPices')}")
        print(f"  U_Drawing:          {item.get('U_Drawing')}")
        print(f"  User_Text:          {repr(item.get('User_Text'))}")
        print(f"  UpdateDate:         {item.get('UpdateDate')}")
        print(f"  UpdateTime:         {item.get('UpdateTime')}")
        print(f"  QuantityOnStock:    {item.get('QuantityOnStock')}")
        # print all U_ fields
        u_f = {k: v for k, v in item.items() if k.startswith("U_")}
        print(f"  All U_ fields:      {u_f}")

    print("\n" + "="*80)
    print("2. GOODS RECEIPT PO (OPDN & PDN1) DETAILS FOR 472 & 473")
    print("="*80)
    for doc_num in [472, 473]:
        res = client.get("PurchaseDeliveryNotes", params={"$filter": f"DocNum eq {doc_num}"})
        val = res.get("value", [])
        if not val:
            print(f"GRPO {doc_num} not found!")
            continue
        grpo = val[0]
        print(f"\nGRPO DocNum: {grpo.get('DocNum')}, DocEntry: {grpo.get('DocEntry')}, Date: {grpo.get('DocDate')}")
        print(f"  CardCode: {grpo.get('CardCode')}, CardName: {grpo.get('CardName')}")
        print(f"  Comments (Header Remarks): {repr(grpo.get('Comments'))}")
        print(f"  Lines count: {len(grpo.get('DocumentLines', []))}")
        for line in grpo.get("DocumentLines", []):
            l_code = line.get("ItemCode")
            if l_code in test_codes or True:
                print(f"    LineNum: {line.get('LineNum')}, ItemCode: {l_code}, ItemDesc: {line.get('ItemDescription')}")
                print(f"      Quantity: {line.get('Quantity')}, OpenQty: {line.get('OpenQuantity')}")
                print(f"      FreeTxt (Line Remarks): {repr(line.get('FreeText'))}")
                print(f"      BaseType: {line.get('BaseType')}, BaseEntry: {line.get('BaseEntry')}, BaseLine: {line.get('BaseLine')}")
                u_line = {k: v for k, v in line.items() if k.startswith("U_")}
                print(f"      Line U_ fields: {u_line}")

if __name__ == "__main__":
    inspect_items_and_grpos()
