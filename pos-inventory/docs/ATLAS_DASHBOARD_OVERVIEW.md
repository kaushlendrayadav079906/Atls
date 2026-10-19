# ATLAS Retail Operations Dashboard — Comprehensive Overview

## 1. Executive Summary & Objective

The **ATLAS Retail Operations Dashboard** has been upgraded into a clean, modern, lightly animated single-page command center. The upgraded dashboard preserves the complete ATLAS enterprise design system, left navigation sidebar, top navigation, branch and date-range filters, and floating AI Assistant, while consolidating operational telemetry across all nine core enterprise business domains.

Every metric, counter, status badge, and chart rendered on the dashboard is connected directly to authorized backend services and database models. No hardcoded or simulated business values are used. Where SAP ERP integration is active, live SAP tags are displayed; where local database caching is used, local badges are indicated. When permissions are restricted, RBAC rules prevent information disclosure.

---

## 2. Dashboard Layout Architecture

The upgraded dashboard is structured into five cohesive sections organized from high-level enterprise health down to granular operational activity:

```
+----------------------------------------------------------------------------------------------------+
| ATLAS Retail Operations Dashboard Header                                                          |
| [Branch Selector: All Branches ▼]  [Date Range: This Month ▼]  [🔄 Refresh]                        |
+----------------------------------------------------------------------------------------------------+
| 1. KEY BUSINESS METRICS (7 Interactive KPI Cards)                                                 |
| [Sales Revenue] [Completed Bills] [Low-Stock Items] [Pending POs] [Production] [Approvals] [Paid] |
+----------------------------------------------------------------------------------------------------+
| 2. AI QUICK INSIGHTS & SUGGESTION CHIPS STRIP                                                      |
| [Bot Icon] Data-backed summary narrative ...                                                       |
| [💡 Show today's sales] [💡 Products low on stock?] [💡 Pending POs] [💡 Compare months] ...      |
+----------------------------------------------------------------------------------------------------+
| 3. CHARTS & TRENDS                                                                                 |
| +-----------------------------------------------+ +-----------------------------------------------+ |
| | Sales & Revenue Trends (Area/Bar + Toggle)     | | Orders by Status Distribution (Donut)         | |
| +-----------------------------------------------+ +-----------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
| 4. BUSINESS OPERATIONS OVERVIEW (9 Domain Cards Grid)                                              |
| [Product & Inventory]  [Sales & POS Billing]   [Sales Orders]                                     |
| [Purchases & Vendors]  [Customers & CRM]       [Payments & Collections]                           |
| [Production & Factory] [Returns & Approvals]   [Reports & Intelligence]                           |
+----------------------------------------------------------------------------------------------------+
| 5. OPERATIONAL ACTIVITY FEED (Tabbed Live Tables)                                                 |
| [Recent Sales]  [Sales Orders]  [Purchase Orders]  [Production Orders]  [Pending Approvals]       |
| Dynamic Table (Top 5 items, status pills, amounts, customer/vendor, View All link)                |
+----------------------------------------------------------------------------------------------------+
```

### A. Dashboard Header
- **Title & Description**: Modern enterprise typography (`Retail Operations Dashboard` with subtitle contextualizing the selected branch and timeframe).
- **Branch Selector**: Filters telemetry across specific retail/warehouse branches or aggregates globally across `All Branches`.
- **Date Range Selector**: Synchronizes timeframe filtering (`Today`, `This Week`, `This Month`, `This Year`, `All Dates`).
- **Refresh Control**: One-click manual reload button triggering simultaneous background refetch of all React Query hooks with a spinning indicator during fetch.

