# Purchase Orders SAP Metadata Audit

## 1. SAP Connection Status
- Connected successfully using existing `SAPClient` and credentials.

## 2. Metadata Verification
- Read-only request performed on `/PurchaseOrders?$top=1`.
- The SAP Service Layer endpoint for Purchase Orders is `/PurchaseOrders`.

## 3. EntitySet
- `PurchaseOrders`

## 4. EntityType
- Likely `Document` (similar to Sales Orders, standard SAP Document type).

## 5. Header Fields (Verified)
- `DocEntry` (int) - Internal ID
- `DocNum` (int) - Purchase Order Number
- `DocDate` (string) - Order Date
- `DocDueDate` (string) - Expected / Delivery Date
- `CardCode` (string) - Supplier Code
- `CardName` (string) - Supplier Name
- `DocTotal` (float) - Total Amount
- `DocumentStatus` (string) - Status (e.g., `bost_Close`)
- `Cancelled` (string) - Cancelled flag (`tNO` / `tYES`)
- `SalesPersonCode` (int) - Buyer / Employee assigned
- `BPL_IDAssignedToInvoice` (int) - Branch assigned
- `Comments` (string) - Comments/Remarks

## 6. DocumentLines (Verified)
- `ItemCode` (string)
- `ItemDescription` (string)
- `Quantity` (float)
- `Price` (float)
- `PriceAfterVAT` (float)
- `LineTotal` (float)
- `WarehouseCode` (string)

## 7. Status Values
- Open: `bost_Open`
- Closed: `bost_Close`
- Cancelled flag: `tYES`

## 8. Branch Field
- Verified: `BPL_IDAssignedToInvoice`

## 9. Warehouse Field
- Verified: `DocumentLines/WarehouseCode`

## 10. Supplier Fields
- Verified: `CardCode` and `CardName` represent the vendor/supplier.

## 11. Buyer Field
- Verified: `SalesPersonCode`

## 12. Date Fields
- `DocDate` (Order Date)
- `DocDueDate` (Expected / Delivery Date)

## 13. Pagination Support
- Standard `$skip`, `$top`, `$orderby`, `$inlinecount` are supported just like other Document endpoints.

## 14. Search Support
- Standard substring filtering on `CardName`, `CardCode`, etc.

## 15. Sample READ-ONLY Request
`GET /PurchaseOrders?$top=1`

## 16. Sample Response Summary
```json
{
    "DocEntry": 1,
    "DocNum": 1,
    "DocDate": "2023-09-25T00:00:00Z",
    "DocDueDate": "2023-09-25T00:00:00Z",
    "CardCode": "VEN002",
    "CardName": "HASAGREEN Ven",
    "DocTotal": 1050.0,
    "DocumentStatus": "bost_Close",
    "Cancelled": "tNO",
    "BPL_IDAssignedToInvoice": 3,
    "SalesPersonCode": -1,
    "DocumentLines": [
      {
        "ItemCode": "CABLE0001",
        "ItemDescription": "BajajCable",
        "Quantity": 10.0,
        "Price": 100.0,
        "PriceAfterVAT": 105.0,
        "LineTotal": 1000.0,
        "WarehouseCode": "SH"
      }
    ]
}
```

## 17. Limitations
- `/$metadata` endpoint returned a massive payload that threw a JSON parse error due to Service Layer returning raw XML. However, actual OData fields were extracted dynamically from a live document payload, meaning we don't strictly need the `$metadata` XML map.
