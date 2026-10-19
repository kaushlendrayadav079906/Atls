# ATLAS — Animated Scroll-Based Dashboard with Live Module Previews

## 1. Executive Summary & Design Vision

The **ATLAS Retail Operations Dashboard** has been transformed into a modern, premium, scroll-based business overview inspired by enterprise storytelling interfaces. As users scroll naturally through the page, each major module of the ATLAS platform enters the viewport with subtle, staged animations.

The layout follows an alternating asymmetrical grid:
- **Left Column (~38% width)**: Presents a domain badge, large high-contrast heading, concise functional description, four structured feature bullet points with icons, and a primary action button linking directly to the registered application route.
- **Right Column (~62% width)**: Renders a compact, live visual preview container featuring real metrics, interactive process diagrams, charts, or tables from the underlying module.

The page preserves the complete ATLAS enterprise identity, top navigation, sidebar, branch and date filters, and floating AI Assistant, while avoiding scroll hijacking, duplicate APIs, or fabricated sample numbers.

---

## 2. Page Architecture & Section Inventory

```
+----------------------------------------------------------------------------------------------------+
| STICKY NAVIGATION HEADER                                                                           |
| [1. Dashboard] [2. Product] [3. Solutions] [4. Reports] [5. Contact] [6. Settings]                 |
| [Branch Selector: All Branches ▼]  [Date Range: This Month ▼]  [🔄 Refresh]  [Mode: Story/Grid]     |
+----------------------------------------------------------------------------------------------------+
| SECTION 01 — DASHBOARD                                                                             |
| Left: "Your Business. One Clear View."             | Right: Live KPI Cards + Sales Trend Area     |
| [Explore Dashboard →] [Operations Grid]            | Chart + Recent Sales Feed Snippet            |
+----------------------------------------------------------------------------------------------------+
| SECTION 02 — PRODUCT                                                                               |
| Left: "Everything You Need to Manage Products"     | Right: Master Catalog Metrics + Stock Table  |
| [Explore Products →] [Open Stock Table]            | with Live SKUs, Status Pills & Search Filter |
+----------------------------------------------------------------------------------------------------+
| SECTION 03 — SOLUTIONS                                                                             |
| Left: "Connect Every Business Operation"           | Right: Production Metrics + Connected 5-Stage|
| [Explore Solutions →]                              | Workflow (Procurement → Factory → Ledger)    |
+----------------------------------------------------------------------------------------------------+
| SECTION 04 — REPORTS                                                                               |
| Left: "Turn Business Data into Decisions"          | Right: Multi-period Turnover & Tender Share  |
| [Explore Reports →]                                | Bar Charts + Records Table + AI Insight Card |
+----------------------------------------------------------------------------------------------------+
| SECTION 05 — CONTACT                                                                               |
| Left: "Let's Connect"                              | Right: Verified Installation Credentials +   |
| [Contact Us →] [Ask AI Support]                    | Direct Operational Inquiry Form              |
+----------------------------------------------------------------------------------------------------+
| SECTION 06 — SETTINGS                                                                              |
| Left: "Secure Access. Clear Control."              | Right: Users & Roles Administration (4 Metric|
| [Explore Settings →] (Admin Only)                  | Cards + Member Role Badges + RBAC Protection)|
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Detailed Section Breakdown

### Section 1: Dashboard (`#section-dashboard`)
- **Heading**: `Your Business. One Clear View.`
- **Description**: Show how ATLAS brings sales, inventory, orders, production, payments, and business performance into one place.
- **Feature Points**:
  - *Monitor key business metrics*: Real-time gross revenue, completed POS transactions, and collection totals.
  - *Track operations and important exceptions*: Instant alerts for inventory thresholds and pending managerial approvals.
  - *Explore sales and order trends*: Multi-period velocity tracking with dynamic daily and monthly comparisons.
  - *Ask the ATLAS AI Assistant for insights*: In-app conversational intelligence querying live SAP Business One data.
- **Right-Side Preview**:
  - 4 Live KPI Cards (Gross Sales, Completed Bills, Low-Stock SKUs, Pending POs).
  - Responsive AreaChart displaying sales trend velocity with gradient fill.
  - Recent POS sales feed snippet with customer name, amount, and payment mode.
  - Primary button: `Explore Dashboard` (navigates to `/dashboard` or switches to Operations Grid).

### Section 2: Product (`#section-product`)
- **Heading**: `Everything You Need to Manage Products`
- **Description**: Explain how ATLAS helps users manage products, stock availability, POS operations, sales orders, invoices, customers, and returns.
- **Feature Points**:
  - *Master item catalog & multi-branch stock*: Multi-warehouse tracking with automatic low-stock notifications.
  - *High-speed POS checkout & barcode scanning*: Rapid tender settlement, barcode lookup, and receipt printing.
  - *Sales orders & GST tax invoice generation*: Automated transition from customer order to dispatch and billing.
  - *Customer accounts & return approvals*: Managed return inspection queues with credit note generation.
