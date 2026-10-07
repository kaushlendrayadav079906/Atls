# Invoice Report Implementation

## 1. Frontend files changed
- `Dashboard-Ui/src/pages/reports/InvoiceReportPage.tsx`: Completely refactored to implement the full UI from the reference image, including global filter state, recharts integration for Invoice Trend and Payment Method Donut chart, Top Customers list, and data synchronization across components.
- `Dashboard-Ui/src/api/endpoints.ts`: Ensured `atlasApi` endpoints for `getOverview`, `getSalesTrend`, `getTopCustomers`, and `getRecentSalesFeed` are correctly configured to pass all filter parameters.

## 2. Backend files changed
- `pos-backend/app/api/v1/atlas.py`: Added support for advanced filtering (customer, category, payment method) across `get_overview`, `get_sales_trends`, `get_top_customers`, and `get_product_velocity`.

## 3. API endpoints used
- `/atlas/overview`: Fetches KPI values (Total Invoices, Total Sales, Avg Invoice Value, Payment Breakdown).
- `/atlas/sales-trends`: Fetches daily/weekly/monthly/yearly sales trend data for the ComposedChart.
- `/atlas/top-customers`: Fetches the top customers by invoice amount for the list.
- `/dashboard/recent-sales-feed`: Fetches paginated invoice list for the table.

## 4. SAP fields used
- `DocEntry` & `DocNum` (Invoice Identification)
- `DocDate` (Date Range filtering and display)
- `CardCode` & `CardName` (Customer filtering and Top Customers)
- `DocTotal` & `VatSum` (Sales Amount calculations)
- `U_P_Method` (Payment Method breakdown and filtering)
- `DocumentLines.WarehouseCode` (Branch filtering)

## 5. Date filtering logic
Implemented dynamic date calculations based on the selected period:
- **Today**: Current date `start = end` (Hourly buckets)
- **This Week**: Start of current week to today (Daily buckets)
- **This Month**: Start of current month to today (Daily buckets)
- **This Year**: Start of current year to today (Monthly buckets)
All components receive the same `range` parameter.

## 6. Payment mapping
Mapped existing `U_P_Method` from SAP to visual categories in the Payment Method Donut chart using consistent colors (Cash: Green, Card: Purple/Blue, UPI: Orange, Credit: Teal, Other: Gray).

## 7. Top customer calculation
Aggregates `DocTotal` grouped by `CardCode` and `CardName` through the `/atlas/top-customers` endpoint, returning the top 5 with proportional visual bars.

## 8. Chart aggregation logic
The `AtlasSalesTrend` response from the backend automatically groups data into appropriate buckets (hourly/daily/monthly) based on the requested `range`, which is fed directly into a `recharts` `ComposedChart`.

## 9. Security/branch filtering
Branch filtering uses `_get_permitted_branch`, meaning managers are locked to their own branches while admins can view all or filter by specific ones. This applies uniformly to all charts and the invoice list.

## 10. Tests performed
- Verified filter state synchronisation (Apply Filters updates everything at once).
- Verified chart responsiveness and layout structure.
- Verified backend filter application on SAP data.

## 11. Unverified SAP Fields
- Invoice status mapping (Pending/Paid) currently relies on `Cancelled` and basic completion logic since specific payment status mapping requires deep SAP integration and verification of incoming payments logic.
