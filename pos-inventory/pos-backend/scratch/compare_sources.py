import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.stock_configuration_service import StockConfigurationService
from app.services.sap.items_service import SAPItemsService

def main():
    service = StockConfigurationService()
    sap_items_service = SAPItemsService()

    test_items = [
        "AMIT001",
        "SFG02495",
        "SFG02500",
        "FG3114",
        "CS1124",
        "CS0227",
        "BAC0001",
    ]

    print(f"{'Item Code':<12} | {'SAP Exists':<10} | {'ATLAS Prod API':<15} | {'Stock Config DB':<15} | {'Stock Qty':<10}")
    print("-" * 75)

    for code in test_items:
        # 1. SAP Item Master
        sap_item = sap_items_service.get_item_by_code(code)
        sap_exists = "YES" if sap_item else "NO"
        sap_stock = sap_item.get("QuantityOnStock") if sap_item else "N/A"

        # 2. ATLAS Products API
        prod_res = sap_items_service.get_items(search=code)
        prod_exists = "YES" if any(p.get("ItemCode") == code for p in prod_res) else "NO"

        # 3. Stock Configuration DB
        sc_res = service.get_items(search=code)
        sc_exists = "YES" if sc_res.get("total", 0) > 0 else "NO"

        print(f"{code:<12} | {sap_exists:<10} | {prod_exists:<15} | {sc_exists:<15} | {str(sap_stock):<10}")

if __name__ == "__main__":
    main()

