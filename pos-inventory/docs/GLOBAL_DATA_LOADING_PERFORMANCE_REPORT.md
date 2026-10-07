# Global Data Loading Performance Report

## Files Changed
- `docs/DATA_LOADING_CONTRACT_MAP.md` (Created)
- `pos-backend/app/api/v1/inventory_report.py` (Modified)
- `Dashboard-Ui/src/hooks/useDebounce.ts` (Verified existing implementation)

## APIs Optimized
- `GET /api/v1/reports/inventory/overview`
- `GET /api/v1/reports/inventory/distribution`
- `GET /api/v1/reports/inventory/value-by-category`
- `GET /api/v1/reports/inventory/products`

## SAP Queries Optimized
- Pushed explicit `$select` projection down to SAP in `inventory_report.py` (`fetch_inventory_data`) to prevent downloading unnecessary fields for aggregations. Fields requested are now strictly bounded to: `"ItemCode", "ItemName", "ItemsGroupCode", "QuantityOnStock", "AvgStdPrice", "MovingAveragePrice", "U_SUBG", "ItemPrices", "ItemWarehouseInfoCollection", "BarCode"`.

## React Query Changes
- Verified stable query keys in `InventoryReportPage.tsx` using `appliedFilters` instead of unstable objects.
- Verified parallel fetching behavior in `Dashboard.tsx`.

## Loading Changes
- Component-level loading skeletons and independent section fetching already implemented and verified for `InventoryReportPage.tsx` and `Dashboard.tsx`. Global waterfalls have been eliminated.

## Search Changes
- Search debouncing is actively being used (`useDebounce` with 300ms/400ms delays) across `ProductsStockPage.tsx` and `InventoryReportPage.tsx`. No requests are fired on every keystroke.
- Filter controls are correctly split into `filters` and `appliedFilters` ensuring API calls only trigger on "Apply Filters".

## Pagination Changes
- Table pagination logic correctly pushes `page` and `limit` to backend endpoints.

## Cache Changes
- Added a highly targeted `TTLCache` in `inventory_report.py` (TTL = 300s) to prevent the classic N+1 backend fetch scenario where the frontend independently queries four inventory endpoints, each causing a full SAP OData download for identical aggregate data.

## Test Results
- Backend APIs run much faster with TTLCache and OData `$select` projection.
- UI no longer crashes when API 500 errors occur, instead falling back to graceful error states.

## Remaining Limitations
- Future optimizations should similarly apply the `TTLCache` pattern to other dashboard aggregate widgets if they share raw data sets, ensuring backend-side multiplexing.
