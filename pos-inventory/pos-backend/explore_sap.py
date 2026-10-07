import json
import logging
from app.services.sap.client import get_sap_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def explore_sap():
    client = get_sap_client()
    try:
        client.login()
        logger.info("SAP Login Success")

        # 1. Get $metadata
        meta = client.request("GET", "$metadata")
        with open("sap_metadata.xml", "wb") as f:
            f.write(meta.content)
        logger.info("Saved sap_metadata.xml")

        # 2. Get Warehouses
        res = client.request("GET", "Warehouses?$select=WarehouseCode,WarehouseName,Location,Branch,Inactive,EnableBinLocations,BusinessPlaceID")
        with open("sap_warehouses.json", "w") as f:
            json.dump(res.json(), f, indent=2)
        logger.info("Saved sap_warehouses.json")

        # 3. Get Items (Top 5)
        res = client.request("GET", "Items?$top=5&$select=ItemCode,ItemName,InventoryItem,SalesItem,PurchaseItem,QuantityOnStock,ItemWarehouseInfoCollection,ItemUnitOfMeasurementCollection,Properties1")
        with open("sap_items.json", "w") as f:
            json.dump(res.json(), f, indent=2)
        logger.info("Saved sap_items.json")

        # 4. Get Invoices (Top 5)
        res = client.request("GET", "Invoices?$top=5&$select=DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,VatSum,TotalDiscount,DocumentStatus,PaymentMethod,DocumentLines")
        with open("sap_invoices.json", "w") as f:
            json.dump(res.json(), f, indent=2)
        logger.info("Saved sap_invoices.json")

        # 5. Get IncomingPayments (Top 5)
        res = client.request("GET", "IncomingPayments?$top=5&$select=DocEntry,DocNum,DocDate,CardCode,CardName,CashSum,CreditCardSum,TransferSum,CheckSum,PaymentInvoices,PaymentCreditCards")
        with open("sap_payments.json", "w") as f:
            json.dump(res.json(), f, indent=2)
        logger.info("Saved sap_payments.json")

        # 6. Get CreditNotes (Top 5)
        res = client.request("GET", "CreditNotes?$top=5&$select=DocEntry,DocNum,DocDate,CardCode,CardName,DocTotal,DocumentLines")
        with open("sap_creditnotes.json", "w") as f:
            json.dump(res.json(), f, indent=2)
        logger.info("Saved sap_creditnotes.json")

        # 7. Get BusinessPartners (Top 5)
        res = client.request("GET", "BusinessPartners?$top=5&$select=CardCode,CardName,CardType,GroupCode,Phone1,EmailAddress,BPAddresses,Valid,Frozen")
        with open("sap_businesspartners.json", "w") as f:
            json.dump(res.json(), f, indent=2)
        logger.info("Saved sap_businesspartners.json")

    except Exception as e:
        logger.error(f"Error exploring SAP: {e}")

if __name__ == "__main__":
    explore_sap()
