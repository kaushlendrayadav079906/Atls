"""
ATLAS AI Assistant — NLP Intelligence & Intent Pipeline
Performs deterministic intent classification, entity & parameter extraction,
conversational reference resolution, and backend tool pre-mapping.
"""

import re
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from app.core.capability_registry import CAPABILITY_REGISTRY, BusinessCapability, find_capability_by_id


class ExtractedEntities(BaseModel):
    range: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    branch: Optional[str] = None
    status: Optional[str] = None
    item_code: Optional[str] = None
    customer_query: Optional[str] = None
    supplier_query: Optional[str] = None
    user_query: Optional[str] = None
    feature_permission: Optional[str] = None
    limit: Optional[int] = None
    order: Optional[str] = None
    metric: Optional[str] = None
    group_by: Optional[str] = None
    target_module: Optional[str] = None
    search_term: Optional[str] = None
    low_stock: Optional[bool] = None
    workflow_module: Optional[str] = None


class NLPQueryAnalysis(BaseModel):
    original_message: str
    normalized_message: str
    intent_id: str
    capability: Optional[BusinessCapability] = None
    entities: ExtractedEntities = Field(default_factory=ExtractedEntities)
    is_follow_up: bool = False
    missing_parameters: List[str] = Field(default_factory=list)
    clarifying_question: Optional[str] = None
    suggested_tool: Optional[str] = None
    suggested_tool_args: Dict[str, Any] = Field(default_factory=dict)
    suggested_follow_ups: List[str] = Field(default_factory=list)


# Synonyms and domain dictionary
DOMAIN_SYNONYMS = {
    r"\bso\b": "sales order",
    r"\bpo\b": "purchase order",
    r"\binv\b": "invoice",
    r"\binvs\b": "invoices",
    r"\bprod\b": "production",
    r"\brej\b": "rejection",
    r"\bwh\b": "warehouse",
    r"\bwhs\b": "warehouses",
    r"\bcust\b": "customer",
    r"\bsupp\b": "supplier",
    r"\bbal\b": "balance",
    r"\bar\b": "accounts receivable",
    r"\bap\b": "accounts payable",
    r"\brejeck\b": "rejection",
    r"\breject\b": "rejection",
    r"\bpurshase\b": "purchase",
    r"\binvoce\b": "invoice",
    r"\bcustmr\b": "customer",
    r"\bwastage\b": "rejection",
}

# Module Route Mapping
MODULE_NAV_MAP = {
    "dashboard": {"route": "/", "label": "Open Dashboard"},
    "products": {"route": "/products", "label": "Open Products & Stock"},
    "inventory": {"route": "/products", "label": "Open Products & Stock"},
    "pos": {"route": "/pos", "label": "Open Point of Sale"},
    "sales": {"route": "/sales", "label": "Open Sales Invoices"},
    "invoices": {"route": "/sales", "label": "Open Sales Invoices"},
    "sales_orders": {"route": "/sales-orders", "label": "Open Sales Orders"},
    "purchase_orders": {"route": "/purchase-orders", "label": "Open Purchase Orders"},
    "customers": {"route": "/customers", "label": "Open Customers"},
    "returns": {"route": "/returns", "label": "Open Returns & Approvals"},
    "approvals": {"route": "/returns", "label": "Open Returns & Approvals"},
    "analytics": {"route": "/analytics", "label": "Open Atlas Analytics"},
    "production": {"route": "/production", "label": "Open Production Overview"},
    "production_overview": {"route": "/production", "label": "Open Production Overview"},
    "production_orders": {"route": "/production/orders", "label": "Open Production Orders"},
    "production_item_wise": {"route": "/production/item-wise", "label": "Open Item-wise Production"},
    "production_rejection": {"route": "/production/rejection", "label": "Open Production Rejection"},
    "production_date_wise": {"route": "/production/date-wise", "label": "Open Date-wise Production"},
    "production_reports": {"route": "/production/reports", "label": "Open Production Reports"},
    "finance": {"route": "/finance", "label": "Open Finance Overview"},
    "finance_overview": {"route": "/finance", "label": "Open Finance Overview"},
    "purchase_invoices": {"route": "/finance/purchase-invoices", "label": "Open Purchase Invoices"},
    "incoming_payments": {"route": "/finance/incoming-payments", "label": "Open Incoming Payments"},
    "outgoing_payments": {"route": "/finance/outgoing-payments", "label": "Open Outgoing Payments"},
    "customer_analysis": {"route": "/finance/customer-analysis", "label": "Open Customer Analysis"},
    "supplier_analysis": {"route": "/finance/supplier-analysis", "label": "Open Supplier Analysis"},
    "profitability": {"route": "/finance/profitability-reports", "label": "Open Profitability Reports"},
    "reports": {"route": "/reports", "label": "Open Reports Hub"},
    "reports_sales": {"route": "/reports/sales", "label": "Open Sales Reports"},
    "reports_invoice": {"route": "/reports/invoice", "label": "Open Invoice Reports"},
    "reports_payment": {"route": "/reports/payment", "label": "Open Payment Reports"},
    "reports_inventory": {"route": "/reports/inventory", "label": "Open Inventory Reports"},
    "reports_ai": {"route": "/reports/ai", "label": "Open AI Generated Reports"},
    "settings": {"route": "/settings", "label": "Open Settings & Users"},
    "users": {"route": "/settings", "label": "Open Users & Roles"},
    "contact": {"route": "/contact", "label": "Open Support & Contact"},
}


