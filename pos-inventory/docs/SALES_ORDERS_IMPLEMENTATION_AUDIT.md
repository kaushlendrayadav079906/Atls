# Sales Orders Implementation Audit

## Existing Frontend Assets

- **Routes**: No existing `sales-orders` route found in `src/App.tsx`. Existing `/sales` points to `SalesList` and `/sales/:id` to `InvoiceDetail`.
- **Layout**: The sidebar in `src/components/Layout.tsx` already has "Sales & Invoices", but needs an "Orders" -> "Sales Orders" sub-menu.
- **Pages/Components**: No specific "Sales Orders" page or component exists yet. We will need to create `src/pages/SalesOrdersPage.tsx` and sub-components.
- **API Client**: Existing API client (likely Axios) and React Query setup can be reused.

## Existing Backend Assets

- **Endpoints**: `app/api/v1/sales.py` exists but seems to manage internal POS sales (invoices). No `/api/v1/sales-orders` endpoint exists.
- **SAP Services**:
  - `app/services/sap/client.py`: The SAP Service Layer client, handling sessions and requests. This MUST be reused.
  - `app/services/sap/invoices_service.py`: Exists for A/R Invoices, can serve as a reference.
  - No `app/services/sap/sales_orders_service.py` exists yet. We need to create it.
- **Authorization**: Branch isolation utilities exist and should be applied to the new Sales Orders endpoints.

## Implementation Plan (Phase 1 Conclusion)

- **Create Backend**: `app/api/v1/sales_orders.py` and `app/services/sap/sales_orders_service.py`.
- **Create Frontend**: `src/pages/SalesOrdersPage.tsx`, plus related components, routing, and queries.
- **Do NOT Touch**: `pos-inventory-v2` or unrelated services. We will integrate with the existing `app/services/sap/client.py` and existing frontend utilities.
