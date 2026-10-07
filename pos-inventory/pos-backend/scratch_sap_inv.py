import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.services.sap.inventory_service import SAPInventoryService

async def main():
    service = SAPInventoryService()
    try:
        items = service.get_warehouse_stock("SH")
        print(f"Found {len(items)} items in inventory")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
