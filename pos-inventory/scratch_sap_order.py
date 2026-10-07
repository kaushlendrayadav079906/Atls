import os
import sys
import json

sys.path.append(os.path.abspath('pos-backend'))
from app.services.sap.client import get_sap_client  # type: ignore

client = get_sap_client()
try:
    print("Fetching single Order...")
    response = client.get("/Orders?$top=1")
    print(json.dumps(response, indent=2))
except Exception as e:
    print(e)
