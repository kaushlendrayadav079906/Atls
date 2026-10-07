import sys
import os
import asyncio
from datetime import date, timedelta
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.services.sap.invoices_service import SAPInvoicesService

async def main():
    service = SAPInvoicesService()
    try:
        # Test today's invoices
        print("Fetching today's invoices...")
        today = date.today()
        invoices_today = service.get_invoices_by_date_with_lines(today)
        print(f"Found {len(invoices_today)} invoices today")
        
        # Test monthly trends
        start_date = today.replace(day=1)
        print(f"Fetching monthly invoices from {start_date}...")
        invoices_month = service.get_invoices_by_date_with_lines(start_date, today)
        print(f"Found {len(invoices_month)} invoices this month")
        
        # Test filter
        from app.api.v1.dashboard import _filter_invoices_by_branch
        print("Filtering for branch...")
        filtered = _filter_invoices_by_branch(invoices_month, None)
        print("Filtered successfully.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
