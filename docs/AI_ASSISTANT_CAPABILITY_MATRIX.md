# ATLAS AI Assistant — Capability Matrix & Verification Specification

This document provides a comprehensive verification matrix for the upgraded ATLAS AI Business Assistant, detailing every supported natural language intent, required parameters, backend data source, RBAC authorization, internal application route, implementation status, and automated test coverage.

---

## 1. Executive Summary & Architecture Overview

The ATLAS AI Assistant has been upgraded from a conversational POS bot into an enterprise-grade **AI Business Assistant** operating across all dashboard modules. The assistant operates under strict safety and architectural guidelines:
1. **Deterministic Business Calculations**: LLM does not hallucinate numbers or calculate totals internally. All metrics are aggregated deterministically by authorized backend services (SAP Business One Service Layer and PostgreSQL).
2. **Strict RBAC & Branch Isolation**: Administrators have full multi-branch scope and user-management query access; standard employees are isolated to their permitted branch and cannot query administrative credentials or other users' profiles.
3. **Zero Write-Back Policy (`FINANCE_WRITEBACK_ENABLED=False`)**: The assistant is strictly read-only for operational data. Write operations are blocked at the schema and handler layers.
4. **Internal Navigation**: Deep-linking uses the authenticated React Router registry (`routeRegistry.ts`) without hardcoding external links or breaking conversation state.
5. **Rich Interactive Responses**: Visual rendering supports KPI summaries, paginated tables, interactive Recharts charts (bar, line), permission cards, user-management inspection cards, report catalog cards, and contextual suggested next steps.

---

## 2. Full Capability Matrix

