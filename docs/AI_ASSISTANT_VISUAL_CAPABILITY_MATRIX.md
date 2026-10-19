# ATLAS AI ASSISTANT — Visual Capability Matrix & Module Architecture

## Overview

The **ATLAS AI Assistant** is an enterprise-grade business intelligence and operational workflow assistant. It bridges natural-language requests with live SAP Business One Service Layer and local operational databases, delivering:
1. **Concise natural-language answers** derived deterministically from backend data.
2. **KPI cards and important metrics** with temporal growth and period comparisons.
3. **Interactive, verified process flowcharts** explaining business lifecycles and calculation methodologies.
4. **Dynamic data visualizations** (Bar, Line, Area, Horizontal Bar, Pie/Doughnut).
5. **Synchronized, sortable, and paginated data tables** with live CSV export.
6. **Grounded business insights** highlighting outliers, top performers, and inventory risks.
7. **Direct, clickable deep-links** to verified ATLAS dashboard modules.

---

## 1. Unified Visual Workspace [Overview | Chart | Results | Flowchart | Both]

Each analytical query dynamically activates the relevant visual tabs based on the available dataset:

| Workspace Tab | Content Description | Activation Condition |
| :--- | :--- | :--- |
| **Overview** | Executive business summary, KPI metric cards grid, grounded insights with recommendations, and flowchart preview links. | Active for all queries with summary, metrics, or insights. |
| **Chart** | Responsive, interactive Recharts visualization (Bar, Line, Area, Pie, or Horizontal Bar) with currency tooltips, grid, and legends. | Active when numerical series and dimension keys exist. |
| **Results** | Sortable, searchable, and paginated table (8 rows/page) with column formatting (INR, %, Date, Number, Delta) and CSV export. | Active when table records exist. |
| **Flowchart** | Step-by-step verified business process diagram with node badges (SAP OINV, OITW, etc.), decision branches, and deep-link buttons. | Active when module workflow process definition exists. |
| **Both** | Unified view with interactive visualization on top and matching detailed data table directly underneath. | Active when chart config and table rows exist simultaneously. |

---

## 2. Complete Module Capability Matrix

### A. Dashboard & Executive Intelligence
- **Module ID**: `dashboard`
- **Supported Question Types**:
  - "Show today's sales summary"
  - "Compare this month with last month"
  - "Show overall operational dashboard KPIs"
  - "How is dashboard business intelligence aggregated?"
- **Data Sources**: SAP Service Layer `Invoices` (`OINV`), `Orders` (`ORDR`), `Inventory` (`OITW`), Approval Service.
- **Chart Types**: Bar chart, Line comparison, KPI metric cards (Total Billed, Invoice Count, Avg Ticket, Period Growth, Low Stock Count).
- **Flowchart ID**: `dashboard_bi_flow` ("Executive Dashboard Business Intelligence Pipeline")
  - Steps: Operational Activity Capture &rarr; SAP Service Layer Crossjoin &rarr; Role & Branch Scope Filter &rarr; Temporal Bucketing &rarr; In-Memory Cache (TTL: 120s) &rarr; Interactive Workspace UI.
- **Required Permission**: `dashboard.view`
- **Application Route**: `/` (`Open Dashboard`)

---

### B. Product & Inventory Management
- **Module ID**: `inventory` / `products`
- **Supported Question Types**:
  - "Which products are running low on stock?"
  - "Show stock for item AMIT000121 in Sahibabad"
  - "Rank products by sales amount vs quantity sold"
  - "Explain the inventory stock replenishment process"
- **Data Sources**: SAP Service Layer `Items` (`OITM`), `ItemWarehouseInfoCollection` (`OITW`), `Invoices` line items.
- **Chart Types**: Horizontal bar chart (Top Products ranking), Item stock comparison, Low stock alert badges.
- **Flowchart ID**: `inventory_stock_replenishment_flow` ("Inventory Stock Replenishment & Fulfillment Workflow")
  - Steps: Purchase Order / Receipt (OPDN) &rarr; Warehouse Stock Inward (OITW) &rarr; Reorder Point Evaluation &rarr; Sales Allocation / Dispatch &rarr; Inventory Movement Audit.
- **Required Permission**: `products.view`
- **Application Route**: `/products` (`Open Products Catalog`)

