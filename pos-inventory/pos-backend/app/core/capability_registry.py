"""
ATLAS AI Assistant — Central Capability Registry
Maps business capabilities to NLP intents, authorized backend tools, RBAC permissions, routes, and schemas.
Guarantees that the assistant never invents endpoints, permissions, or tools.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BusinessCapability(BaseModel):
    capability_id: str
    name: str
    description: str
    module: str
    natural_language_intents: List[str]
    required_parameters: List[str] = Field(default_factory=list)
    authorized_backend_tool: str
    required_permission: Optional[str] = None
    supported_filters: List[str] = Field(default_factory=list)
    supported_date_ranges: List[str] = Field(default_factory=list)
    expected_result_schema: str
    related_route: str
    is_read_only: bool = True
    limitations: str = "Real-time query from SAP Business One / PostgreSQL database. Subject to user branch scoping."


CAPABILITY_REGISTRY: List[BusinessCapability] = [
    # ── 1. Executive Dashboard & KPIs ──────────────────────────────────────────
    BusinessCapability(
        capability_id="dashboard.kpis",
        name="Executive KPI Summary",
        description="High-level business summary including total sales revenue, invoice counts, average bill value, growth %, low-stock alerts, and pending returns.",
        module="Dashboard",
        natural_language_intents=[
            "today's sales", "sales today", "today revenue", "how much did we sell today",
            "show me today's sales", "business overview", "dashboard summary", "current performance",
            "sales this week", "sales this month", "executive overview", "kpi summary"
        ],
        authorized_backend_tool="get_dashboard_summary",
        required_permission="dashboard.view",
        supported_filters=["range", "branch", "date_from", "date_to"],
        supported_date_ranges=["today", "yesterday", "week", "month", "last_month", "year", "total"],
        expected_result_schema="dashboard_summary",
        related_route="/"
    ),
    BusinessCapability(
        capability_id="dashboard.sales_trend",
        name="Sales Revenue Trend & Analysis",
        description="Multi-period sales trend, monthly revenue breakdown, weekly sales comparisons across branches, and period-over-period delta.",
        module="Dashboard",
        natural_language_intents=[
            "sales trend", "revenue trend", "compare this month with last month", "sales comparison",
            "compare sales with last month", "monthly sales", "past 6 months sales", "show sales for 2025",
            "weekly sales by branch", "sales breakdown", "why did profit decrease this month"
        ],
        authorized_backend_tool="get_analytical_table",
        required_permission="dashboard.view",
        supported_filters=["metric", "group_by", "range", "branch", "limit", "date_from", "date_to"],
        supported_date_ranges=["past_6_months", "6_months", "week", "month", "last_month", "compare_last_month", "same_month_last_year", "compare_last_year", "year", "total"],
        expected_result_schema="table",
        related_route="/"
    ),

    # ── 2. Products & Inventory ───────────────────────────────────────────────
    BusinessCapability(
        capability_id="inventory.stock_levels",
        name="Warehouse Stock Levels & SKU Lookup",
        description="Inspect warehouse on-hand quantities, item pricing, warehouse distribution, and specific SKU lookups.",
        module="Products",
        natural_language_intents=[
            "check stock", "stock of item", "how much stock do we have", "search product",
            "warehouse stock", "open product", "product details", "lookup sku", "find item"
        ],
        authorized_backend_tool="get_inventory_stock",
        required_permission="products.view",
        supported_filters=["item_code", "warehouse", "low_stock_only"],
        supported_date_ranges=[],
        expected_result_schema="inventory_stock",
        related_route="/products"
    ),
    BusinessCapability(
        capability_id="inventory.low_stock",
        name="Low Stock & Inventory Reorder Alerts",
        description="Identify products that have fallen below minimum reorder thresholds or have critical shortage across warehouses.",
        module="Products",
        natural_language_intents=[
            "which products are running low on stock", "low stock", "low stock items",
            "shortage items", "products below reorder level", "out of stock", "critical stock",
            "inventory shortage", "what items need reorder"
        ],
        authorized_backend_tool="get_inventory_stock",
        required_permission="products.view",
        supported_filters=["low_stock_only", "warehouse"],
        supported_date_ranges=[],
        expected_result_schema="inventory_stock",
        related_route="/products"
    ),
    BusinessCapability(
        capability_id="inventory.top_products",
        name="Top Selling Products & Velocity",
        description="Rank products by units sold, total revenue generated, and sales velocity over a selected period.",
        module="Products",
        natural_language_intents=[
            "top products", "top selling products", "best sellers", "highest selling items",
            "show top products", "top 5 products", "top 10 products", "fastest moving goods"
        ],
        authorized_backend_tool="get_products",
        required_permission="products.view",
        supported_filters=["top_selling_only", "range", "limit", "search"],
        supported_date_ranges=["today", "week", "month", "year", "total"],
        expected_result_schema="products_list",
        related_route="/products"
    ),

    # ── 3. Sales Orders (Customer Commitments) ────────────────────────────────
    BusinessCapability(
        capability_id="sales_orders.list",
        name="Customer Sales Orders",
        description="Query SAP sales orders, track open fulfillment commitments, and filter by pending, completed, or cancelled status.",
        module="Sales Orders",
        natural_language_intents=[
            "sales orders", "show sales orders", "pending sales orders", "customer orders",
            "how many sales orders are pending", "orders awaiting delivery", "recent sales orders",
            "open sales orders"
        ],
        authorized_backend_tool="get_sales_orders",
        required_permission="sales_orders.view",
        supported_filters=["status", "search", "customer", "date_from", "date_to", "limit"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="sales_orders",
        related_route="/sales-orders"
    ),

    # ── 4. AR Sales Invoices (Revenue & Billing) ──────────────────────────────
    BusinessCapability(
        capability_id="invoices.list",
        name="AR Sales Invoices",
        description="Query posted SAP AR sales invoices, billed revenue amounts, document lines, customer names, and invoice status.",
        module="Invoices",
        natural_language_intents=[
            "sales invoices", "show invoices", "invoices today", "recent invoices",
            "billed invoices", "paid invoices", "unpaid invoices", "show sales list"
        ],
        authorized_backend_tool="get_sales_invoices",
        required_permission="invoices.view",
        supported_filters=["range", "date_from", "date_to", "search", "limit"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="invoices_list",
        related_route="/sales"
    ),

    # ── 5. Purchase Orders (Vendor Commitments) ────────────────────────────────
    BusinessCapability(
        capability_id="purchase_orders.list",
        name="Vendor Purchase Orders",
        description="Query purchase orders placed with suppliers, pending goods receipts, and open supplier delivery tracking.",
        module="Purchase Orders",
        natural_language_intents=[
            "purchase orders", "show purchase orders", "pending purchase orders",
            "orders awaiting receipt", "po list", "vendor orders", "open purchase orders",
            "show pending purchase orders"
        ],
        authorized_backend_tool="get_purchase_orders",
        required_permission="purchase_orders.view",
        supported_filters=["status", "search", "date_from", "date_to", "limit"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="purchase_orders",
        related_route="/purchase-orders"
    ),

    # ── 6. Customers & Receivables ────────────────────────────────────────────
    BusinessCapability(
        capability_id="customers.search",
        name="Customer Directory & Search",
        description="Search customer accounts by phone number, customer CardCode, or business name, returning order and payment summaries.",
        module="Customers",
        natural_language_intents=[
            "find customer", "search customer", "customer phone", "customer by mobile",
            "search customer by mobile", "customer balance", "customer details"
        ],
        authorized_backend_tool="search_customers",
        required_permission="customers.view",
        supported_filters=["search_term"],
        supported_date_ranges=[],
        expected_result_schema="customer_details",
        related_route="/customers"
    ),
    BusinessCapability(
        capability_id="customers.ranking",
        name="Top Purchasing Customers",
        description="Rank customers by total net billing value and invoice count from SAP Business One.",
        module="Customers",
        natural_language_intents=[
            "top customers", "best customers", "find the customer with the highest sales",
            "highest buying customer", "top billed customers", "customer ranking", "who bought the most"
        ],
        authorized_backend_tool="get_customer_sales_ranking",
        required_permission="customers.view",
        supported_filters=["range", "order", "limit", "date_from", "date_to"],
        supported_date_ranges=["month", "last_month", "year", "total", "past_6_months"],
        expected_result_schema="customer_ranking",
        related_route="/customers"
    ),
    BusinessCapability(
        capability_id="customers.receivables",
        name="Outstanding Accounts Receivable (AR)",
        description="Identify customers with outstanding debt balances, overdue receivables, and aging totals.",
        module="Finance",
        natural_language_intents=[
            "which customers have outstanding balances", "outstanding balances", "unpaid balances",
            "accounts receivable", "who owes us money", "customer debt", "receivables aging",
            "outstanding receivables"
        ],
        authorized_backend_tool="get_accounts_receivable",
        required_permission="finance.view",
        supported_filters=["customer_code", "min_balance", "limit"],
        supported_date_ranges=[],
        expected_result_schema="accounts_receivable",
        related_route="/finance/customer-analysis"
    ),

    # ── 7. Returns & Approvals ────────────────────────────────────────────────
    BusinessCapability(
        capability_id="returns.approvals",
        name="Returns, Refunds & Manager Approvals",
        description="Query return merchandise requests, credit notes (AR Credit Memos), and pending manager authorizations.",
        module="Returns",
        natural_language_intents=[
            "pending approvals", "return requests", "show returns", "refund requests",
            "returns and approvals", "manager approvals", "credit notes", "pending refunds"
        ],
        authorized_backend_tool="get_pending_approvals",
        required_permission="returns.view",
        supported_filters=["status"],
        supported_date_ranges=[],
        expected_result_schema="pending_approvals",
        related_route="/returns"
    ),

    # ── 8. Production & Manufacturing ─────────────────────────────────────────
    BusinessCapability(
        capability_id="production.overview",
        name="Production Overview & Efficiency",
        description="Manufacturing KPIs including total batches, planned vs produced quantities, scrap/rejection percentage, and warehouse output.",
        module="Production",
        natural_language_intents=[
            "production overview", "manufacturing summary", "production status", "plant output",
            "how much did we produce", "factory output", "production summary"
        ],
        authorized_backend_tool="get_production_summary",
        required_permission="production.view",
        supported_filters=["warehouse", "date_from", "date_to"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="production_summary",
        related_route="/production"
    ),
    BusinessCapability(
        capability_id="production.orders",
        name="Production Work Orders",
        description="Inspect SAP production orders, scheduled due dates, item manufacturing status (Planned, Released, Closed), and pending quantities.",
        module="Production",
        natural_language_intents=[
            "production orders", "show pending production orders", "pending production",
            "open work orders", "manufacturing orders", "batches in progress", "released production orders"
        ],
        authorized_backend_tool="get_production_orders",
        required_permission="production.orders.view",
        supported_filters=["status", "item_code", "warehouse", "date_from", "date_to", "limit"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="production_orders",
        related_route="/production/orders"
    ),
    BusinessCapability(
        capability_id="production.rejection",
        name="Production Rejection & Scrap Analysis",
        description="Scrap analysis, rejected quantities by item code, defective batch ratios, and quality control logs.",
        module="Production",
        natural_language_intents=[
            "production rejection", "create a report showing production rejection by item",
            "rejection trends", "show rejection trends", "scrap report", "production wastage",
            "rejected quantity", "defective items in production", "defect rate"
        ],
        authorized_backend_tool="get_production_rejection",
        required_permission="production.view",
        supported_filters=["warehouse", "date_from", "date_to", "search"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="production_rejection",
        related_route="/production/rejection"
    ),
    BusinessCapability(
        capability_id="production.item_wise",
        name="Item-wise Production Output",
        description="Detailed manufactured item analysis comparing planned targets against completed goods and scrap rates.",
        module="Production",
        natural_language_intents=[
            "item-wise production", "production by item", "manufactured goods by item",
            "item production targets", "product output in factory"
        ],
        authorized_backend_tool="get_production_item_wise",
        required_permission="production.view",
        supported_filters=["warehouse", "date_from", "date_to", "search"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="production_item_wise",
        related_route="/production/item-wise"
    ),

    # ── 9. Finance & Accounting ───────────────────────────────────────────────
    BusinessCapability(
        capability_id="finance.overview",
        name="Finance Executive Overview",
        description="Financial statements overview: Total Net Sales, AP Purchases, Customer Incoming Collections, Supplier Outgoing Disbursements, Receivables, Payables, and Gross Profit.",
        module="Finance",
        natural_language_intents=[
            "finance overview", "financial summary", "cash flow", "financial kpis",
            "total purchases", "incoming payments", "outgoing payments", "accounts payable",
            "show finance overview"
        ],
        authorized_backend_tool="get_finance_summary",
        required_permission="finance.view",
        supported_filters=["range", "branch", "date_from", "date_to"],
        supported_date_ranges=["daily", "weekly", "monthly", "yearly", "last_month", "past_6_months", "all_time"],
        expected_result_schema="finance_summary",
        related_route="/finance"
    ),
    BusinessCapability(
        capability_id="finance.purchase_invoices",
        name="AP Purchase Invoices",
        description="Invoices billed by vendors for inventory replenishment, item costs, payment terms, and open liability balances.",
        module="Finance",
        natural_language_intents=[
            "purchase invoices", "show purchase invoices for this supplier", "vendor invoices",
            "supplier bills", "ap invoices", "open purchase invoices", "supplier invoices"
        ],
        authorized_backend_tool="get_purchase_invoices",
        required_permission="finance.invoices.view",
        supported_filters=["range", "supplier_code", "status", "search", "date_from", "date_to", "limit"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="purchase_invoices",
        related_route="/finance/purchase-invoices"
    ),
    BusinessCapability(
        capability_id="finance.payments",
        name="Incoming Collections & Outgoing Disbursements",
        description="Breakdown of customer payments collected by mode (Cash, Card, UPI, Cheque, Transfer) versus vendor disbursements.",
        module="Finance",
        natural_language_intents=[
            "incoming payments", "outgoing payments", "payment breakdown", "cash collections",
            "upi payments", "payments this month", "payment collection report"
        ],
        authorized_backend_tool="get_incoming_payments",
        required_permission="finance.payments.view",
        supported_filters=["range", "payment_method", "customer_code", "date_from", "date_to", "limit"],
        supported_date_ranges=["today", "week", "month", "last_month", "year", "total"],
        expected_result_schema="payments_list",
        related_route="/finance/incoming-payments"
    ),
    BusinessCapability(
        capability_id="finance.profitability",
        name="Profitability & Margin Analysis",
        description="Approved gross profit and gross margin % derived deterministically from verified sales and documented cost of goods sold.",
        module="Finance",
        natural_language_intents=[
            "profitability", "gross profit", "profit margin", "why did profit decrease",
            "compare profit", "monthly margin", "margin breakdown"
        ],
        authorized_backend_tool="get_profitability_report",
        required_permission="finance.reports.view",
        supported_filters=["range", "date_from", "date_to"],
        supported_date_ranges=["month", "last_month", "year", "past_6_months", "total"],
        expected_result_schema="profitability_report",
        related_route="/finance/profitability-reports"
    ),

    # ── 10. Reports Hub & Catalog ─────────────────────────────────────────────
    BusinessCapability(
        capability_id="reports.catalog",
        name="Available Reports Discovery",
        description="Catalog of all available reports in ATLAS, backend readiness, export options, and fast navigation links.",
        module="Reports",
        natural_language_intents=[
            "show me all available reports", "available reports", "all reports",
            "what reports are available", "show reports", "list reports", "open reports"
        ],
        authorized_backend_tool="get_available_reports",
        required_permission="reports.view",
        supported_filters=[],
        supported_date_ranges=[],
        expected_result_schema="report_catalog",
        related_route="/reports"
    ),

    # ── 11. Settings & Administrative Intelligence ───────────────────────────
    BusinessCapability(
        capability_id="settings.user_lookup",
        name="Administrative User & Role Management",
        description="Administrative query to find employees, inspect user roles, assigned branches, permitted modules, and feature permissions.",
        module="Settings",
        natural_language_intents=[
            "which employees can edit products", "who can edit products", "find user",
            "user roles", "who has access to", "list admin users", "list managers",
            "users with permission", "search user"
        ],
        authorized_backend_tool="get_admin_user_info",
        required_permission="users.manage",
        supported_filters=["search_query", "role", "feature_permission"],
        supported_date_ranges=[],
        expected_result_schema="admin_user_info",
        related_route="/settings"
    ),
    BusinessCapability(
        capability_id="settings.my_permissions",
        name="My Effective Permissions & Access",
        description="Self-service inquiry allowing any authenticated employee to inspect their own effective permissions and permitted dashboard modules.",
        module="Settings",
        natural_language_intents=[
            "what can i access with my current permissions", "my permissions",
            "what are my permissions", "what modules can i access", "what can i do",
            "show my role", "my access rights"
        ],
        authorized_backend_tool="get_my_permissions",
        required_permission=None,  # Available to any authenticated user
        supported_filters=[],
        supported_date_ranges=[],
        expected_result_schema="my_permissions",
        related_route="/"
    ),

    # ── 12. Smart Page Navigation ─────────────────────────────────────────────
    # ── 13. Process Flowcharts & Workflows ────────────────────────────────────
    BusinessCapability(
        capability_id="workflow.flowchart",
        name="Business Process Flowcharts & Workflows",
        description="Explain verified business workflows, data pipelines, calculation methodologies, and lifecycle processes using interactive flowcharts.",
        module="Workflow",
        natural_language_intents=[
            "flowchart", "process flowchart", "show flowchart", "explain the process",
            "how does a sale work", "explain the sales process using a flowchart",
            "explain the purchase process", "how does inventory update after a sale",
            "explain the production workflow", "how does user permission assignment work",
            "how is this report calculated", "explain payment lifecycle", "explain invoice and returns workflow"
        ],
        authorized_backend_tool="get_workflow_flowchart",
        required_permission=None,
        supported_filters=["module"],
        supported_date_ranges=[],
        expected_result_schema="flowchart",
        related_route="/"
    ),

    BusinessCapability(
        capability_id="navigation.goto",
        name="Dashboard Module Navigation",
        description="Internal navigation within ATLAS dashboard to open any authorized page or record directly.",
        module="Navigation",
        natural_language_intents=[
            "open the inventory report", "open products", "take me to purchase invoices",
            "show the production rejection report", "go to users & roles", "open ai generated reports",
            "show me the settings section", "open sales orders", "open finance overview",
            "take me to", "navigate to", "open page", "go to"
        ],
        authorized_backend_tool="navigate_to_module",
        required_permission=None,  # Validated against target route permissions
        supported_filters=["target_module", "record_id", "params"],
        supported_date_ranges=[],
        expected_result_schema="navigation",
        related_route="/"
    ),

    # ── 14. Smart Email Assistant ─────────────────────────────────────────────
    BusinessCapability(
        capability_id="email.draft",
        name="Smart Business Email Assistant",
        description="Draft verified business communications (payment reminders, invoice follow-ups, sales order updates, purchase order inquiries, supplier communication, overdue payment follow-ups, and finance team notes) from live SAP records.",
        module="Email",
        natural_language_intents=[
            "draft a payment reminder for this customer",
            "prepare an email about this invoice",
            "email the supplier about the pending purchase order",
            "write a professional overdue payment follow-up",
            "summarize this customer's account and draft an email",
            "explain the payment issue and prepare an email for the finance team",
            "draft payment reminder",
            "prepare reminder",
            "draft email",
            "send email reminder",
            "email customer",
            "email supplier",
            "overdue payment follow up",
            "payment reminder email",
        ],
        authorized_backend_tool="draft_email",
        required_permission=None,  # Drafting is view/read-only; sending enforces email.send
        supported_filters=["purpose", "customer_name_or_code", "supplier_name_or_code", "invoice_doc_num", "order_doc_num", "recipient_email"],
        supported_date_ranges=[],
        expected_result_schema="email_draft",
        related_route="/sales"
    )
]



def get_all_capabilities() -> List[BusinessCapability]:
    """Returns the full master capability registry."""
    return CAPABILITY_REGISTRY


def find_capability_by_id(cap_id: str) -> Optional[BusinessCapability]:
    """Finds a capability by unique ID."""
    for cap in CAPABILITY_REGISTRY:
        if cap.capability_id == cap_id:
            return cap
    return None


def get_capabilities_for_role(role: str, user_permissions: List[str]) -> List[BusinessCapability]:
    """
    Returns only capabilities authorized for the given role and permission set.
    Administrators receive all capabilities.
    """
    role_lower = str(role or "user").lower()
    if role_lower == "admin":
        return CAPABILITY_REGISTRY

    perm_set = set(user_permissions or [])
    permitted = []
    for cap in CAPABILITY_REGISTRY:
        if cap.required_permission is None or cap.required_permission in perm_set:
            permitted.append(cap)
    return permitted
