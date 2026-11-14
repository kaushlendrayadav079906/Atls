import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

def main():
    client = get_sap_client()
    client.login(timeout=30.0)

    # Test A: As sales_orders_service does it:
    print("--- Test A: endpoint='/Orders?$top=2&$orderby=DocEntry desc' ---")
    res_a = client.get("/Orders?$top=2&$orderby=DocEntry desc")
    items_a = res_a.get("value", [])
    print(f"Test A returned {len(items_a)} items:")
    for x in items_a[:3]:
        print(f"   DocEntry={x.get('DocEntry')}, DocNum={x.get('DocNum')}")

    # Test B: endpoint='Orders', params={'$top': '2', '$orderby': 'DocEntry desc'}
    print("\n--- Test B: endpoint='Orders', params={...} ---")
    res_b = client.get("Orders", params={"$top": "2", "$orderby": "DocEntry desc"})
    items_b = res_b.get("value", [])
    print(f"Test B returned {len(items_b)} items:")
    for x in items_b[:3]:
        print(f"   DocEntry={x.get('DocEntry')}, DocNum={x.get('DocNum')}")

    # Test C: endpoint='Orders?$top=2&$orderby=DocEntry desc' (NO LEADING SLASH)
    print("\n--- Test C: endpoint='Orders?$top=2&$orderby=DocEntry desc' ---")
    res_c = client.get("Orders?$top=2&$orderby=DocEntry desc")
    items_c = res_c.get("value", [])
    print(f"Test C returned {len(items_c)} items:")
    for x in items_c[:3]:
        print(f"   DocEntry={x.get('DocEntry')}, DocNum={x.get('DocNum')}")

    # Test D: Search DocNum eq 26271140 as sales_orders.py generates it
    print("\n--- Test D: Filter search 26271140 ---")
    # sales_orders.py does: filters = ["(DocNum eq 26271140 or substringof('26271140', CardName) or substringof('26271140', CardCode))"]
    # endpoint = f"/Orders?$select=...&$skip=0&$top=10&$orderby=DocEntry desc&$filter=(DocNum eq 26271140 or substringof('26271140', CardName) or substringof('26271140', CardCode))&$inlinecount=allpages"
    f = "(DocNum eq 26271140 or substringof('26271140', CardName) or substringof('26271140', CardCode))"
    res_d1 = client.get(f"/Orders?$filter={f}&$orderby=DocEntry desc&$top=5")
    print(f"Test D1 (with leading slash) returned {len(res_d1.get('value', []))} items: entries={[x.get('DocEntry') for x in res_d1.get('value', [])[:3]]}")

    res_d2 = client.get("Orders", params={"$filter": f, "$orderby": "DocEntry desc", "$top": "5"})
    print(f"Test D2 (with params dict) returned {len(res_d2.get('value', []))} items: entries={[x.get('DocEntry') for x in res_d2.get('value', [])[:3]]}")

if __name__ == "__main__":
    main()