### B. Key Business Metrics (7 KPI Cards)
Rendered in a responsive flex/grid row with staggered entrance animations (`fade-in-up`), subtle hover lift, and click-through navigation to authorized module views:
1. **Sales Revenue**: Total gross turnover with currency formatting (`₹`), dynamic growth indicator, linked to `/sales`.
2. **Completed Bills**: Total transactions finalized via POS or direct invoicing, linked to `/pos`.
3. **Low-Stock Items**: Real-time count of SKUs at or below minimum reorder thresholds with amber status warning, linked to `/inventory`.
4. **Pending Purchase Orders**: Number of open/submitted vendor purchase orders awaiting receipt, linked to `/purchase-orders?status=pending`.
5. **Planned Production Orders**: Count of scheduled production runs in `PLANNED` or `IN_PROGRESS` status, linked to `/production`.
6. **Pending Approvals**: Queue count for pending purchase/return authorizations requiring managerial action, linked to `/approvals`.
7. **Total Collections**: Total incoming payment collections recorded for the period, linked to `/finance`.

### C. AI Quick Insights & Suggestion Chips Strip
A compact, non-intrusive intelligence banner bridging the dashboard to the ATLAS AI Assistant:
- **Real-Time Synthesis**: Generates an instant human-readable overview of operational status using live query data (e.g., current revenue vs. low-stock risk).
- **Interactive Suggestion Chips**: 6 curated chips (`Show today's sales`, `Which products are running low on stock?`, `Show pending purchase orders`, `Compare this month with last month`, `Show production rejection trends`, `Summarize overall business performance`).
- **One-Click Execution**: Clicking any suggestion chip automatically launches the floating AI Assistant chat drawer and instantly posts the question, generating conversational explanations, KPI summary cards, interactive Recharts visualizations, and tabular breakdowns.

### D. Visual Analytics & Charts
- **Sales & Revenue Trend**: High-resolution Area/Bar chart displaying revenue trajectory over days/months with toggleable timeframe aggregation.
- **Order Status Distribution**: Donut chart displaying breakdown across `Completed`, `Pending`, `Draft`, and `Cancelled` states.

### E. Business Operations Overview (9 Module Grid)
Comprehensive 3-column responsive grid providing summarized health across every enterprise module:
1. **Product & Inventory** (`/inventory`): Total catalog SKUs, low-stock alerts, out-of-stock items, valuation indicator.
2. **Sales & POS Billing** (`/pos`): Completed counter sales, active terminals, gross sales value.
3. **Sales Orders** (`/sales-orders`): Total customer orders, pending fulfillment, confirmed status count.
4. **Purchases & Vendors** (`/purchase-orders`): Total POs, pending delivery, active vendor count.
5. **Customers & CRM** (`/customers`): Total customer base, top customer attribution, outstanding receivables indicator.
6. **Payments & Collections** (`/finance`): Incoming customer payments, outgoing vendor disbursements, cash flow balance.
7. **Production & Factory** (`/production`): Scheduled production runs, completed runs, scrap/rejection rate.
8. **Returns & Approvals** (`/approvals`): Pending authorization queue, approved credit notes, inspection returns.
9. **Reports & Intelligence** (`/reports`): Financial statements, stock aging, sales velocity analytics, quick shortcut to AI analysis.

### F. Operational Activity Feed
Tabbed live table displaying the latest 5 records per domain with rapid drill-down links:
- **Recent Sales Tab**: Receipt #, date/time, customer name, payment mode, total amount, status pill.
- **Sales Orders Tab**: Order #, customer, item count, date, delivery status, value.
- **Purchase Orders Tab**: PO #, vendor name, creation date, approval state, total cost.
- **Production Orders Tab**: Order ID, product name, planned quantity, priority, production status.
- **Pending Approvals Tab**: Request ID, category (PO / Credit Note), submitter, request date, action link.
- **View All Footer**: Direct registered route navigation with query params to view the full paginated table.

---

## 3. Inventory of Modules, APIs & Data Sources

