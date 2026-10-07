import asyncio
from datetime import date
from dateutil.relativedelta import relativedelta
from app.services.sap.payments_report_service import SAPPaymentsReportService

async def run():
    service = SAPPaymentsReportService()
    today = date.today()
    start_date = (today - relativedelta(years=2)).strftime('%Y-%m-%d')
    end_date = today.strftime('%Y-%m-%d')
    
    payments = service.get_payments_by_date(start_date, end_date)
    print(f'Total Payments Retrieved: {len(payments)}')
    if payments:
        p = payments[0]
        print(f'DocEntry: {p.get("DocEntry")}')
        print(f'DocNum: {p.get("DocNum")}')
        print(f'_InvoiceDocNum: {p.get("_InvoiceDocNum")}')
        print(f'_PaymentMethod: {p.get("_PaymentMethod")}')
        print(f'_TotalAmount: {p.get("_TotalAmount")}')

asyncio.run(run())
