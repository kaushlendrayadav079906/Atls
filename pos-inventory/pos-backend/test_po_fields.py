import asyncio
import json
from app.services.sap.purchase_orders_service import SAPPurchaseOrdersService

async def main():
    service = SAPPurchaseOrdersService()
    # We use sync client in service but just to be sure we'll run it in standard way
    pos = service.client.get("PurchaseOrders?$top=1")
    
    if pos and "value" in pos and len(pos["value"]) > 0:
        doc = pos["value"][0]
        print(f"DocEntry: {doc.get('DocEntry')}")
        print("DocumentLines keys:")
        if "DocumentLines" in doc and len(doc["DocumentLines"]) > 0:
            line = doc["DocumentLines"][0]
            for k, v in line.items():
                if any(x in k for x in ["Quant", "Qty", "Open", "Remain", "Received", "Total"]):
                    print(f"{k}: {v}")
            
            print("\nAll keys in DocumentLines:")
            print(", ".join(line.keys()))
        else:
            print("No document lines")
    else:
        print("No purchase orders found")

if __name__ == "__main__":
    asyncio.run(main())
