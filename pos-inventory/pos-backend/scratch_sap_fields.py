import os
import sys
import json

sys.path.append(os.path.abspath('c:/Users/A/Documents/IB/Dashboard/New Dashboard/Atls/pos-inventory/pos-backend'))
from app.services.sap.client import get_sap_client

client = get_sap_client()
try:
    response = client.get("/Orders?$top=1")
    doc = response["value"][0]
    print(f"DocNum: {doc.get('DocNum')}")
    print(f"SalesPersonCode: {doc.get('SalesPersonCode')}")
    print(f"GroupNumber: {doc.get('GroupNumber')}")
    print(f"PaymentGroupCode: {doc.get('PaymentGroupCode')}")
    
    line = doc.get("DocumentLines", [{}])[0]
    print(f"ItemCode: {line.get('ItemCode')}")
    print(f"ItemDescription: {line.get('ItemDescription')}")
    print(f"Quantity: {line.get('Quantity')}")
    print(f"Price: {line.get('Price')}")
    print(f"PriceAfterVAT: {line.get('PriceAfterVAT')}")
    
    print("\nLooking for dispatch/deliver qty fields in DocumentLines:")
    for key in line.keys():
        if "deliv" in key.lower() or "qty" in key.lower() or "quant" in key.lower():
            print(f"  {key}: {line.get(key)}")
            
except Exception as e:
    print(e)
