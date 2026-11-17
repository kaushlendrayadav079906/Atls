import os
import sys
import json

backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.services.sap.client import get_sap_client

def main():
    c = get_sap_client()
    c.login()

    # 1. Check target UDFs on OITM
    res = c.get("UserFieldsMD?$filter=TableName eq 'OITM'")
    udfs = res.get("value", [])
    print(f"Total OITM UDFs: {len(udfs)}")
    oitm_udfs = {u.get("Name"): u for u in udfs}
    target_names = ["QC", "V_Chk", "LM", "OLNG", "LPK", "LBL", "MC_OR_PT", "Drawing", "JobDrawing"]
    for t in target_names:
        if t in oitm_udfs:
            u = oitm_udfs[t]
            print(f"  FOUND U_{t}: Type={u.get('Type')}, Size={u.get('Size')}, Description={u.get('Description')}")
        else:
            print(f"  MISSING U_{t}")

    # Also list all OITM UDF names
    print("\nAll OITM UDF Names:")
    for name in sorted(oitm_udfs.keys()):
        print(f"  U_{name}")

    # 2. Check items CS0227, CS1124, FG2145
    print("\n--- Actual Item Master Records ---")
    for code in ["CS0227", "CS1124", "FG2145"]:
        item = c.get(f"Items('{code}')")
        if item:
            print(f"\n*** Item: {code} ***")
            print(f"  ItemName: {item.get('ItemName')}")
            print(f"  QuantityOnStock: {item.get('QuantityOnStock')}")
            print(f"  InventoryWeight: {item.get('InventoryWeight')}, PurchaseUnitWeight: {item.get('PurchaseUnitWeight')}, SalesUnitWeight: {item.get('SalesUnitWeight')}")
            print(f"  User_Text: {repr(item.get('User_Text'))}")
            print(f"  UpdateDate: {item.get('UpdateDate')}, UpdateTime: {item.get('UpdateTime')}")
            print(f"  U_QC: {repr(item.get('U_QC'))}")
            print(f"  U_Drawing: {repr(item.get('U_Drawing'))}")
            print(f"  U_V_Chk: {repr(item.get('U_V_Chk'))}")
            print(f"  U_LM: {repr(item.get('U_LM'))}")
            print(f"  U_OLNG: {repr(item.get('U_OLNG'))}")
            print(f"  U_LPK: {repr(item.get('U_LPK'))}")
            print(f"  U_LBL: {repr(item.get('U_LBL'))}")
            print(f"  U_MC_OR_PT: {repr(item.get('U_MC_OR_PT'))}")

    # 3. Check GRPOs for these items
    print("\n--- Recent GRPOs for Target Items ---")
    res_grpo = c.get("PurchaseDeliveryNotes?$orderby=DocEntry desc&$top=50&$select=DocEntry,DocNum,DocDate,CardCode,CardName,U_SONo,DocumentLines")
    for g in res_grpo.get("value", []):
        for l in g.get("DocumentLines", []):
            if l.get("ItemCode") in ["CS0227", "CS1124", "FG2145"]:
                print(f"GRPO DocNum={g.get('DocNum')}, DocDate={g.get('DocDate')}, Vendor={g.get('CardName')}, Item={l.get('ItemCode')}, LineNum={l.get('LineNum')}, Qty={l.get('Quantity')}, RemOpen={l.get('RemainingOpenQuantity')}, BaseType={l.get('BaseType')}, BaseEntry={l.get('BaseEntry')}, BaseLine={l.get('BaseLine')}, U_SONo={g.get('U_SONo')}")

if __name__ == "__main__":
    main()
