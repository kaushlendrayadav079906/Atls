import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.services.sap.client import get_sap_client

async def main():
    client = get_sap_client()
    try:
        # Fetch one invoice to see all its properties
        res = client.get("Invoices", {"$top": 1})
        if res.get("value"):
            inv = res["value"][0]
            udfs = {k: v for k, v in inv.items() if k.startswith("U_")}
            print("UDFs available on Invoice:", udfs)
        else:
            print("No invoices found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
