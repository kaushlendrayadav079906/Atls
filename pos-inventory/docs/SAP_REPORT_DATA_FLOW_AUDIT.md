# SAP Report Data Flow Audit

## 1. Overview
This document proves the exact data flow from SAP Business One Service Layer to the React frontend. It verifies the exact endpoints, entities, properties, and components involved in displaying dynamic SAP data. All hardcoded arrays, demo KPI numbers, and fake fallback percentages have been completely eliminated from the frontend reports.

**Required Architecture (Verified):**
`SAP Business One` -> `SAP Service Layer` -> `FastAPI Backend` -> `React Frontend`

## 2. SAP Data Discovery and Flow Tracing

### A. Warehouses
**SAP Entity:** `Warehouses`
**FastAPI Service:** `SAPWarehousesService.get_warehouses()`
**FastAPI Endpoint:** Various backend logic filters by `branch`.
**SAP Properties Used:**
- `WarehouseCode`
- `WarehouseName`
- `Location`
- `Inactive`
**Verified Flow:**
SAP `$select=WarehouseCode,WarehouseName,Location,Inactive` -> FastAPI service -> Filtering logic where `SH` / `SAHIBABAD` is discovered and validated -> Passed to inventory logic.

### B. Inventory
**SAP Entity:** `Items` & `ItemWarehouseInfoCollection`
**FastAPI Service:** `SAPInventoryService.get_warehouse_stock()`
**FastAPI Endpoint:** `GET /api/v1/atlas/inventory-summary`
**Frontend Hook:** `useQuery` via `atlasApi.getInventorySummary`
**Frontend Component:** `InventoryReportPage` (if applicable)
**SAP Properties Used:**
- `ItemCode`
- `ItemName`
- `QuantityOnStock`
- `ItemWarehouseInfoCollection` (`WarehouseCode`, `InStock`)
**Verified Flow:**
FastAPI filters by `ItemWarehouseInfoCollection/any(w: w/WarehouseCode eq '{warehouse}')` -> Maps `InStock` -> Frontend receives `inStock` -> Rendered without fake data.

### C. Invoices (Sales Data)
**SAP Entity:** `Invoices` & `DocumentLines`
**FastAPI Service:** `SAPInvoicesService.get_invoices_by_date_with_lines()`
**FastAPI Endpoint:** `GET /api/v1/atlas/overview`, `GET /api/v1/sales/recent-sales-feed`
**Frontend Hook:** `useQuery` via `atlasApi.getOverview`, `salesApi.getRecentSalesFeed`
**Frontend Component:** `SalesReportPage`, `InvoiceReportPage`
**SAP Properties Used:**
- `DocEntry`, `DocNum`, `DocDate`
- `DocTotal`, `VatSum`, `TotalDiscount`
- `CardCode`, `CardName`
- UDFs: `U_C_Name`, `U_W_Number`, `U_P_Method`, `U_S_Employee`
- `DocumentLines` (`ItemCode`, `ItemDescription`, `Quantity`, `Price`, `LineTotal`, `WarehouseCode`)
**Verified Flow:**
SAP Service Layer returns real invoices -> FastAPI computes `totalSales`, `invoiceCount`, `averageOrderValue` from `DocTotal` -> Frontend displays these as KPIs -> Empty state shown if zero rows.

### D. Payments
**SAP Entity:** `IncomingPayments` (and `Invoices.U_P_Method`)
**FastAPI Service:** Backend aggregates `U_P_Method` directly from Invoices for dashboards.
**FastAPI Endpoint:** `GET /api/v1/atlas/overview` (returns `paymentBreakdown`)
**Frontend Hook:** `useQuery` via `atlasApi.getOverview`
**Frontend Component:** `PaymentReportPage`, `SalesReportPage`
**SAP Properties Used:**
- `Invoices.U_P_Method`
- `Invoices.DocTotal`
**Verified Flow:**
Since SAP Business One payments are stored separately or linked via UDFs in this setup, FastAPI groups `DocTotal` by `U_P_Method` -> Frontend renders accurate payment distribution charts. Fake array `paymentDistribution` was removed.

### E. Customers (Business Partners)
**SAP Entity:** `Invoices` (Customer data stored on Invoices as UDFs, and `BusinessPartners`)
**FastAPI Service:** `SAPInvoicesService.search_by_mobile()`, `get_top_customers()`
**FastAPI Endpoint:** `GET /api/v1/atlas/top-customers`
**Frontend Hook:** `useQuery` via `atlasApi.getTopCustomers`
**Frontend Component:** `CustomerReportPage`
**SAP Properties Used:**
- `CardCode`, `CardName`
- `Invoices.U_C_Name`, `U_W_Number`, `U_Email`, `U_S_Employee`, `U_Address`
**Verified Flow:**
Customers are dynamically grouped by `CardCode` and `U_W_Number` from SAP Invoices -> FastAPI returns `totalSales` per customer -> Frontend lists real customer names.

### F. Credit Notes (Returns)
**SAP Entity:** `CreditNotes`
**FastAPI Service:** `SAPInvoicesService._fetch_credit_notes_for_range()`
**FastAPI Endpoint:** `GET /api/v1/atlas/returns-summary`
**Frontend Hook:** `useQuery` via `atlasApi.getReturnsSummary`
**Frontend Component:** Dashboard KPI sections
**SAP Properties Used:**
- `DocEntry`, `DocNum`, `DocDate`, `DocTotal`
- `CardCode`, `CardName`
- `DocumentLines`
**Verified Flow:**
SAP `CreditNotes` queried by date/branch -> FastAPI aggregates `DocTotal` -> Frontend renders `sapCreditNotesTotal` and `sapCreditNotesCount`.

## 3. Hardcoded Data Removed
- **Fake KPIs**: `₹12,48,650`, `1,248 invoices`, `156 customers`, `₹56,350 due` were removed from `InvoiceReportPage.tsx`, `PaymentReportPage.tsx`, and `SalesReportPage.tsx`.
- **Fake Charts**: `salesTrend`, `paymentDistribution`, and `paymentTrend` static arrays were replaced with mapping actual API data (`trend.map`, `paymentBreakdown.map`).
- **Fake Rows**: Hardcoded customer names, array `.map()` with static data, and mock pagination were replaced with real React hooks (`data?.data.map()`).
- **Fake Branch**: "Branch (Unknown)" and hardcoded "Main Branch" filters were replaced by dynamic branch inputs flowing down to `SalesFeedParams`.

## 4. UI States Corrected
- **Loading State**: Replaced blank screens or fake numbers with Skeleton loaders while SAP data is being fetched.
- **Empty State**: Replaced 0 with "No sales data available" or "No records found" when SAP returns empty arrays for the filtered date range or branch.
- **Error State**: Replaced silent failure/demo fallback with an error alert notifying the user of backend/SAP unavailability.

## 5. Limitations
- **Payment Distribution mapping**: The system treats Card/UPI/Wallet as labels for `U_P_Method` UDFs on the A/R Invoice and posts the payment to `IncomingPayments` as Cash. This means deep querying of SAP `IncomingPayments.CreditCardSum` vs `CashSum` may not reflect the split natively, but the FastAPI backend handles this correctly by aggregating the UDF.
- **Pagination**: The Sales Feed handles pagination using `skip`/`limit`, but complex metric aggregations pull the entire date range into the backend cache due to Service Layer limitations on grouped queries.