| Capability ID | Module | Supported Natural-Language Intents | Required / Extracted Parameters | Authorized Backend Tool | Required Permission | Destination Route | Data Source & Freshness | Implementation Status | Automated Test Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`dashboard.kpis`** | Dashboard | • "Show me today's sales."<br>• "Sales today"<br>• "Today's revenue"<br>• "How much did we sell today"<br>• "Sales this week"<br>• "Sales this month"<br>• "Executive overview" | `range` (`today`, `yesterday`, `week`, `month`, `last_month`), `branch`, `date_from`, `date_to` | `get_dashboard_summary` | `dashboard.view` | `/` | Real-time SAP Service Layer / SQL aggregate cache | ✅ Complete | `tests/test_ai_assistant.py` (`test_process_chat_success`, `test_chat_supported_business_data_question`, `test_analytical_table_weekly_sales_by_branch`, `test_nlp_pipeline_intent_recognition`) |
| **`dashboard.sales_trend`** | Dashboard | • "Compare this month's sales with last month."<br>• "Sales trend"<br>• "Revenue trend"<br>• "Monthly sales"<br>• "Past 6 months sales"<br>• "Sales breakdown" | `metric` ("sales"), `group_by` ("comparison", "month", "branch"), `range` ("compare_last_month", "past_6_months"), `branch` | `get_analytical_table` | `dashboard.view` | `/` | SAP Service Layer monthly / weekly invoice aggregates | ✅ Complete | `tests/test_ai_assistant.py` (`test_nlp_pipeline_intent_recognition`, `test_nlp_pipeline_contextual_follow_ups`, `test_analytical_table_comparison_this_month_vs_last_month`, `test_analytical_table_past_6_months_monthly_revenue`) |
| **`inventory.stock_levels`** | Products | • "Check stock"<br>• "Stock of item"<br>• "How much stock do we have"<br>• "Warehouse stock"<br>• "Lookup SKU ITM-001" | `item_code` (optional), `warehouse` (branch-scoped) | `get_inventory_stock` | `products.view` | `/products` | Real-time SAP Service Layer `OITM` / `OITW` | ✅ Complete | `tests/test_ai_assistant.py` (`test_process_chat_inventory_stock`, `test_chat_product_sku_resolution_and_navigation`) |
| **`inventory.low_stock`** | Products | • "Which products are running low on stock?"<br>• "Low stock"<br>• "Shortage items"<br>• "Products below reorder level"<br>• "Out of stock items" | `low_stock_only=True`, `warehouse` | `get_inventory_stock` | `products.view` | `/products` | SAP Service Layer item stock vs. min order level | ✅ Complete | `tests/test_ai_assistant.py` (`test_nlp_pipeline_intent_recognition`, `test_process_chat_inventory_stock`) |
| **`inventory.top_products`** | Products | • "Show me the top five products by sales."<br>• "Top selling products"<br>• "Best sellers"<br>• "Compare their quantity sold"<br>• "Fast moving items" | `limit` (default 5 or 10), `ranking_by` ("sales_amount", "quantity"), `range`, `branch` | `get_products` | `products.view` | `/products` | Real-time SAP invoice velocity crossjoin / ranking | ✅ Complete | `tests/test_ai_assistant.py` (`test_process_chat_get_products`, `test_get_products_quantity_vs_sales_ranking`, `test_nlp_top_products_ranking_follow_up`), `src/components/RichTableChartRenderer.test.tsx` |
| **`sales.orders`** | Sales Orders | • "Show pending sales orders."<br>• "Pending sales orders"<br>• "Open customer orders"<br>• "Sales backlog" | `status` ("pending", "open", "released"), `branch`, `limit` | `get_sales_orders` | `sales.orders.view` | `/sales-orders` | SAP Service Layer `ORDR` | ✅ Complete | `tests/test_ai_assistant.py` (`test_nlp_pipeline_intent_recognition`) |
| **`sales.invoices`** | Sales Invoices | • "Show sales invoices"<br>• "Recent invoices"<br>• "Tax invoices for branch"<br>• "Billed revenue" | `doc_num`, `customer_code`, `date_from`, `date_to`, `branch`, `limit` | `get_sales_invoices` | `sales.invoices.view` | `/sales-invoices` | SAP Service Layer `OINV` | ✅ Complete | `tests/test_ai_assistant.py` (`test_process_chat_sales_invoices`, `test_process_chat_sales_invoices_partial`) |
| **`purchasing.orders`** | Purchase Orders | • "Show purchase orders"<br>• "Supplier purchase orders"<br>• "Open POs"<br>• "Procurement orders" | `doc_num`, `supplier_code`, `date_from`, `date_to`, `status` | `get_purchase_orders` | `purchasing.orders.view` | `/purchase-orders` | SAP Service Layer `OPOR` | ✅ Complete | `tests/test_ai_assistant.py` (`test_nlp_pipeline_intent_recognition`) |
| **`customers.ranking`** | Customers | • "Find the customer with the highest sales."<br>• "Top customers"<br>• "Highest revenue clients"<br>• "Customer sales ranking" | `limit` (default 10), `range`, `branch` | `get_customer_sales_ranking` | `customers.view` | `/finance/customer-analysis` | SAP Service Layer `OINV` aggregated by `CardCode` | ✅ Complete | `tests/test_finance_ai.py` (`test_execute_customer_sales_ranking`), `tests/test_ai_assistant.py` (`test_nlp_pipeline_intent_recognition`) |
| **`customers.receivables`** | Customers / Finance | • "Which customers have outstanding balances?"<br>• "Unpaid balances"<br>• "Who owes us money"<br>• "Accounts receivable" | `min_balance`, `branch`, `limit` | `get_accounts_receivable` | `finance.view` | `/finance` | SAP Service Layer `OCRD` customer balances | ✅ Complete | `tests/test_finance_ai.py` (`test_execute_accounts_receivable`), `tests/test_ai_assistant.py` (`test_nlp_pipeline_intent_recognition`) |
| **`finance.purchase_invoices`** | Finance / AP | • "Show purchase invoices for this supplier."<br>• "AP purchase invoices"<br>• "Supplier invoices"<br>• "Vendor bills" | `supplier_code`, `date_from`, `date_to`, `branch`, `limit` | `get_purchase_invoices` | `purchasing.invoices.view` | `/finance/purchase-invoices` | SAP Service Layer `OPCH` | ✅ Complete | `tests/test_finance_ai.py` (`test_finance_tools_registered_in_schema`), `tests/test_ai_assistant.py` (`test_nlp_pipeline_intent_recognition`) |
| **`sales.returns`** | Returns | • "Show returns"<br>• "Pending return approvals"<br>• "Damaged stock returns"<br>• "Credit notes" | `status`, `branch`, `limit` | `get_sales_returns` | `returns.view` | `/returns` | PostgreSQL `sales_returns` table | ✅ Complete | `tests/test_ai_assistant.py` (`test_process_chat_sales_returns`) |
| **`production.overview`** | Production | • "Production overview"<br>• "Factory output summary"<br>• "Manufacturing status"<br>• "Production summary" | `range`, `branch`, `date_from`, `date_to` | `get_production_orders` / `SAPProductionService.get_production_summary` | `production.view` | `/production` | SAP Service Layer `OWOR` | ✅ Complete | `tests/test_ai_assistant.py` (`test_process_chat_with_tool_call`) |
| **`production.orders`** | Production | • "Show pending production orders."<br>• "Work in progress"<br>• "Planned batches"<br>• "Production orders list" | `status` ("Planned", "Released"), `doc_num`, `item_code`, `date_from`, `date_to`, `branch` | `get_production_orders` | `production.view` | `/production/orders` | SAP Service Layer `OWOR` | ✅ Complete | `tests/test_ai_assistant.py` (`test_process_chat_with_tool_call`, `test_nlp_pipeline_intent_recognition`) |
| **`production.rejection`** | Production | • "Create a report showing production rejection by item."<br>• "Production rejection"<br>• "Production wastage"<br>• "Scrap rate by item" | `date_from`, `date_to`, `branch`, `item_code` | `get_analytical_table(metric="production_rejection")` | `production.view` | `/production/rejection` | SAP Service Layer production orders planned vs rejected item lines | ✅ Complete | `tests/test_ai_assistant.py` (`test_analytical_table_production_rejection`, `test_nlp_pipeline_intent_recognition`) |
| **`finance.overview`** | Finance | • "Finance overview"<br>• "Financial health"<br>• "Cash flow summary"<br>• "Explain the difference between sales and incoming payments." | `range`, `branch` | `get_finance_summary` | `finance.view` | `/finance` | SAP Service Layer `OINV` & `ORCT` cash collections | ✅ Complete | `tests/test_finance_ai.py` (`test_execute_finance_summary`) |
| **`finance.profitability`** | Finance | • "Why did profit decrease this month?"<br>• "Profitability report"<br>• "Gross profit analysis"<br>• "Product margin breakdown" | `range` ("compare_last_month", "month"), `branch` | `get_profitability_report` | `finance.view` | `/finance/profitability-reports` | Deterministic cost of goods sold (COGS) vs revenue aggregate | ✅ Complete | `tests/test_finance_ai.py` (`test_execute_profitability_report`) |
| **`reports.catalog`** | Reports | • "Show me all available reports."<br>• "Available reports"<br>• "What reports can I generate?"<br>• "Report catalog" | `category` (optional) | `get_available_reports` | None (Open to all authenticated; items filtered by user RBAC) | `/reports` | ATLAS Report Registry (11 standard operational reports) | ✅ Complete | `tests/test_ai_assistant.py` (`test_get_available_reports_catalog`, `test_nlp_pipeline_intent_recognition`) |
| **`settings.user_lookup`** | Settings / Admin | • "Which employees can edit products?"<br>• "Find user by username"<br>• "Who has admin role?"<br>• "Show users with POS access" | `username`, `email`, `role`, `feature_permission` | `get_admin_user_info` | `users.manage` (Admin only) | `/settings` | PostgreSQL `users` model (Passwords & hash tokens strictly excluded) | ✅ Complete | `tests/test_ai_assistant.py` (`test_admin_user_info_authorization_and_data`, `test_nlp_pipeline_intent_recognition`) |
| **`settings.my_permissions`** | Settings | • "What can I access with my current permissions?"<br>• "My permissions"<br>• "What is my role?"<br>• "My assigned branch" | None | `get_my_permissions` | None (Self-service for any authenticated employee) | `/settings` | Authenticated user session claims & permissions | ✅ Complete | `tests/test_ai_assistant.py` (`test_my_permissions_self_service`, `test_nlp_pipeline_intent_recognition`) |
| **`navigation.goto`** | Navigation | • "Open the inventory report."<br>• "Open Products."<br>• "Take me to Purchase Invoices."<br>• "Go to Users & Roles."<br>• "Open AI Generated Reports." | `target_module` | `navigate_to_module` | Target route permission validated before link generation | Resolved dynamic route | `routeRegistry.ts` & `route_map.py` | ✅ Complete | `tests/test_ai_assistant.py` (`test_navigate_to_module_safety`, `test_nlp_pipeline_intent_recognition`), `src/utils/routeRegistry.test.ts` |

