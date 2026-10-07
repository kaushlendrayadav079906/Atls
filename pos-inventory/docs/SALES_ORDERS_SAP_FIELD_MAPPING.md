# Sales Orders SAP Field Mapping

## Orders (Entity: Document)

| UI Field | API Field | FastAPI Schema | SAP Entity | SAP Field | Verified | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Internal ID | doc_entry | doc_entry | Orders | DocEntry | Yes | Primary Key |
| Order No. | doc_num | doc_num | Orders | DocNum | Yes | Document Number |
| Order Date | doc_date | doc_date | Orders | DocDate | Yes | |
| Delivery Date| doc_due_date | doc_due_date | Orders | DocDueDate | Yes | |
| Customer Code| card_code | card_code | Orders | CardCode | Yes | |
| Customer Name| card_name | card_name | Orders | CardName | Yes | |
| Total Amount | doc_total | doc_total | Orders | DocTotal | Yes | |
| Status | document_status | document_status| Orders | DocumentStatus | Yes | Used with Cancelled |
| Cancelled | cancelled | cancelled | Orders | Cancelled | Yes | 'Y' or 'N' |
| Created By | sales_person_code | sales_person_code| Orders | SalesPersonCode | Yes | |
| Branch | bpl_id | bpl_id | Orders | BPL_IDAssignedToInvoice | Yes | For branch isolation |
| Comments | comments | comments | Orders | Comments | Yes | |

## DocumentLines (Property of Orders)

| UI Field | API Field | FastAPI Schema | SAP Entity | SAP Field | Verified | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Item Code | item_code | item_code | DocumentLine | ItemCode | Yes | |
| Description | item_description | item_description| DocumentLine | ItemDescription | Yes | |
| Quantity | quantity | quantity | DocumentLine | Quantity | Yes | |
| Price | price | price | DocumentLine | Price | Yes | |
| Price After VAT | price_after_vat | price_after_vat| DocumentLine | PriceAfterVAT | Yes | |
| Line Total | line_total | line_total | DocumentLine | LineTotal | Yes | |
| Warehouse | warehouse_code | warehouse_code | DocumentLine | WarehouseCode | Yes | |