def normalize_text(text: str) -> str:
    """Cleans punctuation, lowercases, and expands domain abbreviations."""
    t = text.lower().strip()
    for pattern, replacement in DOMAIN_SYNONYMS.items():
        t = re.sub(pattern, replacement, t, flags=re.IGNORECASE)
    # clean excessive spaces
    t = re.sub(r"\s+", " ", t)
    return t


def extract_temporal_expression(text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extracts standard business date ranges from text.
    Returns: (range_enum, date_from_str, date_to_str)
    """
    today = date.today()

    # Explicit ISO dates (YYYY-MM-DD to YYYY-MM-DD)
    date_matches = re.findall(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    if len(date_matches) >= 2:
        return None, date_matches[0], date_matches[1]
    elif len(date_matches) == 1:
        return None, date_matches[0], date_matches[0]

    # Period comparisons
    if ("compare" in text and "last month" in text) or any(k in text for k in ("compare this month with last month", "this month vs last month", "compared to last month", "vs last month", "compare with last month")):
        return "compare_last_month", None, None

    if any(k in text for k in ("compare with last year", "this month vs last year", "same month last year")):
        return "same_month_last_year", None, None

    # Standard ranges
    if any(k in text for k in ("today's", "today", "daily")):
        return "today", None, None
    if any(k in text for k in ("yesterday's", "yesterday")):
        return "yesterday", None, None
    if any(k in text for k in ("this week", "current week", "weekly")):
        return "week", None, None
    if any(k in text for k in ("last month", "previous month")):
        return "last_month", None, None
    if any(k in text for k in ("past 6 months", "last 6 months", "past six months", "6 months")):
        return "past_6_months", None, None
    if any(k in text for k in ("this month", "current month", "monthly")):
        return "month", None, None
    if any(k in text for k in ("this year", "yearly", "ytd")):
        return "year", None, None
    if any(k in text for k in ("last year", "previous year")):
        return str(today.year - 1), None, None
    if any(k in text for k in ("all time", "total", "overall", "since inception")):
        return "total", None, None

    return None, None, None


def extract_branch_expression(text: str) -> Optional[str]:
    """Extracts warehouse or branch code references from query."""
    # Pattern 1: 'in branch DEL', 'for branch SH', 'at warehouse 01'
    m = re.search(r"\b(?:in|for|at|branch|warehouse)\s+([A-Za-z0-9_-]{2,10})\b", text)
    if m:
        candidate = m.group(1).upper()
        if candidate not in ("THE", "THIS", "ALL", "OUR", "ANY", "EACH", "TODAY", "WEEK", "MONTH", "YEAR"):
            return candidate

    # Pattern 2: direct known branches
    for code in ("SH", "DEL", "MUM", "BLR", "WH01", "WH-01", "01", "HEADQUARTERS", "MAIN"):
        if re.search(rf"\b{code}\b", text, flags=re.IGNORECASE):
            return code.upper()

    return None


def extract_limit_expression(text: str) -> Optional[int]:
    """Extracts top N limit from query."""
    # "top 5", "top 10", "top five", "top ten"
    word_to_num = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "twenty": 20, "fifty": 50, "hundred": 100
    }
    m = re.search(r"\btop\s+(\d+)\b", text)
    if m:
        return int(m.group(1))

    for word, num in word_to_num.items():
        if re.search(rf"\btop\s+{word}\b", text):
            return num

    if "highest" in text or "best" in text or "fastest" in text:
        return 10

    return None


def extract_sku_or_code(text: str) -> Optional[str]:
    """Extracts potential SKU, product code, or CardCode."""
    # Format e.g. AMIT000121, P10023, C0001, V0001, ITEM-101
    m = re.search(r"\b([A-Za-z]{2,8}[0-9]{3,8}|ITEM-[0-9A-Za-z]+)\b", text)
    if m:
        candidate = m.group(1)
        if candidate.lower() not in ("today", "yesterday", "weekly", "monthly", "yearly"):
            return candidate.upper()
    return None


class NLPIntentPipeline:
    """
    Processes natural-language queries into structured execution plans.
    Maintains session context for seamless multi-turn follow-ups.
    """

    def __init__(self):
        self.capabilities = CAPABILITY_REGISTRY

    def analyze_query(
        self,
        message: str,
        current_user: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> NLPQueryAnalysis:
        norm = normalize_text(message)
        entities = ExtractedEntities()

        # 1. Extract Temporal Range
        r, d_from, d_to = extract_temporal_expression(norm)
        entities.range = r
        entities.date_from = d_from
        entities.date_to = d_to

        # 2. Extract Branch
        branch = extract_branch_expression(norm)
        if branch:
            entities.branch = branch

        # 3. Extract Limit & Ordering
        limit = extract_limit_expression(norm)
        if limit:
            entities.limit = limit
        if any(k in norm for k in ("lowest", "least", "worst", "slowest", "bottom")):
            entities.order = "lowest"
        elif any(k in norm for k in ("top", "highest", "best", "most")):
            entities.order = "top"

        # 4. Extract SKU or Item
        sku = extract_sku_or_code(message)
        if sku:
            entities.item_code = sku

        # 5. Extract Status
        for status_val in ("pending", "completed", "cancelled", "released", "planned", "open", "closed"):
            if re.search(rf"\b{status_val}\b", norm):
                entities.status = status_val.capitalize() if status_val in ("planned", "released", "closed", "cancelled") else status_val
                break

        # 6. Extract Metric
        if any(k in norm for k in ("quantity", "quantity sold", "units sold", "units", "by quantity")):
            entities.metric = "quantity"
        elif any(k in norm for k in ("sales", "revenue", "turnover", "income")):
            entities.metric = "sales"
        elif any(k in norm for k in ("payment", "collection", "receipt")):
            entities.metric = "payments"

        # Check for Contextual Follow-Up
        is_follow_up = False
        last_metric = context.get("last_metric") if context else None
        last_tool = context.get("last_tool") if context else None
        last_branch = context.get("last_branch") if context else None
        last_range = context.get("last_range") if context else None
        last_intent = context.get("last_intent") if context else None
        last_limit = context.get("last_limit") if context else None

        if context and (
            norm.startswith("compare")
            or "only for" in norm
            or norm.startswith("for branch")
            or norm.startswith("show the top")
            or norm == "show the top five"
            or norm == "open that report"
            or norm == "open that page"
            or "quantity" in norm
            or "only this month" in norm
            or norm == "only this month"
            or norm == "this month"
            or norm == "this week"
            or norm == "today"
            or "compare their" in norm
            or "their quantity" in norm
            or "flowchart" in norm
            or "workflow" in norm
            or norm == "show me the process flowchart"
            or norm == "show process flowchart"
            or norm == "show the flowchart"
            or norm == "explain this graph"
        ):
            is_follow_up = True

        # 7. Intent & Capability Resolution
        matched_cap: Optional[BusinessCapability] = None
        intent_id = "general_query"

        # Check: Process Flowchart or Workflow Query (Standalone or Follow-up)
        if any(k in norm for k in (
            "flowchart", "process flowchart", "show flowchart", "show the flowchart",
            "show me the process flowchart", "show me the flowchart", "process workflow",
            "workflow flowchart", "explain the workflow", "explain the process",
            "how does a sale work", "how does a sale work in atlas", "explain the sales process",
            "explain the purchase process", "how does inventory update", "how does inventory update after a sale",
            "explain the production workflow", "how does user permission assignment work",
            "how is this report calculated", "explain payment lifecycle", "explain invoice and return"
        )) or (is_follow_up and ("flowchart" in norm or "workflow" in norm)):
            intent_id = "workflow.flowchart"
            matched_cap = find_capability_by_id("workflow.flowchart")

            target_mod = "sales"
            if any(k in norm for k in ("sale", "pos", "order to cash", "checkout")):
                target_mod = "sales"
            elif any(k in norm for k in ("inventory", "stock", "update after a sale")):
                target_mod = "inventory"
            elif any(k in norm for k in ("purchase", "po", "procure", "supplier")):
                target_mod = "purchasing"
            elif any(k in norm for k in ("production", "manufactur", "assembly", "scrap")):
                target_mod = "production"
            elif any(k in norm for k in ("payment", "tender", "cash flow", "reconciliation")):
                target_mod = "payments"
            elif any(k in norm for k in ("invoice", "return", "refund", "credit note")):
                target_mod = "invoices"
            elif any(k in norm for k in ("customer", "receivable")):
                target_mod = "customers"
            elif any(k in norm for k in ("permission", "role", "user", "assignment")):
                target_mod = "settings"
            elif any(k in norm for k in ("report", "calculated", "bi")):
                target_mod = "reports"
            elif any(k in norm for k in ("finance", "profit", "margin", "cogs")):
                target_mod = "finance"
            elif is_follow_up:
                last_mod = str(context.get("last_module") or "").lower()
                last_t = str(context.get("last_tool") or "").lower()
                if "production" in last_mod or "production" in last_t:
                    target_mod = "production"
                elif "product" in last_mod or "inventory" in last_t:
                    target_mod = "inventory"
                elif "sales" in last_mod or "invoice" in last_t:
                    target_mod = "sales"
                elif "purchase" in last_mod or "purchase" in last_t:
                    target_mod = "purchasing"
                elif "finance" in last_mod or "profit" in last_t:
                    target_mod = "finance"
                elif "payment" in last_mod or "payment" in last_t:
                    target_mod = "payments"
                elif "report" in last_mod:
                    target_mod = "reports"
                elif "setting" in last_mod:
                    target_mod = "settings"
                else:
                    target_mod = "dashboard"
            entities.workflow_module = target_mod

        # Check: Smart Email Assistant Intent
        elif any(k in norm for k in (
            "draft a payment reminder", "draft payment reminder", "prepare a reminder", "prepare reminder",
            "email about this invoice", "email this invoice", "draft an email", "draft email",
            "email the supplier", "email supplier", "write a professional overdue payment follow-up",
            "overdue payment follow-up", "overdue payment follow up", "summarize this customer's account and draft an email",
            "summarize this customer account and draft an email", "prepare an email for the finance team",
            "email for the finance team", "send an email reminder", "send payment reminder email",
            "prepare an email", "write an email", "draft email for", "email customer", "payment reminder"
        )) or (("email" in norm or "draft" in norm or "reminder" in norm) and any(x in norm for x in ("customer", "invoice", "supplier", "payment", "overdue", "pending", "po"))):
            intent_id = "email.draft"
            matched_cap = find_capability_by_id("email.draft")

            # Determine purpose
            if "overdue" in norm:
                entities.search_term = "overdue_payment"
            elif "finance team" in norm or ("finance" in norm and "team" in norm):
                entities.search_term = "finance_team"
            elif any(s in norm for s in ("supplier", "purchase order", "po")):
                entities.search_term = "supplier_communication"
            elif "order" in norm and "sales" in norm:
                entities.search_term = "sales_order_update"
            elif "invoice" in norm and not ("reminder" in norm or "pending" in norm):
                entities.search_term = "invoice_followup"
            else:
                entities.search_term = "payment_reminder"

            # Extract any explicit customer name or code
            m_cust = re.search(r"(?:customer|client)\s+([A-Za-z0-9_-]+)", norm)
            if m_cust and m_cust.group(1).lower() not in ("this", "that", "the", "account"):
                entities.customer_query = m_cust.group(1)

            # Extract any explicit invoice number
            m_inv = re.search(r"(?:invoice|inv)\s*(?:#|no\.?|num)?\s*([0-9]+)", norm)
            if m_inv:
                entities.item_code = m_inv.group(1)

        # Check: Top Products / Velocity / Ranking (Standalone or Follow-Up)
        elif any(k in norm for k in (
            "top products", "top selling products", "best sellers", "highest selling items",
            "show top products", "top five products", "top 5 products", "top 10 products",
            "fastest moving goods", "top products by sales", "top products by quantity",
            "top five products by sales", "top 5 products by sales", "top products by sales amount"
        )) or (is_follow_up and ("top five" in norm or "top 5" in norm or "their quantity" in norm or ("compare" in norm and "quantity" in norm))):
            intent_id = "inventory.top_products"
            matched_cap = find_capability_by_id("inventory.top_products")
            entities.limit = entities.limit or last_limit or (5 if ("five" in norm or "5" in norm) else 10)
            if "quantity" in norm:
                entities.metric = "quantity"
            else:
                entities.metric = last_metric or "sales"
            entities.range = entities.range or last_range or "month"
            if not entities.branch:
                entities.branch = last_branch

        # Check: Date range refinement follow-up ("Only this month", "This month only")
        elif is_follow_up and ("only this month" in norm or "this month only" in norm or norm == "only this month" or norm == "this month"):
            matched_cap = find_capability_by_id(last_intent or "dashboard.kpis")
            intent_id = matched_cap.capability_id if matched_cap else (last_intent or "dashboard.kpis")
            entities.range = "month"
            entities.metric = last_metric or "sales"
            entities.limit = last_limit or entities.limit
            if not entities.branch:
                entities.branch = last_branch

        # Check: Branch scoping follow-up ("Only for this branch", "Only for SH")
        elif is_follow_up and ("only for" in norm or "for branch" in norm):
            matched_cap = find_capability_by_id(last_intent or last_tool or "dashboard.kpis")
            intent_id = matched_cap.capability_id if matched_cap else "dashboard.kpis"
            entities.range = last_range or "month"
            entities.metric = last_metric or "sales"
            entities.limit = last_limit or entities.limit
            if not entities.branch:
                entities.branch = last_branch

        # Check: Settings / Admin / Permissions Intent
        elif any(k in norm for k in ("which employees can edit products", "who can edit products", "can edit products")):
            intent_id = "settings.user_lookup"
            matched_cap = find_capability_by_id("settings.user_lookup")
            entities.feature_permission = "products.edit"

        elif any(k in norm for k in ("what can i access with my current permissions", "my permissions", "what are my permissions", "what modules can i access", "what can i do")):
            intent_id = "settings.my_permissions"
            matched_cap = find_capability_by_id("settings.my_permissions")

        elif any(k in norm for k in ("find user", "search user", "user role", "user accounts", "which employees", "list admin users", "list managers")):
            intent_id = "settings.user_lookup"
            matched_cap = find_capability_by_id("settings.user_lookup")
            # Extract user search term if any
            m_user = re.search(r"(?:find user|search user|user)\s+([A-Za-z0-9_.@-]+)", norm)
            if m_user:
                entities.user_query = m_user.group(1)

        # Check: All available reports
        elif any(k in norm for k in ("show me all available reports", "available reports", "all reports", "what reports are available", "list reports")):
            intent_id = "reports.catalog"
            matched_cap = find_capability_by_id("reports.catalog")

        # Check: Production Rejection & Scrap Report
        elif any(k in norm for k in ("create a report showing production rejection by item", "production rejection by item", "rejection by item", "rejection trends", "show rejection trends", "scrap report", "production wastage", "defective items")):
            intent_id = "production.rejection"
            matched_cap = find_capability_by_id("production.rejection")

        # Check: Direct Navigation Intent ("open the inventory report", "open products", "take me to purchase invoices", "go to users & roles", "show me the settings section")
        elif any(norm.startswith(prefix) for prefix in ("open ", "take me to ", "go to ", "navigate to ", "show me the settings", "show settings")):
            intent_id = "navigation.goto"
            matched_cap = find_capability_by_id("navigation.goto")
            for key, info in MODULE_NAV_MAP.items():
                clean_key = key.replace("_", " ")
                if clean_key in norm or info["label"].lower() in norm or key in norm:
                    entities.target_module = key
                    break
            if not entities.target_module:
                if "setting" in norm or "user" in norm:
                    entities.target_module = "settings"
                elif "inventory report" in norm:
                    entities.target_module = "reports_inventory"
                elif "sales report" in norm:
                    entities.target_module = "reports_sales"
                elif "payment report" in norm:
                    entities.target_module = "reports_payment"
                elif "production rejection" in norm:
                    entities.target_module = "production_rejection"
                elif "purchase invoice" in norm:
                    entities.target_module = "purchase_invoices"
                elif "sales order" in norm:
                    entities.target_module = "sales_orders"
                elif "product" in norm:
                    entities.target_module = "products"

        # Check: Sales comparison / trend (both standalone and follow-up)
        elif ("compare" in norm and ("month" in norm or "sales" in norm or "revenue" in norm)) or (is_follow_up and ("compare" in norm or "last month" in norm)) or any(k in norm for k in ("sales trend", "revenue trend", "compare sales", "monthly sales", "past 6 months sales", "sales breakdown", "revenue per month")):
            intent_id = "dashboard.sales_trend"
            matched_cap = find_capability_by_id("dashboard.sales_trend")
            entities.metric = last_metric or "sales"
            entities.group_by = "comparison" if ("compare" in norm or entities.range == "compare_last_month") else "month"
            entities.range = entities.range or ("compare_last_month" if "compare" in norm else "past_6_months")

        # Check: Outstanding customer balances
        elif any(k in norm for k in ("which customers have outstanding balances", "outstanding balances", "unpaid balances", "who owes us money", "accounts receivable")):
            intent_id = "customers.receivables"
            matched_cap = find_capability_by_id("customers.receivables")

        # Check: Customer with highest sales
        elif any(k in norm for k in ("find the customer with the highest sales", "customer with the highest sales", "highest customer", "top customer")):
            intent_id = "customers.ranking"
            matched_cap = find_capability_by_id("customers.ranking")
            entities.order = "top"
            entities.limit = 1 if "customer with" in norm else 10

        # Check: Purchase invoices for supplier
        elif any(k in norm for k in ("purchase invoices for this supplier", "purchase invoices", "supplier invoices", "vendor invoices")):
            intent_id = "finance.purchase_invoices"
            matched_cap = find_capability_by_id("finance.purchase_invoices")

        # Check: Pending production orders
        elif any(k in norm for k in ("show pending production orders", "pending production", "production orders")):
            intent_id = "production.orders"
            matched_cap = find_capability_by_id("production.orders")
            entities.status = "Planned" if "pending" in norm else None

        # Check: Low stock items
        elif any(k in norm for k in ("which products are running low on stock", "low stock", "running low on stock", "shortage items", "out of stock")):
            intent_id = "inventory.low_stock"
            matched_cap = find_capability_by_id("inventory.low_stock")
            entities.low_stock = True

        # Check: Today's sales / KPIs
        elif any(k in norm for k in ("show me today's sales", "today's sales", "sales today", "today sales", "sales this month", "sales this week")):
            intent_id = "dashboard.kpis"
            matched_cap = find_capability_by_id("dashboard.kpis")
            entities.range = entities.range or "today"

        # Check: Profit decrease reason / Profitability
        elif any(k in norm for k in ("why did profit decrease this month", "profit decrease", "profitability", "gross profit")):
            intent_id = "finance.profitability"
            matched_cap = find_capability_by_id("finance.profitability")
            entities.range = "compare_last_month" if "decrease" in norm or "why" in norm else "month"

        # Check: Single SKU inventory lookup
        elif entities.item_code:
            intent_id = "inventory.stock_levels"
            matched_cap = find_capability_by_id("inventory.stock_levels")

        # 7. Construct Tool Suggestions & Arguments
        suggested_tool = None
        suggested_tool_args = {}

        if matched_cap:
            suggested_tool = matched_cap.authorized_backend_tool
            if suggested_tool == "get_dashboard_summary":
                suggested_tool_args = {
                    "range": entities.range or "today",
                    "branch": entities.branch,
                    "date_from": entities.date_from,
                    "date_to": entities.date_to
                }
            elif suggested_tool == "get_analytical_table":
                suggested_tool_args = {
                    "metric": entities.metric or "sales",
                    "group_by": entities.group_by or ("comparison" if entities.range == "compare_last_month" else "month"),
                    "range": entities.range or "past_6_months",
                    "branch": entities.branch,
                    "limit": entities.limit or 20
                }
            elif suggested_tool == "get_inventory_stock":
                suggested_tool_args = {
                    "low_stock_only": matched_cap.capability_id == "inventory.low_stock",
                    "item_code": entities.item_code,
                    "warehouse": entities.branch
                }
            elif suggested_tool == "get_products":
                suggested_tool_args = {
                    "top_selling_only": True,
                    "limit": entities.limit or 10,
                    "range": entities.range or "month",
                    "ranking_by": entities.metric or "sales_amount",
                    "branch": entities.branch
                }
            elif suggested_tool == "get_sales_orders":
                suggested_tool_args = {
                    "status": entities.status.lower() if entities.status else "pending",
                    "limit": entities.limit or 10
                }
            elif suggested_tool == "get_production_orders":
                suggested_tool_args = {
                    "status": entities.status or "Planned",
                    "warehouse": entities.branch,
                    "limit": entities.limit or 10
                }
            elif suggested_tool == "get_production_rejection":
                suggested_tool_args = {
                    "warehouse": entities.branch,
                    "date_from": entities.date_from,
                    "date_to": entities.date_to
                }
            elif suggested_tool == "get_accounts_receivable":
                suggested_tool_args = {
                    "limit": entities.limit or 20
                }
            elif suggested_tool == "get_customer_sales_ranking":
                suggested_tool_args = {
                    "order": entities.order or "top",
                    "limit": entities.limit or 10,
                    "range": entities.range or "month"
                }
            elif suggested_tool == "get_purchase_invoices":
                suggested_tool_args = {
                    "range": entities.range or "month",
                    "search": entities.supplier_query,
                    "limit": entities.limit or 20
                }
            elif suggested_tool == "get_profitability_report":
                suggested_tool_args = {
                    "range": entities.range or "month"
                }
            elif suggested_tool == "get_admin_user_info":
                suggested_tool_args = {
                    "search_query": entities.user_query,
                    "feature_permission": entities.feature_permission
                }
            elif suggested_tool == "get_my_permissions":
                suggested_tool_args = {}
            elif suggested_tool == "get_available_reports":
                suggested_tool_args = {}
            elif suggested_tool == "get_workflow_flowchart":
                suggested_tool_args = {
                    "module": entities.workflow_module or "sales"
                }
            elif suggested_tool == "navigate_to_module":
                suggested_tool_args = {
                    "target_module": entities.target_module or "dashboard"
                }
            elif suggested_tool == "draft_email":
                purpose = entities.search_term or "payment_reminder"
                suggested_tool_args = {"purpose": purpose}

                # Context-Aware record resolution
                selected_rec = (context.get("selected_record") if context else None) or {}
                if entities.customer_query:
                    suggested_tool_args["customer_name_or_code"] = entities.customer_query
                elif selected_rec.get("CardCode") or selected_rec.get("customer_code"):
                    suggested_tool_args["customer_name_or_code"] = selected_rec.get("CardCode") or selected_rec.get("customer_code")
                elif selected_rec.get("CardName") or selected_rec.get("customer_name"):
                    suggested_tool_args["customer_name_or_code"] = selected_rec.get("CardName") or selected_rec.get("customer_name")
                elif context and context.get("last_customer"):
                    suggested_tool_args["customer_name_or_code"] = context.get("last_customer")

                if entities.item_code:
                    suggested_tool_args["invoice_doc_num"] = str(entities.item_code)
                elif selected_rec.get("DocNum") or selected_rec.get("doc_num"):
                    suggested_tool_args["invoice_doc_num"] = str(selected_rec.get("DocNum") or selected_rec.get("doc_num"))
                elif selected_rec.get("id") and ("inv" in str(selected_rec.get("id")).lower() or str(selected_rec.get("id")).isdigit()):
                    suggested_tool_args["invoice_doc_num"] = str(selected_rec.get("id"))
                elif context and context.get("last_invoice"):
                    suggested_tool_args["invoice_doc_num"] = str(context.get("last_invoice"))

                if entities.supplier_query:
                    suggested_tool_args["supplier_name_or_code"] = entities.supplier_query
                elif selected_rec.get("supplier_code") or selected_rec.get("vendor_code"):
                    suggested_tool_args["supplier_name_or_code"] = selected_rec.get("supplier_code") or selected_rec.get("vendor_code")

                if selected_rec.get("EmailAddress") or selected_rec.get("email"):
                    suggested_tool_args["recipient_email"] = selected_rec.get("EmailAddress") or selected_rec.get("email")

        # Clean null args
        suggested_tool_args = {k: v for k, v in suggested_tool_args.items() if v is not None}

        # 8. Dynamic Follow-Up Suggestions
        follow_ups = self._generate_follow_ups(intent_id, entities)

        return NLPQueryAnalysis(
            original_message=message,
            normalized_message=norm,
            intent_id=intent_id,
            capability=matched_cap,
            entities=entities,
            is_follow_up=is_follow_up,
            suggested_tool=suggested_tool,
            suggested_tool_args=suggested_tool_args,
            suggested_follow_ups=follow_ups
        )

    def _generate_follow_ups(self, intent_id: str, entities: ExtractedEntities) -> List[str]:
        """Provides dynamic, contextually relevant follow-up questions."""
        if intent_id == "workflow.flowchart":
            return [
                "Show today's sales",
                "Which products are running low on stock?",
                "Show pending production orders",
                "Open Dashboard"
            ]
        elif intent_id == "email.draft":
            return [
                "Regenerate with a firmer tone",
                "Add CC to finance team",
                "Confirm & Send Email"
            ]
        elif intent_id in ("inventory.top_products",):
            return [
                "Compare quantity sold",
                "Show monthly sales trends",
                "Which products are running low on stock?",
                "Open Products Catalog"
            ]
        elif intent_id in ("dashboard.kpis", "dashboard.sales_trend"):
            return [
                "Compare this month with last month",
                "Show sales by product",
                "Show sales trends for the last six months",
                "Open Sales Reports"
            ]
        elif intent_id in ("production.overview", "production.orders", "production.rejection"):
            return [
                "Compare planned and produced quantities",
                "Show rejection by item",
                "Show pending production orders",
                "Open Production Reports"
            ]
        elif intent_id in ("settings.user_lookup", "settings.my_permissions"):
            return [
                "What can I access with my current permissions?",
                "Which employees can edit products?",
                "Open Users & Roles",
                "Show me all available reports"
            ]
        elif intent_id in ("customers.receivables", "customers.ranking"):
            return [
                "Which customers have outstanding balances?",
                "Find the customer with highest sales",
                "Show incoming payments this month",
                "Open Customer Analysis"
            ]
        elif intent_id in ("inventory.stock_levels", "inventory.low_stock"):
            return [
                "Show pending purchase orders",
                "Show top 5 products by sales",
                "Check stock in SH warehouse",
                "Open Products & Stock"
            ]
        elif intent_id == "reports.catalog":
            return [
                "Open the inventory report",
                "Show sales report for this month",
                "Show payment breakdown",
                "Open AI Generated Reports"
            ]
        else:
            return [
                "Show me today's sales",
                "Which products are running low on stock?",
                "Show pending production orders",
                "What can I access with my current permissions?"
            ]


# Singleton instance
nlp_pipeline = NLPIntentPipeline()


def analyze_query(
    message: str,
    current_user: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None
) -> NLPQueryAnalysis:
    """Convenience module-level query analyzer."""
    return nlp_pipeline.analyze_query(message, current_user, context)
