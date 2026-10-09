import os
import json
from app.services.sap.production_service import SAPProductionService
from app.services.sap.client import get_sap_client

def test_endpoints():
    try:
        client = get_sap_client()
        client.login()
        svc = SAPProductionService()
        
        df = None
        dt = None
        wh = None
        
        print("\n--- Summary ---")
        print(svc.get_production_summary(date_from=df, date_to=dt, warehouse=wh))
        
        print("\n--- Orders (first 2) ---")
        orders, tot = svc.get_production_orders(skip=0, top=2, date_from=df, date_to=dt, warehouse=wh)
        print("Total:", tot, "First:", orders[0] if orders else None)

        print("\n--- Date Wise ---")
        dw = svc.get_date_wise_production(date_from=df, date_to=dt, warehouse=wh)
        print("Count:", len(dw), "Sample:", dw[:2] if dw else None)
        
        print("\n--- Item Wise ---")
        iw = svc.get_item_wise_production(date_from=df, date_to=dt, warehouse=wh)
        print("Count:", len(iw), "Sample:", iw[:2] if iw else None)
        
        print("\n--- Rejection ---")
        rej = svc.get_rejection_summary(date_from=df, date_to=dt, warehouse=wh)
        print("Total items with rejection:", rej.get("items_with_rejection"))
        
        print("\n--- Status Distribution ---")
        print(svc.get_status_distribution(date_from=df, date_to=dt, warehouse=wh))
        
        print("\n--- Warehouse Summary ---")
        print(svc.get_warehouse_summary(date_from=df, date_to=dt, warehouse=wh))
        
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_endpoints()