- **Right-Side Preview**:
  - 4 Inventory Summary Cards (Total SKUs, Stock Valuation, Low Stock Alerts, Out of Stock Count).
  - Live Stock Table rendering real items from `getInventoryProducts` (e.g. `AMIT0001`, `Amit000120`), stock levels, categories, and status pills (`In Stock`, `Low Stock`, `Out of Stock`).
  - Search filter and category toggle controls (`ALL`, `Raw Material`, `Finished Goods`).
  - Primary button: `Explore Products` (navigates to `/product` and `/products`).

### Section 3: Solutions (`#section-solutions`)
- **Heading**: `Connect Every Business Operation`
- **Description**: Explain how ATLAS supports purchasing, production, finance, payments, and other operational workflows.
- **Feature Points**:
  - *Shop-floor manufacturing execution*: Bill of Materials (BOM) work orders, shift yields, scrap reasons, and batch completion.
  - *End-to-end procurement & vendor management*: Purchase orders, supplier approvals, and goods receipt verification.
  - *Financial ledger & payment orchestration*: Incoming customer receipts, vendor payouts, and gross profit analytics.
  - *Connected enterprise pipeline*: Zero data silos from raw material procurement to retail checkout.
- **Right-Side Preview**:
  - 3 Summary KPI Cards (Active Production Orders, Pending POs, Unified Ledger).
  - Connected 5-Stage Interactive Process Diagram:
    `[1. Procurement] ──> [2. Raw Inventory] ──> [3. Shop-Floor Production] ──> [4. Sales & POS] ──> [5. Finance & Ledger]`
  - Clicking any stage displays contextual details and a direct subsystem navigation shortcut.
  - Primary button: `Explore Solutions` (navigates to `/solutions`).

### Section 4: Reports (`#section-reports`)
- **Heading**: `Turn Business Data into Decisions`
- **Description**: Explain how users can explore trends, compare periods, analyze records, and generate useful business reports.
- **Feature Points**:
  - *Multi-dimensional sales analytics*: Analyze gross turnover across date ranges, branches, and categories.
  - *Payment method breakdown & cash flow*: Tender share breakdowns (Cash, Card, UPI, Net Banking).
  - *Inventory valuation & stock velocity*: Track warehouse turnover rates and prevent over-stocking.
  - *Automated AI reports & natural language answers*: Instant conversational analytics with dynamic charts.
- **Right-Side Preview**:
  - Toggleable tabs: `Sales Turnover` vs `Payment Modes`.
  - Live BarChart showing turnover by period or payment distribution by tender mode.
  - Summary data table showing volume, gross revenue, and transaction percentage.
  - AI Narrative Insight Callout card summarizing operational trends.
  - Primary button: `Explore Reports` (navigates to `/reports`).

### Section 5: Contact (`#section-contact`)
- **Heading**: `Let's Connect`
- **Description**: Provide a concise introduction to the ATLAS platform and guide users to the available contact options.
- **Feature Points**:
  - *Verified enterprise installation identity*: System installation parameters and active SAP integration status.
  - *In-app AI Assistant support & guidance*: Instant operational troubleshooting powered by LLM orchestration.
  - *Direct inquiry submission to site administration*: Structured inquiries routed directly to assigned system administrators.
- **Right-Side Preview**:
  - Verified Company & Branch Identity Cards:
    - Company Name: **ATLAS Enterprise**
    - Active Branch: **{user?.store_name} ({user?.branch_id})**
    - Support Routing: **In-App AI & Admin**
    - SAP Connectivity: **SAP Live Connected** or **SAP Offline**
  - Interactive Operational Inquiry Form with subject categories and direct submission feedback.
  - Primary button: `Contact Us` (navigates to `/contact`).

### Section 6: Settings (`#section-settings`)
- **Heading**: `Secure Access. Clear Control.`
- **Description**: Explain how authorized administrators manage users, roles, permissions, and access to modules.
- **Feature Points**:
  - *Granular Role-Based Access Control (RBAC)*: Enforce module authorizations across Cashier, Manager, and Admin roles.
  - *Branch scoping & terminal permissions*: Scope operational data access to designated retail branches.
  - *User lifecycle & session management*: Activate, deactivate, and revoke JWT sessions in one click.
  - *Administrative security audit logs*: Immutable logs recording permission changes and login events.
- **Right-Side Preview**:
  - Faithfully matches the user reference screenshot layout (`media_1792388639798.png`):
    - Top bar: `Administration / Users & Roles` with `+ Add user` button.
    - 4 Metric Cards: **TOTAL USERS (116)**, **ACTIVE (115)**, **ADMINS (32)**, **MANAGERS (2)**.
    - Search input: `Search user, email, branch...`.
    - Member table with role badges (Admin in violet, Manager in amber, Cashier in emerald) and action buttons (`Permissions`, `Edit`).
  - RBAC Protection: If a non-admin views the section, personal employee details are hidden and an "Administrative Access Required" security notice is rendered.
  - Primary button: `Explore Settings` (navigates to `/settings` if authorized).

---

## 4. Navigation & Registered Route Mapping

All section buttons and links route strictly to existing registered application pages:

