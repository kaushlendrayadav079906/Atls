import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.sap.items_service import SAPItemsService

def main():
    service = SAPItemsService()
    items = service.get_items(top=1000)
    print(f"Fetched {len(items)} items from get_items(top=1000)")
    item_codes = [it.get("ItemCode") for it in items]
    print(f"First 10 item codes: {item_codes[:10]}")
    print(f"Last 10 item codes: {item_codes[-10:]}")

    for target in ["AMIT001", "CS1124", "CS0227", "SFG02495", "FG3114"]:
        print(f"Is {target} in top 1000? {'YES' if target in item_codes else 'NO'}")

if __name__ == "__main__":
    main()

