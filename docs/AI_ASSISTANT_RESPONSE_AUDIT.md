# ATLAS AI Assistant — Response Engine & Architecture Audit

This audit evaluates the end-to-end request-to-response lifecycle of the ATLAS AI Assistant, analyzing the existing UI chat renderers, backend orchestration services, natural-language understanding, data sources (real vs. fallback), and interactive visualization capabilities.

---

## 1. End-to-End Request-to-Response Flow

```
[User Input in Chat Panel / Bubble]
                 │
                 ▼
[Frontend: AIAssistantContext.tsx & AIAssistantPanel.tsx]
   - Captures user message & active pageContext (e.g. dashboard, products, finance)
   - Dispatches POST /api/v1/ai-assistant/chat
   - Payload: { message, branch_id, conversation_id, context, history }
                 │
                 ▼
[Backend API: app/api/v1/ai_assistant.py]
   - Validates authentication token & user identity
   - Injects user permissions & role
   - Forwards to AIAssistantService.process_chat()
                 │
                 ▼
[NLP Intelligence Pipeline: app/core/nlp_pipeline.py]
   - Expands business acronyms (PO, SO, AR, AP, WIP, SKU)
   - Resolves temporal phrases ("today", "this month", "last month", "past 6 months")
   - Classifies business intent and matches to Central Capability Registry
   - Resolves conversational follow-ups ("Compare with last month", "Only for this branch")
                 │
                 ▼
[Backend Orchestrator: app/services/ai_service.py]
   - Re-validates user RBAC against TOOL_PERMISSIONS
   - Enforces branch assignment boundaries (_get_permitted_branch)
   - Executes registered deterministic backend tool
                 │
                 ▼
[Authorized Backend Services: SAP B1 Service Layer / PostgreSQL]
   - Queries real SAP Service Layer (OINV, ORDR, OPOR, OWOR, OITM, OCRD, etc.)
   - Realizes deterministic aggregates (sums, counts, averages, variances)
   - Rejects unverified calculations; handles SAP offline with explicit status
                 │
                 ▼
[Structured Response Formatting: app/models/schemas.py]
   - Constructs StructuredTableResponse / card schemas
   - Generates Recharts configurations (bar, line, horizontal_bar, pie)
   - Synthesizes LLM natural-language explanation grounded strictly on data
   - Appends contextual suggested follow-ups & internal React Router links
                 │
                 ▼
[Frontend Renderers: AIChatRenderer.tsx & RichTableChartRenderer.tsx]
   - Renders message bubble with FormattedMessage
   - Renders Interactive Result Workspace: Chart | Results | Both tabs
   - Renders interactive sorting, pagination, and filter badges
   - Displays one-click contextual follow-up chips and deep-links
```

---

## 2. Audit of Existing Data Sources: Real vs. Fallback / Mock

| Module / Capability | Data Source | Service Method | Status | Real Data Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Sales Revenue & KPIs** | SAP Service Layer `OINV` | `SAPInvoicesService.get_invoices_by_date` | Real Data | Live SAP invoice documents aggregated by date & branch. |
| **Sales Orders** | SAP Service Layer `ORDR` | `SAPSalesOrdersService.list_sales_orders` | Real Data | Open, closed, and cancelled customer commitments. |
| **Sales Invoices (AR)** | SAP Service Layer `OINV` | `SAPFinanceService.get_sales_invoices` | Real Data | Billed tax invoices with customer codes and totals. |
| **Purchase Orders (PO)** | SAP Service Layer `OPOR` | `SAPPurchaseOrdersService.list_purchase_orders` | Real Data | Supplier procurement orders and status. |
| **Purchase Invoices (AP)** | SAP Service Layer `OPCH` | `SAPFinanceService.get_purchase_invoices` | Real Data | Vendor invoices, payment terms, and totals. |
| **Warehouse Stock & SKU** | SAP Service Layer `OITM`/`OITW` | `SAPInventoryService.get_stock_levels` | Real Data | On-hand quantity per warehouse from SAP items master. |
| **Low-Stock Shortages** | SAP Service Layer `OITW` | `SAPInventoryService.get_low_stock_items` | Real Data | On-hand vs. minimum reorder threshold. |
| **Top Selling Products** | SAP Service Layer `OINV` lines | `SAPInvoicesService.get_recent_invoices_with_lines` | Real Data | Document lines aggregated by `ItemCode`, quantity, and revenue. |
| **Customer Sales Ranking** | SAP Service Layer `OINV` | `SAPFinanceService.get_customer_sales_ranking` | Real Data | Ranked by net invoice amount per customer `CardCode`. |
| **Accounts Receivable** | SAP Service Layer `OCRD` | `SAPFinanceService.get_accounts_receivable` | Real Data | Real-time outstanding customer debit balances. |
| **Sales Returns** | PostgreSQL `sales_returns` | `SAPReturnsService.get_returns_by_date` | Real Data | Customer credit notes, refund requests, and inspection status. |
| **Production Orders** | SAP Service Layer `OWOR` | `SAPProductionService.get_production_orders` | Real Data | Planned, released, and closed shop-floor orders. |
| **Production Rejection** | SAP Service Layer `OWOR` lines | `SAPProductionService.get_rejection_summary` | Real Data | Scrapped/rejected quantities and scrap percentage per item. |
| **Finance Overview** | SAP Service Layer `OINV`/`ORCT` | `SAPFinanceService.get_finance_summary` | Real Data | Net sales vs. cash collections. |
| **Admin User Intelligence** | PostgreSQL `users` table | `get_all_users`, `get_user_by_username` | Real Data | Restricted to `users.manage`; password hashes stripped. |
| **My Permissions** | User session / JWT claims | `get_my_permissions` | Real Data | Effective role, permitted modules, and branch scope. |
| **Available Reports** | Central Route Directory | `get_available_reports` | Real Data | Catalog of 11 system reports with route deep-links. |
| **SAP Disconnected State** | Error Handler | `SAPConnectionError` catch block | Clean Status | Returns explicit `sap_offline` error card; never fake zeros. |

