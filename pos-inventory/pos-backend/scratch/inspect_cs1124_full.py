import sys, os, json
from dotenv import load_dotenv
load_dotenv(os.path.abspath('pos-inventory/pos-backend/.env'))
sys.path.insert(0, os.path.abspath('pos-inventory/pos-backend'))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

item = client.get("Items('CS1124')")
print("All keys on Items('CS1124'):")
all_keys = list(item.keys())
print("Total keys:", len(all_keys))

target_keys = [k for k in all_keys if any(x in k.lower() for x in ['user', 'text', 'draw', 'weight', 'qc', 'chk', 'lm', 'olng', 'lpk', 'lbl', 'mc', 'pt', 'update', 'create', 'date'])]
for k in sorted(target_keys):
    print(f"  {k}: {repr(item[k])}")
