# ATLAS – Phase 2: Google Sheets as the Stock Configuration Data Source

**Version:** 2.0.0  
**Status:** Completed & Verified  
**Date:** November 2026  
**Scope:** `pos-inventory` (Backend & Frontend)

---

## 1. Executive Summary

Phase 2 elevates the Google Sheets integration from a connection-verification foundation into the **primary source of truth and write destination** for ATLAS **Stock Configuration** management.

Key outcomes achieved:
1. **Google Sheets as Source of Truth**: When connected, Stock Configuration entries are retrieved directly from the configured Google Sheet (`Stock Configuration` worksheet) and displayed in the existing enterprise table with client-side searching, vendor filtering, and pagination.
2. **Add New Stock Item**: Submitting new stock items generates a stable permanent Record ID (`REC-YYYYMMDDHHMMSS-XXXX`) and appends the row to Google Sheets via `values().append()`. Zero write calls are sent to SAP Business One.
3. **Row-Level Submit (Edit Existing Item)**: Allows editing permitted fields in place and submitting changes using the row's permanent `Record ID` (or `item_code` fallback). Employs optimistic concurrency checking (`expected_updated_at`) to prevent stale overwrite conflicts (HTTP 409).
4. **Submit Modified Entries**: Batch submits only modified rows to Google Sheets using a single atomic `spreadsheets.values.batchUpdate()` call, reporting per-row successes and failures without discarding failed updates.
5. **Submit All Entries**: Safe confirmation modal displaying the exact record count before issuing a single batch update to Google Sheets with SAP write-protection active.
6. **Data Ownership & ERP Protection**: Strict source ownership is enforced. Google Sheets owns Stock Configuration records; SAP Business One master data, purchase orders, goods receipts, and invoices are strictly read-only and completely shielded from modification.

---

## 2. Dynamic Column Mapping Architecture

The integration dynamically maps the 22 business fields across spreadsheet headers, supporting variations in naming and column ordering:

| Field Key | Canonical Column Name | Accepted Aliases / Headers | Data Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `record_id` | Record ID | `record_id`, `rec_id`, `id`, `serial_id` | String | Permanent unique ID (`REC-...`) |
| `item_code` | SAP Item Code | `sap_item_code`, `item_code`, `sap code`, `itemcode` | String | Unique part number / item identifier |
| `description` | Description | `item_name`, `item description`, `desc` | String | Part/product title |
| `qty` | Quantity | `qty`, `quantity`, `planned_qty` | Float | Non-negative numeric |
| `stock_qty` | Stock Quantity | `stock_qty`, `current_stock`, `in_stock` | Float | Current warehouse stock |
| `vendor_name` | Vendor Name | `vendor`, `supplier`, `cardname` | String | Vendor / Supplier name |
| `grpo_no` | GRPO Number | `grpo_no`, `grpo`, `goods_receipt_po` | String | Goods receipt reference number |
| `rcvd_qty` | Received Quantity | `rcvd_qty`, `received_qty`, `received_quantity` | Float | Quantity received from vendor |
| `nt_weight` | Net Weight | `nt_weight`, `net_weight`, `weight` | Float | Net component weight |
| `qc` | QC | `qc`, `qc_status`, `quality_check` | Boolean | Mapped to `PASS` / `NO` in sheet |
| `drw_yn` | Drawing | `drw_yn`, `drw`, `drawing`, `drawing_yn` | Enum ('Y'/'N') | Engineering drawing check |
| `v_chk` | V Check | `v_chk`, `vendor_check`, `v_check` | Enum ('Y'/'N') | Visual / vendor check |
| `ok_qty` | OK Quantity | `ok_qty`, `accepted_qty`, `passed_qty` | Float | Accepted inspection quantity |
| `rej_qty` | Rejected Quantity | `rej_qty`, `rejected_qty` | Float | Rejected inspection quantity |
| `lm` | LM | `lm`, `laser_marking`, `line_marking` | Enum ('Y'/'N') | Marking verification |
| `olng` | OLNG | `olng`, `oiling`, `loading` | Enum ('Y'/'N') | Oiling / coating flag |
| `lpk` | LPK | `lpk`, `loose_packing`, `line_packing` | Enum ('Y'/'N') | Packing verification |
| `lbl` | LBL | `lbl`, `labeling`, `label` | Enum ('Y'/'N') | Labeling verification |
| `mc_or_pt` | MC or PT | `mc_or_pt`, `machining`, `part_test` | Enum ('Y'/'N') | Machining / part testing |
| `entry_date` | Entry Date | `entry_date`, `created_date`, `created_at` | Date String | Creation date |
| `updated_at` | Updated At | `updated_at`, `modified_at`, `timestamp` | ISO String | Used for optimistic concurrency |
| `updated_by` | Updated By | `updated_by`, `modified_by`, `user` | String | User audit trail |

