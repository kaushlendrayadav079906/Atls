from app.services.sap.client import get_sap_client
import json

client = get_sap_client()
res = client.get("BusinessPartners", params={"$filter": "CardType eq 'cCustomer'", "$top": 1})
print(json.dumps(res, indent=2))
