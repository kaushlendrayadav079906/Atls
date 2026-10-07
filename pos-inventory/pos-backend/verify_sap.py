import asyncio
from app.services.sap.client import get_sap_client

async def run():
    client = get_sap_client()
    try:
        response = client.get('IncomingPayments', {'$top': 1})
        p = response.get('value', [])[0]
        print(','.join(p.keys()))
        print('\n--- PAYMENT ---')
        print(f'CashSum: {p.get("CashSum")}')
        print(f'TransferSum: {p.get("TransferSum")}')
        
        # Look for credit card fields
        cc = [k for k in p.keys() if 'credit' in k.lower() or 'card' in k.lower()]
        print(f'Card related fields: {cc}')
    except Exception as e:
        print(f'Error: {e}')

asyncio.run(run())
