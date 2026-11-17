import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.abspath('pos-inventory/pos-backend/.env'))
sys.path.insert(0, os.path.abspath('pos-inventory/pos-backend'))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()
res = client.get("PurchaseDeliveryNotes", params={"$filter": "DocNum eq 474"})
doc = res.get("value", [])[0]
print("GRPO 474:")
print("  DocNum:", doc.get("DocNum"))
print("  CardName:", doc.get("CardName"))
for l in doc.get("DocumentLines", []):
    print("  Line:", l.get("LineNum"), "ItemCode:", l.get("ItemCode"), "Quantity:", l.get("Quantity"), "BaseType:", l.get("BaseType"), "BaseEntry:", l.get("BaseEntry"), "BaseLine:", l.get("BaseLine"))
