# Sales Orders Report SAP Mapping

This document maps the requested business report fields (from the SQL reference) to the verified SAP Business One Service Layer fields.

## Field Mappings

### Header Level

| SQL Field (Table.Column) | Business Label | SAP Service Layer Field | FastAPI Schema Field | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `ORDR.DocDate` | Date | `DocDate` | `doc_date` | Date of the sales order. |
| `ORDR.DocNum` | SO Number | `DocNum` | `doc_num` | Human-readable document number. |
| `ORDR.CardName` | Party Name | `CardName` | `card_name` | The customer's name. |
| `OSLP.SlpName` | Agent Name | `SalesPersonCode` | `sales_person_code` -> frontend translates to Agent Name | SAP provides `SalesPersonCode`. The frontend or backend translates this to the agent's name (e.g., using existing Sales Employee lookups, or if not available, we show the code). |
| `OCTG.PymntGroup`| Payment Days/Terms | `PaymentGroupCode` | `payment_group_code` -> frontend translates to Payment Terms | SAP provides `PaymentGroupCode` (equivalent to GroupNum). Real text descriptions require joining with PaymentTerms endpoint. We will pass the code and fetch/display the mapping. |

### Line Level (DocumentLines)

| SQL Field (Table.Column) | Business Label | SAP Service Layer Field | FastAPI Schema Field | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `RDR1.ItemCode` | Item Code | `ItemCode` | `item_code` | Code of the ordered item. |
| `RDR1.Dscription` | Item Name | `ItemDescription` | `item_description` | Name of the ordered item. |
| `RDR1.Quantity` | Ordered Qty | `Quantity` | `quantity` | Original quantity ordered. |
| `RDR1.PriceBefDi`| Rate | `Price` | `price` | In Service Layer, `Price` represents the unit price before line discount by default. We use this as Rate. |
| `RDR1.DelivrdQty`| Dispatch Qty | Calculated: `Quantity - RemainingOpenQuantity` | `dispatch_qty` | Service Layer does not expose `DelivrdQty` directly on `DocumentLines` in standard payloads. We calculate it by subtracting `RemainingOpenQuantity` (Balance) from `Quantity` (Ordered). |
| `Quantity - DelivrdQty` | Balance Qty | `RemainingOpenQuantity` | `balance_qty` | The `RemainingOpenQuantity` explicitly tracks the open balance. |
| `OITM.ItemName` | Item Group | `ItemDescription` | `item_group` (mapped to description) | The SQL strictly joins `OITM.ItemName` and labels it 'Item Group'. To match the SQL exactly without extra unnecessary OITM lookups per line, we use the `ItemDescription` (which equals OITM.ItemName). |

## Calculations

**Dispatch Qty** = `Quantity` - `RemainingOpenQuantity`
**Balance Qty** = `RemainingOpenQuantity`

This mapping strictly follows the SAP Service Layer conventions while providing exactly the requested business labels.