---

### C. Point of Sale (POS) & Sales Operations
- **Module ID**: `sales_pos` / `pos`
- **Supported Question Types**:
  - "Show today's POS sales summary"
  - "Compare sales by branch for this week"
  - "How does checkout and order-to-cash work in ATLAS?"
  - "Show top selling items at Sahibabad"
- **Data Sources**: POS Terminal transactions, SAP `Invoices` (`OINV`), `DocumentLines`.
- **Chart Types**: Vertical bar chart by branch, Daily sales line trend, Category breakdown pie chart.
- **Flowchart ID**: `sales_order_to_cash_flow` ("Order-to-Cash & Real-Time Invoicing Workflow")
  - Steps: Customer Cart Creation &rarr; Stock Availability Validation (OITW) &rarr; Payment Settlement &rarr; AR Invoice & Fiscal Posting (OINV) &rarr; Real-Time Inventory Deduction.
- **Required Permission**: `pos.access` / `dashboard.view`
- **Application Route**: `/pos` (`Open Point of Sale`)

---

### D. Sales Invoices, Approvals & Returns
- **Module ID**: `invoices_returns` / `sales` / `returns`
- **Supported Question Types**:
  - "Show recent sales invoices for this month"
  - "Show pending returns and manager approvals"
  - "What is the return and refund workflow in ATLAS?"
  - "Filter open vs paid invoices"
- **Data Sources**: SAP `Invoices` (`OINV`), `Returns` (`ORDN`), `ApprovalRequests` table.
- **Chart Types**: Status breakdown bar chart, Invoice value distribution, Return rate trend.
- **Flowchart ID**: `returns_and_credit_notes_flow` ("Sales Return, Approval & Credit Note Lifecycle")
  - Steps: Customer Return Request &rarr; Inspection & Defect Verification &rarr; Manager Authorization Gatekeeper &rarr; SAP Credit Note Generation (ORIN) &rarr; Customer Refund / Exchange.
- **Required Permission**: `invoices.view` / `returns.view`
- **Application Routes**: `/sales` (`Open Sales Invoices`), `/returns` (`Open Returns & Approvals`)

---

### E. Purchasing & Procurement (PO & Invoices)
- **Module ID**: `purchasing` / `purchase_orders`
- **Supported Question Types**:
  - "Show pending purchase orders"
  - "Show recent purchase invoices by supplier"
  - "Explain the procure-to-pay workflow"
  - "Compare purchase trends across last 6 months"
- **Data Sources**: SAP Service Layer `PurchaseOrders` (`OPOR`), `PurchaseInvoices` (`OPCH`), `BusinessPartners` (`OCRD`).
- **Chart Types**: Bar chart of POs by vendor, Monthly purchase spend line chart.
- **Flowchart ID**: `procure_to_pay_flow` ("Procure-to-Pay & Vendor Settlement Workflow")
  - Steps: Purchase Order Creation (OPOR) &rarr; Goods Receipt PO (OPDN) &rarr; AP Invoice Matching (OPCH) &rarr; Three-Way Reconciliation &rarr; Outgoing Vendor Payment.
- **Required Permission**: `purchase_orders.view` / `finance.invoices.view`
- **Application Routes**: `/purchase-orders` (`Open Purchase Orders`), `/finance/purchase-invoices` (`Purchase Invoices`)

---

### F. Customers & Suppliers (Accounts Directory)
- **Module ID**: `customers` / `suppliers`
- **Supported Question Types**:
  - "Search customer by name or mobile number"
  - "Which customers have the highest sales volume?"
  - "Show supplier ranking by purchase spend"
  - "How are customer credit limits and receivables handled?"
- **Data Sources**: SAP Service Layer `BusinessPartners` (`OCRD`), `Invoices` (`OINV`).
- **Chart Types**: Horizontal bar chart of top customers, Pie chart of customer category distribution.
- **Flowchart ID**: `customer_account_lifecycle_flow` ("Customer Account & Credit Management Workflow")
  - Steps: Customer Onboarding (OCRD) &rarr; Credit Limit Evaluation &rarr; Order Placement & Billing &rarr; Receivables Aging Tracking &rarr; Collection & Reconciliation.
- **Required Permission**: `customers.view` / `finance.view`
- **Application Route**: `/customers` (`View Customers Directory`)

