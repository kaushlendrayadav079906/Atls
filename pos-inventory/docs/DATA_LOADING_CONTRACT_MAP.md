# Data Loading Contract Map

## 1. Inventory Report Page
- **Frontend Page**: `Dashboard-Ui/src/pages/InventoryReportPage.tsx`
- **React Query Hooks**:
  - `['inventory-overview', warehouse]` -> `getInventoryOverview()`
  - `['inventory-distribution', warehouse]` -> `getInventoryDistribution()`
  - `['inventory-category-value', warehouse, topCategories]` -> `getInventoryValueByCategory()`
  - `['inventory-movements', warehouse, period]` -> `getInventoryMovements()`
  - `['inventory-products', page, limit, appliedFilters]` -> `getInventoryProducts()`
- **FastAPI Endpoints**: 
  - `GET /api/v1/reports/inventory/overview`
  - `GET /api/v1/reports/inventory/distribution`
  - `GET /api/v1/reports/inventory/value-by-category`
  - `GET /api/v1/reports/inventory/movements`
  - `GET /api/v1/reports/inventory/products`
- **Backend Service**: `app.services.sap.items_service.SAPItemsService` and `SAPInventoryService`
- **SAP OData Source**: `/b1s/v1/Items` and `/b1s/v1/InventoryGenEntries`

## 2. Global Dashboard
- **Frontend Page**: `Dashboard-Ui/src/pages/Dashboard.tsx`
- **React Query Hooks**:
  - `['dashboard-kpis']` -> `getDashboardKPIs()`
  - `['dashboard-sales']` -> `getDashboardSales()`
- **FastAPI Endpoints**: `GET /api/v1/dashboard/*`

## 3. Product Management
- **Frontend Page**: `Dashboard-Ui/src/pages/ProductsPage.tsx`
- **React Query Hooks**: `['products', filters]` -> `getProducts()`
- **FastAPI Endpoints**: `GET /api/v1/products`
- **SAP OData Source**: `/b1s/v1/Items`

*(Further mapping to be expanded during page-specific audits)*
