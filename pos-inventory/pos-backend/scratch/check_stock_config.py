import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.stock_configuration_service import StockConfigurationService

def main():
    service = StockConfigurationService()
    res = service.get_items(page=1, page_size=10)
    print(f"Total items in Stock Configuration: {res.get('total')}")
    print(f"KPIs: {res.get('kpis')}")
    print(f"SAP Status: {res.get('sap_status')}")
    print(f"First 5 items:")
    for it in res.get("items", [])[:5]:
        print(f"  {it.get('sr_no')}: {it.get('item_code')} | {it.get('description')} | Stock: {it.get('stock_qty')} | EntryDate: {it.get('entry_date')}")

    # Check whether CS1124 or CS0227 exist in stock_configuration
    for code in ["CS1124", "CS0227"]:
        r = service.get_items(search=code)
        print(f"Search for {code} in Stock Configuration: found {r.get('total')} items")

if __name__ == "__main__":
    main()

