# Purchase Orders SAP Mapping

## Entity
EntitySet: PurchaseOrders
EntityType: Document (implicit standard)

## Header Mapping

| UI Field | SAP Field | SAP Type | Verified |
|---|---|---|---|
| Internal ID | DocEntry | Int | YES |
| PO No. | DocNum | Int | YES |
| Order Date | DocDate | String | YES |
| Expected Date | DocDueDate | String | YES |
| Supplier Code | CardCode | String | YES |
| Supplier Name | CardName | String | YES |
| Total Amount | DocTotal | Float | YES |
| Status | DocumentStatus | String | YES |
| Cancelled | Cancelled | String | YES |
| Branch | BPL_IDAssignedToInvoice | Int | YES |
| Buyer | SalesPersonCode | Int | YES |
| Comments | Comments | String | YES |

## Document Lines

| UI Field | SAP Field | SAP Type | Verified |
|---|---|---|---|
| Item Code | ItemCode | String | YES |
| Description | ItemDescription | String | YES |
| Quantity | Quantity | Float | YES |
| Price | Price | Float | YES |
| Price After VAT | PriceAfterVAT | Float | YES |
| Line Total | LineTotal | Float | YES |
| Warehouse | WarehouseCode | String | YES |

## Status Mapping

| SAP Value | UI Status |
|---|---|
| bost_Open (and Cancelled = tNO) | Pending |
| bost_Close (and Cancelled = tNO) | Received |
| Cancelled = tYES | Cancelled |

## Branch
Branch mapping correctly uses `BPL_IDAssignedToInvoice`.

## Warehouse
Warehouse mapping correctly uses `DocumentLines/WarehouseCode`.

## Supplier
Supplier mapping uses `CardCode` and `CardName`. (Business Partner Type Vendor)

## Buyer
Buyer mapping uses `SalesPersonCode`.

## Date Fields
Order Date uses `DocDate`.
Expected Date uses `DocDueDate`.

## Pagination
Pagination uses `$skip`, `$top`, `$orderby`, and `$inlinecount`.

## Search
Search uses substring matching on `CardName` and `CardCode`.

## Example Verified Purchase Order
DocEntry: 1
DocNum: 1
Supplier: VEN002 - HASAGREEN Ven
Total: 1050.0
Status: bost_Close

## OPEN PO REPORT MAPPING

PO No
→ PurchaseOrders.DocNum
→ doc_num
→ poNumber

PO Date
→ PurchaseOrders.DocDate
→ doc_date
→ orderDate

Vendor Name
→ PurchaseOrders.CardName
→ card_name
→ supplierName

Item Code
→ DocumentLines.ItemCode
→ item_code
→ itemCode

Item Name
→ DocumentLines.ItemDescription
→ item_description
→ itemName

PO Rate
→ DocumentLines.Price
→ price
→ poRate

PO Qty
→ DocumentLines.Quantity
→ quantity
→ poQty

Received Qty
→ Calculated (Quantity - RemainingOpenQuantity)
→ received_quantity
→ receivedQuantity

Bal/Open Qty
→ DocumentLines.RemainingOpenQuantity
→ open_quantity
→ openQuantity
