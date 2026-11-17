import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.abspath('pos-inventory/pos-backend/.env'))
sys.path.insert(0, os.path.abspath('pos-inventory/pos-backend'))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()
res = client.get("PurchaseDeliveryNotes", params={"$orderby": "DocEntry desc", "$top": 20})
for g in res.get("value", []):
    for l in g.get("DocumentLines", []):
        if l.get("ItemCode") == "CS1124":
            print(f"Found CS1124 in GRPO DocNum={g.get('DocNum')}, Line={l.get('LineNum')}, Quantity={l.get('Quantity')}, BaseType={l.get('BaseType')}, BaseEntry={l.get('BaseEntry')}, BaseLine={l.get('BaseLine')}")