---

### G. Incoming & Outgoing Payments
- **Module ID**: `payments` / `finance_payments`
- **Supported Question Types**:
  - "Show payment breakdown by method (Cash, Card, UPI)"
  - "Show incoming payments for this month"
  - "Explain how payments clear customer invoices"
  - "Compare cash vs digital collections"
- **Data Sources**: SAP `IncomingPayments` (`ORCT`), `VendorPayments` (`OVPM`), Payment receipt ledger.
- **Chart Types**: Donut/Pie chart of payment tender split, Daily collections line graph, Stacked method comparison.
- **Flowchart ID**: `payment_clearing_reconciliation_flow` ("Payment Clearing & Bank Reconciliation Lifecycle")
  - Steps: Payment Receipt Capture &rarr; Tender Method Validation &rarr; SAP Document Allocation (ORCT) &rarr; Bank Account Ledger Clearing &rarr; Receipt Generation.
- **Required Permission**: `finance.payments.view` / `reports.view`
- **Application Routes**: `/finance/incoming-payments`, `/finance/outgoing-payments`, `/reports/payment`

---

### H. Production & Manufacturing Operations
- **Module ID**: `production`
- **Sub-pages Covered**:
  1. Production Overview (`/production`)
  2. Production Orders (`/production/orders`)
  3. Item-wise Production (`/production/item-wise`)
  4. Production Rejection (`/production/rejection`)
  5. Date-wise Production (`/production/date-wise`)
  6. Production Reports (`/production/reports`)
- **Supported Question Types**:
  - "Show pending production orders"
  - "Create a report showing production rejection by item"
  - "Explain the manufacturing and scrap rejection process"
  - "Show planned vs produced quantity across work orders"
- **Data Sources**: SAP `ProductionOrders` (`OWOR`), Production Issue/Receipt documents.
- **Chart Types**: Horizontal bar chart of scrap/rejection rates (%), Planned vs Actual output bar chart, Date-wise trend line.
- **Flowchart ID**: `manufacturing_and_scrap_flow` ("Production Order & Scrap Rejection Process")
  - Steps: Production Order Issuance (OWOR) &rarr; Bill of Materials (BOM) Allocation &rarr; Shop-floor Assembly & QA &rarr; Scrap / Rejection Inspection &rarr; Finished Goods Receipt & Close.
- **Required Permission**: `production.view` / `production.orders.view` / `production.reports.view`
- **Application Routes**: `/production`, `/production/orders`, `/production/rejection`, `/production/reports`

---

### I. Finance & Profitability Analytics
- **Module ID**: `finance` / `finance_overview`
- **Supported Question Types**:
  - "Show finance overview KPIs"
  - "Compare sales and purchases for the past 6 months"
  - "Show gross profit margin and profitability trend"
  - "Explain the gross profit calculation methodology"
- **Data Sources**: SAP `Invoices` (`OINV`), `PurchaseInvoices` (`OPCH`), Cost of Goods calculation pipeline.
- **Chart Types**: Dual-series Sales vs Purchases line chart, 3-series Gross Profit bar chart, Financial KPI cards grid.
- **Flowchart ID**: `finance_profitability_calculation_flow` ("GAAP Financial Performance & Profitability Pipeline")
  - Steps: Fiscal Sales Invoices (Net Revenue) &rarr; Matched Purchase Invoices (COGS) &rarr; Gross Margin Derivation (`Revenue - Cost`) &rarr; Tax Reconciliations (GST/VAT) &rarr; Management Financial P&L.
- **Business Integrity Constraint**: Profitability calculations require verified cost and revenue records. Does not report estimated profit when COGS is incomplete.
- **Required Permission**: `finance.view` / `finance.reports.view`
- **Application Routes**: `/finance`, `/finance/profitability-reports`

---

### J. Reports Hub & AI Generated Reports
- **Module ID**: `reports` / `reports_ai`
- **Supported Question Types**:
  - "Show all available reports"
  - "Open AI Generated Reports"
  - "Show sales report for the last quarter"
  - "Explain how reports are generated and exported"
