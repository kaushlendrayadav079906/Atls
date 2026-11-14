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

    # Count total items
    c_all = client.get("Items/$count")
    print(f"Total Items: {c_all}")

    # Count active items (Valid eq 'tYES' and Frozen eq 'tNO')
    c_active = client.get("Items/$count", params={"$filter": "Valid eq 'tYES' and Frozen eq 'tNO'"})
    print(f"Active Items (Valid eq 'tYES' and Frozen eq 'tNO'): {c_active}")

    # Count inventory items
    c_inv = client.get("Items/$count", params={"$filter": "Valid eq 'tYES' and Frozen eq 'tNO' and InventoryItem eq 'tYES'"})
    print(f"Inventory Items (Valid and not Frozen and InventoryItem eq 'tYES'): {c_inv}")

if __name__ == "__main__":
    main()

