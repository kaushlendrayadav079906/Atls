import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.services.sap.client import get_sap_client

async def main():
    client = get_sap_client()
    try:
        res = client.get("Invoices", {"$top": 1, "$select": "DocNum,U_W_Number"})
        print("Success:", res)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
