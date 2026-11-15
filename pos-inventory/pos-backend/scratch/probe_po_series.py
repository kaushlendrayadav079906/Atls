import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.client import get_sap_client

def main():
    client = get_sap_client()
    client.login(timeout=30.0)
    print("Logged in!")

    try:
        # Increase timeout for the call
        res = client.post("SeriesService_GetDocumentSeries", data={"DocumentTypeParams": {"Document": "22"}})
        for s in res.get("value", []):
            print(f"PO Series: Series={s.get('Series')}, Name={s.get('Name')}, Prefix={s.get('Prefix')}, InitialNum={s.get('InitialNum')}, NextNum={s.get('NextNumber')}")
    except Exception as e:
        print("PO Series error:", e)

if __name__ == "__main__":
    main()

