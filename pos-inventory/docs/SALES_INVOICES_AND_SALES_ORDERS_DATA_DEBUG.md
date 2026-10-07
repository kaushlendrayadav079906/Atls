# Sales Invoices & Sales Orders Data Debug

## A. Sales Orders Page
PAGE -> FRONTEND COMPONENT -> REACT QUERY HOOK -> API FUNCTION -> HTTP ENDPOINT -> FASTAPI ROUTER -> SERVICE -> SAP ENTITY -> SAP RESPONSE -> FRONTEND RESPONSE -> UI

- **FRONTEND COMPONENT**: `SalesOrdersPage.tsx` (Status: BLOCKED)
- **REACT QUERY HOOK**: (Status: FAIL - Not Implemented)
- **API FUNCTION**: (Status: FAIL - Not Implemented)
- **HTTP ENDPOINT**: `GET /api/v1/sales-orders` (Status: PASS)
- **FASTAPI ROUTER**: `app/api/v1/sales_orders.py` (Status: PASS)
- **SERVICE**: `SAPSalesOrdersService.list_sales_orders` (Status: PASS)
- **SAP ENTITY**: `Orders` (Status: PASS)
- **SAP RESPONSE**: Evaluated via live read-only verification previously. (Status: PASS)
- **FRONTEND RESPONSE**: (Status: BLOCKED)
- **UI**: Displaying skeleton placeholder. (Status: BLOCKED)

**Root Cause (Sales Orders):** The frontend UI component `SalesOrdersPage.tsx` currently only contains a visual skeleton. It lacks the React Query hook integration to call the newly created `/api/v1/sales-orders` API. The data flow dies at the React layer because no network request is ever dispatched.

## B. Sales & Invoices Page
PAGE -> FRONTEND COMPONENT -> REACT QUERY HOOK -> API FUNCTION -> HTTP ENDPOINT -> FASTAPI ROUTER -> SERVICE -> SAP ENTITY -> SAP RESPONSE -> FRONTEND RESPONSE -> UI

- **FRONTEND COMPONENT**: `SalesList.tsx` (Status: PASS)
- **REACT QUERY HOOK**: `useQuery` via `salesApi.getSalesFeed` (Status: UNKNOWN)
- **API FUNCTION**: `apiClient.get('/dashboard/recent-sales-feed')` (Status: UNKNOWN)
- **HTTP ENDPOINT**: `GET /api/v1/dashboard/recent-sales-feed` (Status: UNKNOWN)
- **FASTAPI ROUTER**: `app/api/v1/dashboard.py` (Status: UNKNOWN)
- **SERVICE**: Likely hitting `invoices_service.py` under the hood. (Status: UNKNOWN)
- **SAP ENTITY**: `Invoices` (Status: UNKNOWN)

**Initial Diagnosis (Sales & Invoices):** The Sales List page routes to `/dashboard/recent-sales-feed` rather than a dedicated paginated `sales` endpoint. This feed endpoint may not be designed to power a full datatable (it might lack proper pagination or filter support). Furthermore, we need to verify the network panel to see if it is returning a 401 Unauthorized or if the data shape `res.data` mismatches the expected `DashboardRecentSalesPage` interface.