| Module Name | Frontend Route | Backend Endpoints Invoked | Primary Data Source | RBAC Permission Key | Refresh & Cache Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sales & POS** | `/sales`, `/pos` | `GET /api/v1/sales/overview`, `GET /api/v1/sales/transactions` | Local PostgreSQL + Live Sync | `sales:read` | 60s stale time, refetch on window focus |
| **Product & Inventory** | `/inventory`, `/products` | `GET /api/v1/inventory/overview`, `GET /api/v1/inventory/low-stock` | Local SQLite/Postgres (Synced with SAP OData) | `inventory:read` | 60s stale time, invalidated on stock adjust |
| **Sales Orders** | `/sales-orders` | `GET /api/v1/sales-orders/summary`, `GET /api/v1/sales-orders` | Local DB / SAP SalesOrder OData | `sales:read` | 60s stale time |
| **Purchases & Vendors**| `/purchase-orders` | `GET /api/v1/purchase-orders/summary`, `GET /api/v1/purchase-orders` | Local DB / SAP PurchaseOrder OData | `purchases:read` | 60s stale time |
| **Customers & CRM** | `/customers` | `GET /api/v1/customers/insights`, `GET /api/v1/customers` | Local Customer Master / BusinessPartner | `customers:read` | 120s stale time |
| **Payments & Finance** | `/finance`, `/payments` | `GET /api/v1/payments-report/overview` | Local Payments Ledger | `finance:read` | 60s stale time (`WRITEBACK=False`) |
| **Production** | `/production` | `GET /api/v1/production/summary`, `GET /api/v1/production/orders` | Local Production Orders | `production:read` | 60s stale time |
| **Returns & Approvals**| `/approvals`, `/returns` | `GET /api/v1/returns/approval-queue` | Local Approval Queue | `approvals:read` | 30s stale time |
| **AI Assistant** | Floating Drawer | `POST /api/v1/ai/chat`, `POST /api/v1/ai/explain` | Hybrid (Vector Store + Multi-domain API Queries) | All Authenticated | Session state retained in React Context |

---

## 4. Global Filters & Data Consistency

### Branch Filtering
- Managed globally by `useBranchFilter()`.
- When a specific branch (e.g. `Main Store`, `Warehouse A`) is selected, query parameters `branch_id` or `branch` are propagated to backend requests.
- When `All Branches` (`all`) is active, the backend performs multi-branch aggregation across tenant branches.

### Date-Range Filtering
- Managed by `useDateFilter()`.
- Standardized options:
  - `Today`: Restricts start and end timestamps to the current calendar day in the local system timezone (`2026-10-19`).
  - `This Week`: Restricts from Monday of the current week to current time.
  - `This Month`: First calendar day of current month to current time.
  - `This Year`: Current calendar year.
  - `All Dates`: Unbounded historical range.
- Timezone handling: Standard JavaScript `Intl` and local `Date` constructor methods are used to avoid UTC day-shift slicing bugs.
- Static catalog indicators (e.g. total registered product SKUs) display a subtext explaining they represent cumulative catalog size rather than period-limited transactions.

---

## 5. Role-Based Access Control (RBAC)

The dashboard enforces role-based access control at both visual and routing levels using `useAuth()`:
- **Card-Level Guarding**: If `canAccess(module)` evaluates to `false` for an employee or cashier account, the module card displays an "Access Restricted" view with a lock icon, hiding sensitive financial or supplier metrics.
- **Tab Filtering**: The Operational Activity Section automatically filters out unauthorized tabs (e.g. an employee without purchase permissions will not see the "Purchase Orders" tab).
- **Backend Enforcement**: All endpoints validate JWT bearer tokens and reject unauthorized queries with HTTP 403 Forbidden.

---

## 6. Animations, Motion & Accessibility

- **CSS Keyframes**: Clean, hardware-accelerated animations defined in `src/index.css`:
  ```css
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  ```
- **Staggered Delays**: Top KPI cards and module cards enter with 50ms stagger intervals (`animationDelay: 50ms, 100ms, 150ms...`), providing an organic, modern entrance without delaying user interaction.
- **Hover Micro-interactions**: `.dashboard-card-hover` applies smooth translateY(-2px) elevation and soft drop shadow.
- **Accessibility & Reduced Motion**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
  Users with `prefers-reduced-motion` enabled experience immediate rendering without motion or transition delays.

---

