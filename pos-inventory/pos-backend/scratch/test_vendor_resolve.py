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

    for vcode in ["V00020", "V001", "V00001"]:
        try:
            res = client.get(f"BusinessPartners('{vcode}')?$select=CardCode,CardName")
            print(f"Vendor {vcode} -> {res.get('CardName')}")
        except Exception as e:
            print(f"Vendor {vcode} error: {e}")

if __name__ == "__main__":
    main()

