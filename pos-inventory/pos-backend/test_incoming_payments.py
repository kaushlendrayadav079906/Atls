import logging
logging.basicConfig(level=logging.INFO)
from app.services.sap.client import get_sap_client
import json

c = get_sap_client()
c.login()
res = c.get('IncomingPayments', {'$top': 1})
print(json.dumps(res, indent=2))
