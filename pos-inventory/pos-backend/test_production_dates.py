import os
from app.services.sap.production_service import SAPProductionService
from app.services.sap.client import get_sap_client

def test_production():
    try:
        client = get_sap_client()
        client.login()
        svc = SAPProductionService()
        print("--- 2026 YEAR ---")
        res, total = svc.get_production_orders(date_from="2026-01-01", date_to="2026-12-31", top=100)
        print("Total fetched:", total)
        for r in res:
            print(r["production_order_no"], r["start_date"], r["posting_date"])
        
        print("\n--- 2024 YEAR ---")
        res, total = svc.get_production_orders(date_from="2024-01-01", date_to="2024-12-31", top=100)
        print("Total fetched:", total)
        if res:
            dates = [r["start_date"] for r in res if r["start_date"]]
            print("Min start_date:", min(dates) if dates else None)
            print("Max start_date:", max(dates) if dates else None)

    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_production()