---

## 3. Conversational Context & Follow-Up Resolution

The NLP engine maintains conversation state across interactions via `ConversationContext`. Follow-up queries inherit prior metrics, date ranges, and branch scopes while updating specific filters:

| Context State | Follow-up Prompt | Resolved Query & Behavior |
| :--- | :--- | :--- |
| `metric="sales"`, `range="month"`, `branch="SH"` | *"Compare with last month."* | Resolves to `dashboard.sales_trend`, `range="compare_last_month"`, `metric="sales"`, `branch="SH"`. Invokes `get_analytical_table`. |
| `metric="sales"`, `range="month"`, `branch=None` | *"Only for this branch."* (or *"Only for SH"*) | Scopes `branch="SH"`, retaining current metric and temporal range. |
| `module="products"`, `range="month"` | *"Show the top five."* | Resolves to `inventory.top_products`, setting `limit=5` and retaining current date range and branch. |
| Any analytical table or report query | *"Open that report."* | Inspects `last_module` or `last_tool` in context and issues a navigation card to the matching route (e.g., `/reports/sales`, `/production/rejection`). |

---

## 4. Security, RBAC & Protection Controls

1. **Authorization Pre-Check**:
   Every tool execution verifies the user's role and explicit permissions before invoking backend service methods.
2. **Confidentiality Guardrails**:
   `get_admin_user_info` requires `users.manage`. Even when executed by an administrator, sensitive authentication tokens, password hashes, and salts are completely stripped from the result. For non-administrators, access is denied with a 403 Forbidden structured response.
