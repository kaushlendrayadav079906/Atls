# DASHBOARD COMPLETE AUDIT

## 1. Frontend: Dashboard.tsx
- **State**: Missing central `period` (TODAY, WEEK, MONTH, YEAR, TOTAL) state. Missing start/end date calculation based on this period.
- **Duplicate Components**: Two "Sales Overview" sections exist. The second one has hardcoded `₹20K` values.
- **KPI Cards**: `summary?.todayTotal` and `summary?.billCount` are used. Need to ensure backend `getSummary` respects branch AND period.
- **Active Shift**: Uses `user?.name`, which is fine, but needs to make sure it's the actual authenticated user data.
- **Low-stock Items**: Calls `dashboardApi.getInventoryRisk()`. Needs branch context.
- **Pending Approvals**: Calls `dashboardApi.getAlerts()`. Needs branch context.
- **Sales Overview Graph**: Missing dynamic period state passing.
- **Orders This Week Graph**: Uses `trendPoints.slice(-7)`. This is a frontend hack. Backend should provide exact orders group for the week.
- **Recent Sales**: Missing branch and period context. Hardcoded labels in UI (like `sale.docDate ? sale.docDate : 'Today'`).
- **Top Products**: Missing branch and period context.
- **AI Risk Analysis Summary**: Mocked with hardcoded `N/A`, `Not Available`. Needs to be hidden or wired if backend supports it.
- **Quick Actions**: Currently dead buttons without actual `Link` or `onClick` navigation.
- **AI Assistant**: UI only. Input is dead. Suggestions are dead.
- **Alerts & Approvals**: `alerts` are filtered but no dynamic fetching per period/branch correctly.
- **Header/SAP Connection Status**: `SAP Connected` is completely missing from the header.

## 2. React Query & API Client (`endpoints.ts`)
- Queries do not include `period` or date ranges in `queryKey`.
- `dashboardApi.getSummary`, `getRecentSales`, `getAlerts`, `getInventoryRisk` missing `period` arguments.
- `atlasApi.getTopProducts`, `getSalesTrend` missing `period` arguments.

## 3. Backend: `dashboard.py` / `atlas.py`
- Must check if backend actually supports `period` (start_date, end_date) and branch filtering consistently.

**Conclusion**: The frontend is missing a central period selector state and branch filtering consistency across all React Queries. Duplicate UI blocks exist.
