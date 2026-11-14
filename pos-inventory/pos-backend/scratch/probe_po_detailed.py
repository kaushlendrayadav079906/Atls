import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

def main():
    client = get_sap_client()
    client.login()
    print("SAP Login Successful!")

    # 1. Search PurchaseOrders with NumAtCard, DocNum, etc.
    print("\n--- Searching PurchaseOrders ---")
    try:
        # Check all POs sorted by DocEntry desc
        res = client.get("PurchaseOrders", params={"$top": "30", "$orderby": "DocEntry desc"})
        pos = res.get("value", [])
        for p in pos:
            entry = p.get("DocEntry")
            num = p.get("DocNum")
            num_at_card = p.get("NumAtCard")
            ref2 = p.get("Reference2")
            comments = p.get("Comments")
            lines = p.get("DocumentLines", [])
            items = [(l.get("ItemCode"), l.get("Quantity")) for l in lines]
            print(f"PO DocEntry={entry}, DocNum={num}, NumAtCard={num_at_card}, Ref2={ref2}, DocDate={p.get('DocDate')}, Status={p.get('DocumentStatus')}, Items={items}")
            if "2627" in str(num) or "2627" in str(num_at_card) or "2627" in str(ref2) or "P0" in str(num_at_card or "") or "PO" in str(num_at_card or ""):
                print(f"   -> FOUND MATCH: DocEntry={entry}, DocNum={num}, NumAtCard={num_at_card}, Comments={comments}")
    except Exception as e:
        print("PO search error:", e)

    # 2. Check Drafts
    print("\n--- Searching Drafts ---")
    try:
        res = client.get("Drafts", params={"$top": "15", "$orderby": "DocEntry desc"})
        drafts = res.get("value", [])
        for d in drafts:
            doc_obj = d.get("DocObjectCode")
            num = d.get("DocNum")
            num_at_card = d.get("NumAtCard")
            print(f"Draft DocEntry={d.get('DocEntry')}, DocNum={num}, Object={doc_obj}, NumAtCard={num_at_card}, Date={d.get('DocDate')}")
    except Exception as e:
        print("Drafts search error:", e)

    # 3. Check Series for Purchase Orders (DocObjectCode '22' is Purchase Order)
    print("\n--- Checking Series ---")
    try:
        res = client.get("SeriesService_GetDocumentSeries", method="POST", json={"DocumentTypeParams": {"Document": "22"}})
        series_list = res.get("value", [])
        for s in series_list:
            print(f"Series: {s.get('Series')}, Name: {s.get('Name')}, Prefix: {s.get('Prefix')}, InitialNum: {s.get('InitialNum')}, NextNum: {s.get('NextNumber')}, PeriodIndicator: {s.get('PeriodIndicator')}")
    except Exception as e:
        # Fallback to direct query if SeriesService not available
        print("SeriesService error, trying query:", e)
        try:
            res = client.get("DocumentSeries", params={"$filter": "Document eq '22'"})
            print("DocumentSeries:", res)
        except Exception as e2:
            print("DocumentSeries query error:", e2)

    # 4. Check Sales Orders Series (Document '17')
    try:
        res = client.get("SeriesService_GetDocumentSeries", method="POST", json={"DocumentTypeParams": {"Document": "17"}})
        series_list = res.get("value", [])
        for s in series_list:
            print(f"SO Series: {s.get('Series')}, Name: {s.get('Name')}, Prefix: {s.get('Prefix')}, NextNum: {s.get('NextNumber')}, PeriodIndicator: {s.get('PeriodIndicator')}")
    except Exception as e:
        pass

if __name__ == "__main__":
    main()