- **Data Sources**: Multi-service SAP cross-reporting engine, cached aggregation layers.
- **Chart Types**: Multi-axis reports, tabular summaries, exportable CSV tables.
- **Flowchart ID**: `reports_bi_generation_flow` ("Business Intelligence & Multi-Dimension Reporting Engine")
  - Steps: User Filter Definition &rarr; Multi-Service Query Extraction &rarr; Statistical Aggregation &rarr; Visualization Encoding &rarr; Client Export (CSV/PDF).
- **Required Permission**: `reports.view`
- **Application Routes**: `/reports`, `/reports/sales`, `/reports/invoice`, `/reports/payment`, `/reports/ai`

---

### K. Settings, RBAC & Permission Intelligence
- **Module ID**: `settings_rbac` / `settings`
- **Supported Question Types**:
  - "What can I access with my current permissions?"
  - "Which employees can edit products or approve returns?"
  - "Explain how user permission assignment works"
  - "Show settings and administrative roles"
- **Data Sources**: User management database (`users`, `permissions`), `DEFAULT_ROLE_PERMISSIONS`, session token claims.
- **Chart Types**: Permission matrix breakdown, Role distribution summary table.
- **Flowchart ID**: `rbac_security_authorization_flow` ("User Authentication & Role-Based Access Control (RBAC)")
  - Steps: JWT Authentication &rarr; Role Extraction (`Admin`, `Manager`, `Cashier`) &rarr; Granular Permission Gatekeeper &rarr; Branch Warehouse Scoping &rarr; Protected Endpoint Access.
- **Security Constraint**: Non-administrators cannot view other users' confidential accounts. The AI assistant never modifies roles or permissions via chat.
- **Required Permission**: `users.manage` (for inspecting other users); None (for self-service `get_my_permissions`).
- **Application Route**: `/settings` (`Open Settings & Roles`)

---

## 3. Security, Grounding & Integrity Rules

1. **Strictly Read-Only Operations**:
   `FINANCE_WRITEBACK_ENABLED=False` is strictly maintained. The assistant queries live records but never executes direct mutations or writebacks without explicit administrative workflow confirmation.
2. **Deterministic Calculations**:
   All metrics, averages, totals, and percentages are computed deterministically in backend Python services using exact mathematical routines. The LLM is never allowed to invent numerical values.
3. **No Dynamic Execution of Arbitrary Code**:
   Process flowcharts are rendered using strictly typed JSON node-and-edge schemas (`FlowchartData`). No arbitrary HTML, SVG scripts, or raw Mermaid execution strings are evaluated.
4. **Tenant and Warehouse Branch Isolation**:
   Branch managers and cashiers are strictly confined to their assigned warehouse scope (`permitted_warehouse`). Only administrators can query aggregated cross-branch records.
5. **Clear Offline States**:
   If the SAP Service Layer is offline or disconnected, the system produces a structured `sap_offline` response card. Outages are never reported as "zero sales" or "zero inventory".

---

## 4. Test Coverage Verification

| Test Suite | File Path | Total Tests | Pass Rate | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Backend AI Assistant** | `pos-backend/tests/test_ai_assistant.py` | 44 tests | 100% | **PASSED** |
| **Backend Finance Assistant** | `pos-backend/tests/test_finance_ai.py` | 18 tests | 100% | **PASSED** |
| **Frontend Visual Components** | `Dashboard-Ui/src/components/BusinessFlowchartRenderer.test.tsx` | 3 tests | 100% | **PASSED** |
| **Frontend Workspace Integration** | `Dashboard-Ui/src/components/RichTableChartRenderer.test.tsx` | 25 tests | 100% | **PASSED** |
| **Frontend Layout & Navigation** | `Dashboard-Ui/src/components/LayoutNavigation.test.tsx` | 6 tests | 100% | **PASSED** |
| **Frontend RBAC & Modals** | `Dashboard-Ui/src/components/PermissionMatrixModal.test.tsx` | 4 tests | 100% | **PASSED** |
| **Frontend Guard Component** | `Dashboard-Ui/src/components/RequirePermission.test.tsx` | 5 tests | 100% | **PASSED** |
| **Frontend Production Build** | `Dashboard-Ui/` (`tsc -b && vite build`) | Full Bundle | 100% | **PASSED** |

**Total Automated Tests**: **62 Backend Tests** + **61 Frontend Tests** = **123 Passing Tests**.