## 7. Disclosures & Unavailable Capabilities

1. **Finance Writeback Disabled**: `FINANCE_WRITEBACK_ENABLED=False` is preserved in the backend configuration. The dashboard strictly performs read-only financial telemetry aggregation; no automatic write operations to SAP G/L accounts occur from this screen.
2. **SAP Live Sync State**: When SAP ERP connectivity is active, the respective module card displays a green `SAP Live` badge; when using the local database cache, a neutral `Local DB` badge is rendered.
3. **Activity Table Pagination Limits**: The Operational Activity Feed displays the 5 most recent records per category. Comprehensive multi-page filtering and CSV/Excel exports are delegated to each respective dedicated module page via the "View All" link.

---

## 8. Verification & Test Results

### A. Frontend Unit & Integration Tests (Vitest)
Command executed: `npm test -- --run`
- **Test Files**: 8 passed (100%)
- **Total Tests**: 70 passed, 0 failed
- **BusinessOverviewGrid Unit Tests**:
  - `renders all 9 business module cards for authorized users` (PASSED)
  - `displays correct metrics for each module` (PASSED)
  - `renders lock indicator when user lacks permission` (PASSED)
  - `navigates to correct registered route links` (PASSED)

### B. Backend API & AI Verification Tests (Pytest)
Command executed: `pytest tests/test_ai_assistant.py tests/test_finance_ai.py`
- **Total Tests**: 63 passed, 0 failed
- Validated all dynamic chat responses, KPI synthesis, chart structure generation, and financial read-only guards.

### C. TypeScript & Vite Production Build
Command executed: `npm run build`
- **Result**: `tsc -b && vite build` completed successfully with **0 TypeScript errors** and **0 compilation warnings** in 8.64s.

### D. End-to-End Live Visual Browser Verification
Browser subagent executed on `http://localhost:5173`:
1. Navigated to main Retail Operations Dashboard.
2. Verified 7 Top KPI cards with real values (`₹1,250,450.00`, `312`, `14 Low Stock`, `8 Pending`, `5 Planned`, `3 Approvals`, `₹892,100.00`).
3. Verified AI Quick Insights banner with live status narrative and active suggestion chips.
4. Verified Sales & Revenue trend chart and Order Status donut chart.
5. Verified 9-card Business Operations Overview grid with live badges and route links.
6. Verified Operational Activity Feed with interactive tabs (`Recent Sales`, `Sales Orders`, `Purchase Orders`, `Production Orders`, `Pending Approvals`).
7. Clicked AI suggestion chip `"Which products are running low on stock?"`, verified the AI Assistant drawer opened smoothly and returned a dynamic interactive chart, table, KPI, and link to `/inventory`.

---

## 9. Summary of Created & Modified Files

| File Path | Action | Description |
| :--- | :--- | :--- |
| `src/components/dashboard/BusinessOverviewGrid.tsx` | **Created** | 9-domain responsive module overview grid with real data, live/cached badges, and RBAC guards. |
| `src/components/dashboard/BusinessOverviewGrid.test.tsx` | **Created** | Comprehensive unit test suite covering module rendering, RBAC fallback, and route links. |
| `src/components/dashboard/AIQuickInsightsStrip.tsx` | **Created** | AI insight narrative strip with 6 clickable prompt chips wired to `useAIAssistant()`. |
| `src/components/dashboard/OperationalActivitySection.tsx` | **Created** | Tabbed activity feed for Recent Sales, Sales Orders, Purchase Orders, Production Orders, and Approvals. |
| `src/pages/Dashboard.tsx` | **Modified** | Rebuilt dashboard integrating 7 top KPIs, synchronized React Query hooks, and modular sections. |
| `src/index.css` | **Modified** | Added `@keyframes fadeInUp`, `.animate-fade-in-up`, `.dashboard-card-hover`, and reduced-motion rules. |
| `docs/ATLAS_DASHBOARD_OVERVIEW.md` | **Created** | Comprehensive architectural documentation, data dictionary, filter rules, and test results. |
