# Reports SAP Data Flow Audit

## 1. Overview
This document outlines the data flow between the POS frontend reports (Sales, Invoice, Payment) and the SAP Business One Service Layer. It details the existing architecture, the state of the backend endpoints, and the corrections applied to remove hardcoded business data from the React frontend.

## 2. Current Architecture
- **Frontend (React)**: The UI consumes REST APIs via `apiClient` using `@tanstack/react-query` to fetch dashboard and analytics data.
- **Backend (FastAPI)**: Translates frontend requests into SAP Service Layer OData calls.
- **SAP Business One**: The operational source of truth. All data regarding items, stock, sales, invoices, and payments MUST originate from here.

### Relevant Backend Endpoints Found
During the audit, we found existing endpoints that perfectly match the required contracts for the reports, avoiding the need for new custom report schemas:
1. `GET /api/v1/atlas/overview`: Provides high-level KPIs (`totalSales`, `invoiceCount`, `averageOrderValue`) and `paymentBreakdown`.
2. `GET /api/v1/atlas/sales-trends`: Provides historical daily/weekly trend lines (`trend` array).
3. `GET /api/v1/sales/recent-sales-feed`: Provides a paginated list of invoices with details (`total`, `paymentMethod`, `items`, `hasReturn`).

## 3. Findings and Corrections

### Frontend Mock Data
The previous iterations of the `reports` directory pages contained extensively hardcoded data:
- Hardcoded KPI values (e.g., `₹12,48,650` for Sales).
- Hardcoded inline array maps for recent sales and invoices.
- Hardcoded payment distribution values (e.g., `34.7%` for Card, Visa).
- Hardcoded sales trends data.

### Corrections Implemented
All three report pages were completely rewritten to eliminate dependency on mock data:
1. **`SalesReportPage.tsx`**: Now uses `atlasApi.getOverview`, `atlasApi.getSalesTrend`, and `atlasApi.getRecentSalesFeed`.
2. **`InvoiceReportPage.tsx`**: Now uses `atlasApi.getOverview` and `salesApi.getSalesFeed`.
3. **`PaymentReportPage.tsx`**: Now uses `atlasApi.getOverview`, `atlasApi.getSalesTrend`, and `salesApi.getSalesFeed`.

Each page now includes proper `isLoading`, `isError`, and empty state handling via a custom `StateMessage` component. Because the SAP tunnel is currently experiencing connection issues (`[WinError 10061] Connection Refused`), the frontend gracefully degrades to display these error/empty states instead of showing fake data.

## 4. Backend Contracts Verification
Due to the SAP connection being actively refused during the audit, dynamic verification of new SAP `$metadata` was paused. However, the backend already possessed production-ready endpoints (`/api/v1/atlas` and `/api/v1/sales`) which correctly read from SAP's `DocumentLines` and `OINV` (AR Invoices). These endpoints were verified through code analysis to ensure they use dynamic SAP data rather than static responses.

### Next Steps for SAP Connectivity
1. Resolve the SSH tunnel / Proxy connection to `http://localhost:50001/b1s/v1`.
2. Verify that the current backend SAP requests succeed without returning 502/504 errors.
3. Once data flows again, the frontend reports will automatically populate with real-time operational data.
