# Payment Report Data Flow

## Overview

The Payment Report module is designed to provide operational and financial visibility into payments processed through the POS system, sourcing its data strictly from real SAP Business One entities. This document outlines the data lineage from SAP Service Layer up to the React frontend components.

## SAP Business One Entities Used

To accurately report on payments, the system queries the **IncomingPayments** endpoint, which is the operational source of truth for payment receipts in SAP. 

1. **IncomingPayments** (`/b1s/v1/IncomingPayments`)
   - `DocEntry` / `DocNum`: Unique SAP identifiers for the incoming payment document.
   - `DocDate`: The date of the payment transaction.
   - `CardCode` / `CardName`: The Business Partner (customer) identifier and name.
   - `CashSum`: The amount paid in cash. (Note: in the current implementation of `SAPPaymentsService`, the full amount for pos transactions is often posted to CashSum regardless of actual method).
   - `TransferSum`: Bank transfer amounts.
   - `PaymentInvoices`: A collection of invoices linked to the incoming payment.
   - `BPLID` / `BPLName`: Branch definitions.
   - `Cancelled`: Whether the payment is cancelled (used for filtering out invalid payments).

2. **Invoices** (`/b1s/v1/Invoices`)
   - Queried as a supplementary call to resolve the specific payment method (`U_P_Method`).
   - The original `SAPPaymentsService` doesn't post `U_P_Method` directly on `IncomingPayments`, but it is recorded on the POS Invoice. We cross-reference the `PaymentInvoices[].DocEntry` with the `Invoices` endpoint to fetch `U_P_Method` and the `DocNum`.

## Backend Architecture

### Service Layer: `SAPPaymentsReportService`
Path: `pos-backend/app/services/sap/payments_report_service.py`

This service executes queries against the SAP Service Layer.
- **`get_payments_by_date`**: Fetches `IncomingPayments` with a date filter (`$filter=DocDate ge ... and DocDate le ...`).
- **Data Enrichment**: Since `U_P_Method` and `DocNum` reside on the invoice, the service aggregates all invoice references from the fetched payments and runs batched `$filter` queries against the `Invoices` endpoint to retrieve these missing fields.
- **Computed Fields**: 
  - `_TotalAmount` = `CashSum` + `TransferSum`
  - `_PaymentMethod` = `Invoices.U_P_Method` (defaults to 'cash' if missing)
  - `_InvoiceDocNum` = `Invoices.DocNum`

### API Layer: `/api/v1/reports/payments/...`
Path: `pos-backend/app/api/v1/payments_report.py`

Exposes tailored endpoints for the UI:
- **`GET /overview`**: Aggregates total payment values, counts, and averages.
- **`GET /distribution`**: Groups payments by `_PaymentMethod` to return `{method, total, count}` objects.
- **`GET /trend`**: Groups payments by `DocDate` (daily) to return `{label, amount, count}`.
- **`GET /transactions`**: Returns a paginated list of enriched payment records. Also handles text-based search (Invoice No, Customer, Transaction ID) and filtering.

## Frontend Architecture

### API Client: `paymentsReportApi`
Path: `Dashboard-Ui/src/api/endpoints.ts`

Uses `axios` to query the new REST endpoints. Types are defined for all response shapes (e.g., `PaymentOverview`, `PaymentTransactionItem`).

### UI Component: `PaymentReportPage`
Path: `Dashboard-Ui/src/pages/reports/PaymentReportPage.tsx`

- **State Management**: Uses `@tanstack/react-query` to fetch, cache, and synchronize data from the backend.
- **Filters**: State hooks for `dateRange`, `branchId`, `paymentMethod`, and `paymentStatus`. A debounced search input filters the transactions table.
- **KPIs**: Mapped directly from the `GET /overview` endpoint (Total Payments, Paid Invoices, Avg Value).
- **Charts**: Utilizes `recharts`. The PieChart feeds from `GET /distribution`, mapping categories (cash, card, upi) to brand colors. The ComposedChart (Bar+Line) feeds from `GET /trend`, rendering both volume and count over time.
- **Table**: Iterates over the `items` array from `GET /transactions`, displaying precise, un-mocked data. Transaction IDs fallback to SAP `DocNum` to ensure realism.
