import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

def main():
    client = get_sap_client()
    for attempt in range(3):
        try:
            client.login(timeout=30.0)
            break
        except Exception:
            pass

    it = client.get("Items('CS1124')?$select=ItemCode,ItemName,CreateDate,UpdateDate,QuantityOnStock")
    print("CS1124 details:", it)

if __name__ == "__main__":
    main()

