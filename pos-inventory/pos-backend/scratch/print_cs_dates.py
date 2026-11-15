import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

client = get_sap_client()
for attempt in range(3):
    try: client.login(timeout=30.0); break
    except: pass

it = client.get("Items('CS1124')?$select=ItemCode,CreateDate,UpdateDate")
print(f"CS1124 CreateDate={it.get('CreateDate')}, UpdateDate={it.get('UpdateDate')}")