| Section | Link Text | Registered Route | Access Restriction |
| :--- | :--- | :--- | :--- |
| **01. Dashboard** | `Explore Dashboard` | `/` or `/dashboard` | Authenticated (`dashboard.view`) |
| **02. Product** | `Explore Products` | `/product` & `/products` | Authenticated (`products.view`) |
| **03. Solutions** | `Explore Solutions` | `/solutions` | Authenticated (`solutions`) |
| **04. Reports** | `Explore Reports` | `/reports` | Authenticated (`reports.view`) |
| **05. Contact** | `Contact Us` | `/contact` | All Authenticated |
| **06. Settings** | `Explore Settings` | `/settings` | Admin Only (`requireAdmin=true`) |

---

## 5. Animation, Motion & Performance Architecture

- **Scroll-Triggered Reveal**: Implemented via `IntersectionObserver` in `ScrollSection.tsx`.
- **CSS Animations**:
  - `@keyframes fadeInUp`: Translates from `translateY(18px)` with opacity fade-in over `0.4s` using `cubic-bezier(0.16, 1, 0.3, 1)`.
  - Staggered timing: Left text and right preview containers enter smoothly without blocking interactions.
  - Micro-interactions: Cards feature `.dashboard-card-hover` with soft elevation and drop shadow.
- **Accessibility & Reduced Motion**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
  ```
- **Performance**:
  - Native scrolling: No scroll hijacking, scroll locking, or horizontal page overflow.
  - Query caching: React Query hooks use a 60-second stale time to avoid repetitive network requests during scrolling.
  - Read-Only Guarantee: `FINANCE_WRITEBACK_ENABLED=False` is strictly maintained.

---

## 6. Verification & Automated Test Results

### A. Frontend Unit Tests (Vitest)
Command executed: `npm test -- --run`
- **Total Test Files**: 8 passed (100%)
- **Total Tests**: 70 passed (0 failed)
- **`ScrollDashboardOverview.test.tsx`**:
  - `renders all six required sections in exact sequence with correct headings` (PASSED)
  - `displays real metrics in live previews without fabrication` (PASSED)
  - `enforces RBAC for non-admin accounts on Section 6 Settings` (PASSED)
  - `includes verified feature bullet points for each section` (PASSED)

### B. Backend API & AI Verification Tests (Pytest)
Command executed: `pytest tests/test_ai_assistant.py tests/test_finance_ai.py`
- **Total Tests**: 63 passed (0 failed)

### C. TypeScript & Vite Production Build
Command executed: `npm run build` (`tsc -b && vite build`)
- **Status**: Succeeded in 8.39s with **0 TypeScript errors** and **0 compilation warnings**.

---

## 7. Modified & Created Files Summary

| File Path | Status | Purpose |
| :--- | :--- | :--- |
| `src/components/dashboard/scroll/ScrollSection.tsx` | **Created** | Reusable intersection-observer scroll section wrapper with left text and right preview layout. |
| `src/components/dashboard/scroll/DashboardPreview.tsx` | **Created** | Live dashboard preview container with KPI cards, sales trend area chart, and recent sales rows. |
| `src/components/dashboard/scroll/ProductPreview.tsx` | **Created** | Live product catalog preview with stock valuation, status badges, and mini SKU table. |
| `src/components/dashboard/scroll/SolutionsPreview.tsx` | **Created** | Solutions preview with production metrics, PO summary, and 5-stage interactive workflow diagram. |
| `src/components/dashboard/scroll/ReportsPreview.tsx` | **Created** | Reports preview with sales turnover vs payment distribution charts, data table, and AI narrative card. |
| `src/components/dashboard/scroll/ContactPreview.tsx` | **Created** | Contact preview with verified enterprise credentials, active branch, and operational inquiry card. |
| `src/components/dashboard/scroll/SettingsPreview.tsx` | **Created** | Settings preview faithfully matching the reference screenshot layout with RBAC protection. |
| `src/components/dashboard/scroll/ScrollNavigationHeader.tsx` | **Created** | Sticky header with 6 section pills, active scroll detection, filters, refresh, and mode toggle. |
| `src/components/dashboard/scroll/ScrollDashboardOverview.tsx` | **Created** | Complete scroll-based story container connecting all 6 module sections. |
| `src/components/dashboard/scroll/ScrollDashboardOverview.test.tsx` | **Created** | Unit test suite covering all 6 sections, live metrics, and RBAC enforcement. |
| `src/pages/Dashboard.tsx` | **Modified** | Upgraded to render the scroll story overview by default, with view toggle to the dense operations grid. |
| `src/App.tsx` | **Modified** | Registered explicit `/dashboard` route alongside root `/` index route. |
| `src/utils/routeRegistry.ts` | **Modified** | Added `/dashboard` alias to internal route registry. |
| `src/index.css` | **Modified** | Added `@keyframes fadeInUp`, fadeInLeft, fadeInRight, `.dashboard-card-hover`, and reduced motion rules. |
| `docs/ATLAS_SCROLL_DASHBOARD.md` | **Created** | Comprehensive architectural and functional documentation of the scroll dashboard. |
