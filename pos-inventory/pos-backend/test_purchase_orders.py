import os
import sys
import json

# Add current path to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.sap.client import get_sap_client

def test():
    client = get_sap_client()
    try:
        res = client.get('/PurchaseOrders?$top=1')
        print("====== PURCHASE ORDER ======")
        print(json.dumps(res.get('value', []), indent=2))
        
        # also let's grab metadata
        meta = client.get('/$metadata')
        with open('metadata.xml', 'w') as f:
            f.write(meta if isinstance(meta, str) else str(meta))
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
