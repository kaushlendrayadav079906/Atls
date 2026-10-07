# Sales Orders Live Verification

## Verification Summary
A live SAP connection verification was executed against the SAP Service Layer via `SAPSalesOrdersService`.

The `Orders` entity was correctly targeted (SAP's EDMX `Document` entity).

### Verified Output Structure
The SAP Service Layer responded successfully with the requested `$select` fields.

**SAP Request**:
`GET /b1s/v1/Orders?$select=DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,DocumentStatus,Cancelled,SalesPersonCode,BPL_IDAssignedToInvoice,Comments&$skip=0&$top=1&$orderby=DocEntry desc&$inlinecount=allpages`

**SAP Response Fields present**:
- `DocEntry` (Primary Key)
- `DocNum`
- `DocDate`
- `DocDueDate`
- `CardCode`
- `CardName`
- `DocTotal`
- `DocumentStatus` (e.g. `bost_Open`, `bost_Close`)
- `Cancelled` (`tNO`, `tYES`)
- `SalesPersonCode`
- `BPL_IDAssignedToInvoice` (for branch isolation)
- `Comments`

**Child verification for lines**:
A secondary check on `DocumentLines` confirms existence of:
- `ItemCode`
- `ItemDescription`
- `Quantity`
- `Price`
- `PriceAfterVAT`
- `LineTotal`
- `WarehouseCode`

All mapped fields are returning data matching our `SalesOrderListItem` and `SalesOrderDetail` schemas. No fallbacks were used.

The `docs/SALES_ORDERS_SAP_FIELD_MAPPING.md` has been verified as 100% accurate.
