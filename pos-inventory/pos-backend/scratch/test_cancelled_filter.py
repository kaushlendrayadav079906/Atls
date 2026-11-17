import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.abspath('pos-inventory/pos-backend/.env'))
sys.path.insert(0, os.path.abspath('pos-inventory/pos-backend'))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()
try:
    res = client.get('PurchaseOrders', params={'$filter': "Cancelled eq 'tNO'", '$orderby': "DocEntry desc", '$top': 3})
    print('Filtered PO count:', len(res.get('value', [])))
    for doc in res.get('value', []):
        print('PO DocNum:', doc.get('DocNum'), 'Cancelled:', doc.get('Cancelled'))
except Exception as e:
    print('PO Filter error:', e)

try:
    res = client.get('Orders', params={'$filter': "Cancelled eq 'tNO'", '$orderby': "DocEntry desc", '$top': 3})
    print('Filtered SO count:', len(res.get('value', [])))
    for doc in res.get('value', []):
        print('SO DocNum:', doc.get('DocNum'), 'Cancelled:', doc.get('Cancelled'))
except Exception as e:
    print('SO Filter error:', e)