3. **Branch Isolation**:
   Non-admin users attempting to query branches outside their authorized assignment have their requests clamped or rejected with 403 Forbidden.
4. **Prompt Injection Resistance**:
   User input is treated strictly as untrusted parameters. Tools are allowlisted; arbitrary SQL, shell, or HTTP execution is impossible.
5. **Write-Back Lockout**:
   `FINANCE_WRITEBACK_ENABLED=False` is enforced. Proposal tools (`propose_record_update`) generate structured review payloads only, and submission tools (`submit_approved_record_update`) raise strict policy violations.

---

## 5. Verification & Test Suite Summary

### Backend Test Verification
- Test file: `tests/test_ai_assistant.py` (41 tests)
- Test file: `tests/test_finance_ai.py` (18 tests)
- Total backend AI tests: **59 passed / 0 failed (100% pass rate)**.
- Execution time: ~8.5 seconds.

### Frontend Test Verification
- Test files:
  - `src/utils/routeRegistry.test.ts` (6 tests)
  - `src/components/RichTableChartRenderer.test.tsx` (25 tests)
  - `src/components/RequirePermission.test.tsx` (5 tests)
  - `src/components/PermissionMatrixModal.test.tsx` (4 tests)
  - `src/components/LayoutNavigation.test.tsx` (6 tests)
  - `src/utils/date.test.ts` (12 tests)
- Total frontend unit tests: **58 passed / 0 failed (100% pass rate)**.

### Production Build Verification
- Command: `npm run build` (`tsc -b && vite build`)
- Output: Production assets cleanly compiled with zero TypeScript or bundler errors:
  - `dist/index.html` (0.47 kB)
  - `dist/assets/index-BkRWf9MI.css` (151.73 kB)
  - `dist/assets/index-BS6XyjGl.js` (1,837.92 kB)