---

## 3. UI Component Audit & Reference Alignment

### Reference 1 vs. Current ATLAS UI
- **Reference 1 features**: Top-products table, performance metrics table, clickable product catalog link, suggested next steps.
- **Current state**: `AIChatRenderer` had a basic static table for `top_products` without chart tabs or direct catalog action button.
- **Upgrade**: Transform `top_products` into an interactive workspace with Chart | Results | Both tabs, horizontal bar chart, ranked table, catalog link (`/products`), and contextual follow-ups.

### Reference 2 vs. Current ATLAS UI
- **Reference 2 features**: Prominent **Chart | Results | Both** tabs, interactive filter badges, visual graph with tooltips, synchronized underlying table, responsive conversation panel.
- **Current state**: `RichTableChartRenderer` has the three-tab switcher, but lacked column sorting, pagination controls, and horizontal bar layout for ranking metrics.
- **Upgrade**: Add interactive column sorting, client-side pagination (5/10/25 rows), horizontal bar charts for rankings, CSV export/copy button, and filter chip displays.

---

## 4. Capability-by-Capability Response Engine Plan

| Category | Query Examples | Engine Selection & Format | Visualization | Action & Navigation |
| :--- | :--- | :--- | :--- | :--- |
| **A. Simple Questions** | *"What is a purchase invoice?"*, *"Explain difference between sales & payments."* | Short conversational explanation grounded in business rules. No forced charts. | None (Clean typography) | Optional link to relevant page (e.g. `/finance/purchase-invoices`). |
| **B. KPI & Summary** | *"Show today's sales."*, *"Current performance"* | Total sales amount (INR), invoice count, avg order value, growth %, low-stock count. | Executive KPI Card Grid | Link to Dashboard (`/`) or Sales Reports (`/reports/sales`). |
| **C. Ranking** | *"Show top five products by sales."*, *"Top customers"* | Deterministic ranking by revenue or quantity with item name, SKU, and amounts. | **Chart \| Results \| Both** with Horizontal Bar Chart & Ranked Table | Clickable "Open Products Catalog" button (`/products`). |
| **D. Trend Analysis** | *"Show sales trends over last 6 months."* | Multi-period trend, monthly breakdown, notable increases/decreases. | **Chart \| Results \| Both** with Recharts Line / Area Chart | Link to Sales Reports (`/reports/sales`). |
| **E. Period Comparison** | *"Compare this month with last month."* | Current vs. previous period values, absolute delta (₹), variance %. Safe formula: handles zero previous without fake 100%. | Comparison Bar / Line Chart + Variance Table | Link to Sales Reports with comparison range. |
| **F. Operations & Exceptions** | *"Which products are running low on stock?"*, *"Show pending production orders."* | Filtered real-time inventory below reorder level, open work orders. | Filtered interactive table with status badges & alerts | Link to Products (`/products`) or Production (`/production/orders`). |
| **G. Settings & Permissions** | *"What can I access with my permissions?"*, *"Which employees can edit products?"* | Effective user permissions or administrative role query (Admin only; hashes excluded). | Permissions / User Inspection Card | Link to Users & Roles (`/settings`). |
| **H. Smart Navigation** | *"Open Production Reports"*, *"Go to Purchase Invoices"* | React Router path resolution, permission verification, state preservation. | Navigation Action Card with one-click button | Direct deep-link to destination route. |
