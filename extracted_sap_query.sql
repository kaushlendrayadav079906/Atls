selected, even though the SAP system contains newly created records.

I am providing the existing SAP SQL query below. Treat this query as the primary business reference for the Stock Configuration data structure.

## 1. Investigate the existing implementation

Inspect:

- Stock Configuration frontend page.
- Stock Configuration API endpoint.
- SAP Business One Service Layer adapter.
- Stock Configuration service and repository.
- Existing SQL/query implementation.
- Date filtering and branch filtering.
- SAP pagination and caching.

Identify exactly why the latest SAP records are missing.

Do not change code before identifying the root cause.

## 2. Understand the provided SQL query

The query uses:

- OITM – Item Master.
- OPOR / POR1 – Purchase Orders.
- OPDN / PDN1 – Goods Receipt PO.
- ORDR / RDR1 – Sales Orders.
- OCRD – Business Partners.
- OITW – Warehouse stock.

It calculates or retrieves:

- SAP Code.
- Description.
- SO Quantity.
- Stock Quantity.
- Vendor Name.
- GRPO Number.
- Received Quantity.
- Net Weight.
- QC.
- Drawing.
- V Check.
- OK Quantity.
- Rejected Quantity.
- LM.
- OLNG.
- I PK.
- LBL.
- MC or PT.

Preserve the original business meaning and joins.

Important: The existing query uses INNER JOINs. Therefore, items without a matching Purchase Order and Goods Receipt PO are excluded. Verify whether this is intended.

Do not silently change this business rule.

## 3. Fix missing latest records
<truncated 3168 bytes>
10. # ATLAS – Phase 2: Implement SAP Stock Configuration Data Synchronization Fix

Work ONLY in the existing `pos-inventory` repository. Do not modify `pos-inventory-v2`.

The investigation has identified these problems:

1. Stock Configuration currently retrieves Item Master records from SAP.
2. `entry_date` is mapped from `OITM.CreateDate`.
3. GRPO transactions are not properly represented as separate stock receipt records.
4. The Today filter consequently misses newly received stock.
5. The supplied SQL contains two UNION ALL 