---

## 3. Backend Endpoints

Mounted under `/api/v1/integrations/google-sheets`:

### `POST /stock-records` (Status: 201 Created)
- Appends a new Stock Configuration record to the active Google Sheet.
- Generates a unique stable `record_id` if not provided.
- Validates that numeric quantities are non-negative.
- Checks against duplicate Record IDs.

### `PUT /stock-records/{record_id}` (Status: 200 OK)
- Updates permitted fields of an existing row in Google Sheets identified by `record_id` (or `item_code`).
- Performs concurrency check: if `expected_updated_at` is older than the sheet's `updated_at`, returns `HTTP 409 Conflict`.
- Preserves the permanent `Record ID` and sets `updated_at` to the current UTC timestamp and `updated_by` to the current user.

### `POST /stock-records/bulk` & `PUT /stock-records/bulk` (Status: 200 OK)
- Bulk updates modified or all eligible stock configuration records in a single batch.
- Translates valid updates into Google Sheets `values().batchUpdate()`.
- Returns detailed per-record statuses (`results`) and overall `successful` / `failed` counts.

### `POST /stock-records/refresh` (Status: 200 OK)
- Reloads the entire worksheet dataset from Google Sheets.
- Updates `last_successful_sync_at` timestamp.

---

## 4. Frontend Implementation

### Stock Configuration Page (`Dashboard-Ui/src/pages/StockConfigurationPage.tsx`)
- **Real-Time Data Source Detection**: Queries `googleSheetsApi.getStatus()`.
- **Informative Status Banner**: When connected, displays an enterprise badge:
  `Source of Truth: Google Sheets | Spreadsheet: <Name> (<Sheet>) | Last Synced: <Time> | SAP Write-Protection Active (Read-Only)`
- **Dynamic Table View**: Displays the permanent `Record ID` in emerald font under the SAP Item Code.
- **Action Buttons**:
  - `Refresh Google Sheets`: Fetches live updates directly from Google Sheets.
  - `Submit Modified Entries`: Submits only dirty rows via `bulkUpdateStockRecords`.
  - `Submit All Entries`: Opens confirmation modal indicating record count and SAP protection before bulk update.
  - `Add New Item`: Modal explicitly notes Google Sheets destination and auto-generated Record ID.

---

## 5. Security & Verification

### Test Coverage
- **Backend Tests (`test_google_sheets.py`)**: 29 automated tests (100% passing).
  - `test_create_stock_configuration_record_success`
  - `test_create_duplicate_record_id_rejected`
  - `test_update_stock_configuration_record_success`
  - `test_update_record_not_found`
  - `test_update_record_concurrency_conflict`
  - `test_bulk_update_stock_configuration_records`
  - `test_sap_write_protection`
  - `test_api_create_stock_record_endpoint`
  - `test_api_update_stock_record_endpoint`
  - `test_api_bulk_update_stock_records_endpoint`
  - `test_api_refresh_stock_records_endpoint`
- **Backend Regression Tests (`test_stock_configuration.py`)**: 5 tests (100% passing).
- **Frontend Unit Tests**: 15 test suites, 110 tests (100% passing).
- **Frontend Production Build**: `tsc -b && vite build` passed with zero errors.

