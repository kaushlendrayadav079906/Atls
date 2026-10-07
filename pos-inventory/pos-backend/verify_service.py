import asyncio
from datetime import date
from dateutil.relativedelta import relativedelta
from app.services.sap.payments_report_service import SAPPaymentsReportService

async def run():
    print("Initializing SAPPaymentsReportService...")
    service = SAPPaymentsReportService()
    
    today = date.today()
    start_date = (today - relativedelta(months=1)).strftime('%Y-%m-%d')
    end_date = today.strftime('%Y-%m-%d')
    
    print(f"\nFetching payments from {start_date} to {end_date}...")
    payments = service.get_payments_by_date(start_date, end_date)
    
    print(f"\nTotal Payments Retrieved: {len(payments)}")
    if payments:
        p = payments[0]
        print(f"\n--- First Payment Record ---")
        print(f"DocEntry: {p.get('DocEntry')}")
        print(f"DocNum: {p.get('DocNum')}")
        print(f"DocDate: {p.get('DocDate')}")
        print(f"CardCode: {p.get('CardCode')}")
        print(f"CardName: {p.get('CardName')}")
        print(f"CashSum: {p.get('CashSum')}")
        print(f"TransferSum: {p.get('TransferSum')}")
        print(f"CreditCards: {p.get('CreditCards')}")
        print(f"PaymentInvoices count: {len(p.get('PaymentInvoices', []))}")
        print(f"_InvoiceDocNum mapped: {p.get('_InvoiceDocNum')}")
        print(f"_PaymentMethod inferred: {p.get('_PaymentMethod')}")
        print(f"_TotalAmount derived: {p.get('_TotalAmount')}")
        
    # Summaries
    print("\n--- Distribution ---")
    dist = {}
    for p in payments:
        m = p.get("_PaymentMethod")
        dist[m] = dist.get(m, 0) + p.get("_TotalAmount", 0)
    for k, v in dist.items():
        print(f"{k}: {v}")
        
    print("\n--- Done ---")

if __name__ == "__main__":
    asyncio.run(run())
