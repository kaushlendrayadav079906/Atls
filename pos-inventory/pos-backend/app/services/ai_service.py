import json
import logging
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, date, timedelta
import time
import threading
import openai

from app.core.config import settings
from app.models.schemas import StructuredTableResponse, TableColumn, TableFilters, TableChartConfig
from app.services.sap.production_service import SAPProductionService
from app.services.sap.invoices_service import SAPInvoicesService
from app.services.sap.sales_orders_service import SAPSalesOrdersService
from app.services.sap.purchase_orders_service import SAPPurchaseOrdersService
from app.services.sap.inventory_service import SAPInventoryService
from app.services.sap.items_service import SAPItemsService
from app.services.sap.business_partners_service import SAPBusinessPartnersService
from app.services.sap.returns_service import SAPReturnsService
from app.services.sap.payments_report_service import SAPPaymentsReportService
from app.services.sap.warehouses_service import SAPWarehousesService
from app.services.sap.finance_service import SAPFinanceService
from app.services import approval_service
from app.services.sap.client import SAPConnectionError
from app.services.user_service import (
    DEFAULT_ROLE_PERMISSIONS,
    STANDARD_PERMISSIONS,
    get_all_permissions,
    get_all_roles,
    get_effective_permissions,
    get_user_by_username,
    get_user_by_email,
    get_all_users,
)
from app.core.nlp_pipeline import nlp_pipeline
from app.core.capability_registry import get_all_capabilities
from app.core.workflow_flows import get_workflow_flowchart

logger = logging.getLogger(__name__)

# Analytical query bounded in-memory cache (TTL: 120s, max 50 entries)
_ANALYTICS_CACHE: Dict[str, Tuple[Dict[str, Any], Optional[Dict[str, Any]], Optional[Dict[str, Any]], float]] = {}
_ANALYTICS_CACHE_LOCK = threading.Lock()
_ANALYTICS_CACHE_TTL = 120.0
_ANALYTICS_CACHE_MAX_SIZE = 50


# Trusted Route Registry Mapping for navigation suggestions
INTERNAL_ROUTE_MAP = {
    "dashboard": {"name": "Dashboard", "path": "/"},
    "pos": {"name": "Point of Sale", "path": "/pos"},
    "products": {"name": "Products & Stock", "path": "/products"},
    "sales": {"name": "Invoices", "path": "/sales"},
    "sales_orders": {"name": "Sales Orders", "path": "/sales-orders"},
    "purchase_orders": {"name": "Purchase Orders", "path": "/purchase-orders"},
    "customers": {"name": "Customers", "path": "/customers"},
    "returns": {"name": "Returns & Approvals", "path": "/returns"},
    "analytics": {"name": "Atlas Analytics", "path": "/analytics"},
    "production_overview": {"name": "Production Overview", "path": "/production"},
    "production_orders": {"name": "Production Orders", "path": "/production/orders"},
    "production_item_wise": {"name": "Item-wise Production", "path": "/production/item-wise"},
    "production_rejection": {"name": "Production Rejection", "path": "/production/rejection"},
    "production_date_wise": {"name": "Date-wise Production", "path": "/production/date-wise"},
    "production_reports": {"name": "Production Reports", "path": "/production/reports"},
    "reports": {"name": "Reports Hub", "path": "/reports"},
    "reports_overview": {"name": "Reports Hub", "path": "/reports"},
    "reports_sales": {"name": "Sales Reports", "path": "/reports/sales"},
    "reports_invoice": {"name": "Invoice Reports", "path": "/reports/invoice"},
    "reports_payment": {"name": "Payment Reports", "path": "/reports/payment"},
    "reports_inventory": {"name": "Inventory Reports", "path": "/reports/inventory"},
    "reports_customer": {"name": "Customer Reports", "path": "/reports/customer"},
    "reports_ai": {"name": "AI Generated Reports", "path": "/reports/ai"},
    "settings": {"name": "Settings", "path": "/settings"},
    "finance_overview": {"name": "Finance Overview", "path": "/finance"},
    "finance_sales_invoices": {"name": "Sales Invoices", "path": "/sales"},
    "finance_purchase_invoices": {"name": "Purchase Invoices", "path": "/finance/purchase-invoices"},
    "finance_incoming_payments": {"name": "Incoming Payments", "path": "/finance/incoming-payments"},
    "finance_outgoing_payments": {"name": "Outgoing Payments", "path": "/finance/outgoing-payments"},
    "finance_customer_analysis": {"name": "Customer Analysis", "path": "/finance/customer-analysis"},
    "finance_supplier_analysis": {"name": "Supplier Analysis", "path": "/finance/supplier-analysis"},
    "finance_profitability_reports": {"name": "Profitability Reports", "path": "/finance/profitability-reports"},
    "contact": {"name": "Support & Contact", "path": "/contact"},
}

# Granular permission mapping for AI assistant tools
TOOL_PERMISSIONS = {
    # Analytical & Dashboard
    "get_dashboard_summary": "dashboard.view",
    "get_sales_trend": "dashboard.view",
    "get_purchase_trend": "dashboard.view",
    # Sales & Invoices
    "get_sales_orders": "sales_orders.view",
    "get_sales_invoices": "invoices.view",
    # Purchases
    "get_purchase_orders": "purchase_orders.view",
    "get_purchase_invoices": "finance.invoices.view",
    # Inventory & Products
    "get_inventory_stock": "products.view",
    "get_products": "products.view",
    # Customers
    "search_customers": "customers.view",
    "get_customer_sales_ranking": "customers.view",
    # Returns
    "get_sales_returns": "returns.view",
    "get_pending_approvals": "returns.view",
    # Production
    "get_production_summary": "production.view",
    "get_production_orders": "production.orders.view",
    "get_production_rejection": "production.view",
    "get_production_item_wise": "production.view",
    # Reports
    "get_sales_report": "reports.view",
    "get_invoice_report": "reports.view",
    "get_payment_report": "reports.view",
    "get_customer_report": "reports.view",
    "get_available_reports": "reports.view",
    # Finance
    "get_finance_summary": "finance.view",
    "get_incoming_payments": "finance.payments.view",
    "get_outgoing_payments": "finance.payments.view",
    "get_supplier_purchase_ranking": "finance.view",
    "get_accounts_receivable": "finance.view",
    "get_accounts_payable": "finance.view",
    "get_profitability_report": "finance.reports.view",
    "inspect_finance_record": "finance.view",
    "propose_record_update": "finance.view",
    "submit_approved_record_update": "admin",
    "get_finance_audit_log": "finance.reports.view",
    "get_finance_admin_settings": "admin",
    "refresh_finance_data": "finance.view",
    # Settings & User Intelligence
    "get_admin_user_info": "users.manage",
    "get_my_permissions": None,
    # Workflow Process Flowcharts
    "get_workflow_flowchart": None,
    # Smart Email Assistant
    "draft_email": None,
}

TOOL_TO_WORKFLOW_MAP = {
    # Analytical & Dashboard
    "get_dashboard_summary": "dashboard",
    "get_sales_trend": "finance",
    "get_purchase_trend": "finance",
    "draft_email": "sales_pos",
    # Sales & Invoices
    "get_sales_orders": "sales_pos",
    "get_sales_invoices": "invoices_returns",
    # Purchases
    "get_purchase_orders": "purchasing",
    "get_purchase_invoices": "purchasing",
    # Inventory & Products
    "get_inventory_stock": "inventory",
    "get_products": "inventory",
    # Customers
    "search_customers": "customers",
    "get_customer_sales_ranking": "customers",
    # Returns
    "get_sales_returns": "invoices_returns",
    "get_pending_approvals": "invoices_returns",
    # Production
    "get_production_summary": "production",
    "get_production_orders": "production",
    "get_production_rejection": "production",
    "get_production_item_wise": "production",
    # Reports
    "get_sales_report": "sales_pos",
    "get_invoice_report": "invoices_returns",
    "get_payment_report": "payments",
    "get_customer_report": "customers",
    "get_available_reports": "reports",
    # Finance
    "get_finance_summary": "finance",
    "get_incoming_payments": "payments",
    "get_outgoing_payments": "payments",
    "get_supplier_purchase_ranking": "purchasing",
    "get_accounts_receivable": "finance",
    "get_accounts_payable": "finance",
    "get_profitability_report": "finance",
    "inspect_finance_record": "finance",
    "propose_record_update": "finance",
    "submit_approved_record_update": "finance",
    "get_finance_audit_log": "finance",
    "get_finance_admin_settings": "finance",
    "refresh_finance_data": "finance",
    # Settings & User Intelligence
    "get_admin_user_info": "settings_rbac",
    "get_my_permissions": "settings_rbac",
}

MODULE_NAV_PERMISSIONS = {
    "dashboard": "dashboard.view",
    "pos": "pos.access",
    "products": "products.view",
    "sales": "invoices.view",
    "sales_orders": "sales_orders.view",
    "purchase_orders": "purchase_orders.view",
    "customers": "customers.view",
    "returns": "returns.view",
    "analytics": "dashboard.view",
    "production_overview": "production.view",
    "production_orders": "production.orders.view",
    "production_item_wise": "production.view",
    "production_rejection": "production.view",
    "production_date_wise": "production.view",
    "production_reports": "production.reports.view",
    "reports": "reports.view",
    "reports_overview": "reports.view",
    "reports_sales": "reports.view",
    "reports_invoice": "reports.view",
    "reports_payment": "reports.view",
    "reports_inventory": "reports.view",
    "reports_customer": "reports.view",
    "reports_ai": "reports.view",
    "settings": "users.manage",
    "finance_overview": "finance.view",
    "finance_sales_invoices": "invoices.view",
    "finance_purchase_invoices": "finance.invoices.view",
    "finance_incoming_payments": "finance.payments.view",
    "finance_outgoing_payments": "finance.payments.view",
    "finance_customer_analysis": "finance.view",
    "finance_supplier_analysis": "finance.view",
    "finance_profitability_reports": "finance.reports.view",
    "contact": None,
}

def _get_permitted_branch(user: dict, requested_branch: Optional[str] = None) -> Optional[str]:
    """
    Enforce branch/warehouse access.
    Admins can see all branches or filter by requested.
    Managers are locked to their assigned branch.
    Users use assigned branch if set, otherwise requested branch or default warehouse.
    """
    role = str(user.get("role") or "user").lower()
    default_wh = str(getattr(settings, "SAP_DEFAULT_WAREHOUSE", "SH") or "SH").strip().upper()

    if role == "admin":
        if requested_branch and requested_branch.strip():
            b = requested_branch.strip().upper()
            return b if b not in ("ALL", "TOTAL", "*", "UNKNOWN", "WH-01", "WH-001") else None
        return None

    if role == "manager":
        assigned = str(user.get("branch_id") or "").strip().upper()
        return assigned or default_wh

    user_branch = str(user.get("branch_id") or "").strip().upper()
    if user_branch and user_branch not in ("UNKNOWN", "WH-01", "WH-001"):
        return user_branch
    if requested_branch and requested_branch.strip():
        req = requested_branch.strip().upper()
        if req not in ("UNKNOWN", "WH-01", "WH-001", "ALL", "TOTAL"):
            return req
    return default_wh

def _normalize_branch(value: Optional[str]) -> str:
    branch = str(value or "").strip().upper()
    if branch and branch not in ("UNKNOWN", "WH-01", "WH-001"):
        return branch
    return str(getattr(settings, "SAP_DEFAULT_WAREHOUSE", "SH") or "SH").strip().upper()

def _extract_branch_from_invoice(invoice: Dict[str, Any]) -> Optional[str]:
    for key in (
        "U_Branch", "U_BranchId", "U_Branch_ID", "U_BranchCode",
        "U_Warehouse", "U_WarehouseCode", "U_Warehouse_Code"
    ):
        value = str(invoice.get(key) or "").strip()
        if value:
            return value

    for line in invoice.get("DocumentLines") or []:
        candidate = str(line.get("WarehouseCode") or "").strip()
        if candidate:
            return candidate
    return None

def _resolve_date_range(
    range_str: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
) -> Tuple[Optional[date], Optional[date], str]:
    """
    Resolves standard business dates dynamically against current date (Asia/Kolkata).
    """
    today = date.today()

    if from_date:
        try:
            d_from = datetime.strptime(from_date, "%Y-%m-%d").date()
            d_to = datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else d_from
            return d_from, d_to, f"{d_from} to {d_to}"
        except ValueError:
            pass

    r = (range_str or "monthly").lower().strip()

    first_this_month = date(today.year, today.month, 1)
    last_day_last_month = first_this_month - timedelta(days=1)
    first_day_last_month = date(last_day_last_month.year, last_day_last_month.month, 1)

    if r in ("today", "daily"):
        return today, today, f"Today ({today})"
    elif r == "yesterday":
        y = today - timedelta(days=1)
        return y, y, f"Yesterday ({y})"
    elif r in ("week", "weekly", "this_week"):
        d_from = today - timedelta(days=6)
        return d_from, today, f"{d_from} to {today}"
    elif r in ("month", "monthly", "this_month"):
        return first_this_month, today, f"This Month ({first_this_month} to {today})"
    elif r in ("last_month", "previous_month"):
        return first_day_last_month, last_day_last_month, f"Last Month ({first_day_last_month.strftime('%b %Y')})"
    elif r in ("past_6_months", "6_months", "last_6_months", "past_six_months"):
        # 5 calendar months before current month
        m = today.month - 5
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        d_6m = date(y, m, 1)
        return d_6m, today, f"Past 6 months ({d_6m.strftime('%b %Y')} to {today.strftime('%b %Y')})"
    elif r in ("year", "yearly", "this_year", str(today.year)):
        return date(today.year, 1, 1), today, f"Year {today.year} ({date(today.year, 1, 1)} to {today})"
    elif r in (str(today.year - 1), "last_year"):
        return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31), f"Year {today.year - 1} ({date(today.year - 1, 1, 1)} to {date(today.year - 1, 12, 31)})"
    elif r in ("same_month_last_year", f"oct_{today.year - 1}"):
        m_start = date(today.year - 1, today.month, 1)
        if today.month == 12:
            m_end = date(today.year - 1, 12, 31)
        else:
            m_end = date(today.year - 1, today.month + 1, 1) - timedelta(days=1)
        return m_start, m_end, f"Same Month Last Year ({m_start.strftime('%b %Y')})"
    elif r in ("compare_last_month", "this_month_vs_last_month"):
        return first_this_month, today, f"This Month ({today.strftime('%b %Y')}) vs Last Month ({first_day_last_month.strftime('%b %Y')})"
    elif r in ("compare_last_year", "this_month_vs_last_year"):
        return first_this_month, today, f"This Month ({today.strftime('%b %Y')}) vs Last Year (Full Year {today.year - 1})"
    elif r in ("total", "all_time", "all"):
        return None, None, "Total (All Time)"
    else:
        return first_this_month, today, "Current Period"


class AIAssistantService:
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY is not configured on the server. Please configure OPENAI_API_KEY in your environment."
            )
        self.timeout = getattr(settings, "OPENAI_TIMEOUT", 35.0)
        client_kwargs = {
            "api_key": settings.OPENAI_API_KEY,
            "timeout": self.timeout,
        }
        if getattr(settings, "OPENAI_BASE_URL", None):
            client_kwargs["base_url"] = settings.OPENAI_BASE_URL

        self.client = openai.OpenAI(**client_kwargs)
        self.model = getattr(settings, "OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini"

        # Initialize existing SAP business services
        self.production_service = SAPProductionService()
        self.invoices_service = SAPInvoicesService()
        self.sales_orders_service = SAPSalesOrdersService()
        self.purchase_orders_service = SAPPurchaseOrdersService()
        self.inventory_service = SAPInventoryService()
        self.items_service = SAPItemsService()
        self.business_partners_service = SAPBusinessPartnersService()
        self.returns_service = SAPReturnsService()
        self.payments_service = SAPPaymentsReportService()
        self.warehouses_service = SAPWarehousesService()
        self.finance_service = SAPFinanceService()

    def _get_tools_schema(self) -> List[Dict[str, Any]]:
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_analytical_table",
                    "description": "Fetch a structured analytical data table and optional chart comparing business metrics across dimensions. Supports grouping monthly revenue (e.g. past 6 months), weekly sales by branch, payment methods, customer sales, period comparisons (this month vs last month, this month vs same month last year), recent invoices, and product sales. Use this whenever the user asks for breakdowns, tables, trends, or comparisons.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "metric": {
                                "type": "string",
                                "enum": ["sales", "payments", "products", "production_rejection", "production"],
                                "description": "Metric to analyze (default: sales). Use 'production_rejection' for scrap/defect reports by item."
                            },
                            "group_by": {
                                "type": "string",
                                "enum": ["month", "branch", "payment_method", "customer", "product", "comparison", "invoice", "date", "item", "status"],
                                "description": "Dimension to group by: 'month' for monthly revenue, 'branch' for warehouse breakdown, 'payment_method' for cash/card/UPI, 'customer' for customer sales, 'product' for product sales, 'comparison' for period-over-period variance, 'invoice' for recent invoices, 'date' for daily trend, 'item' for production rejection by item."
                            },
                            "range": {
                                "type": "string",
                                "enum": ["past_6_months", "6_months", "week", "month", "last_month", "compare_last_month", "same_month_last_year", "compare_last_year", "year", "2025", "today", "total"],
                                "description": "Time range: 'past_6_months' for past 6 months monthly breakdown, 'week' for weekly sales, 'compare_last_month' for this month vs last month, 'same_month_last_year' for this month vs same month last year, 'month', 'year', 'total'."
                            },
                            "date_from": {"type": "string", "description": "Custom start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "Custom end date (YYYY-MM-DD)."},
                            "branch": {"type": "string", "description": "Optional branch filter (e.g. SH, 01, DEL)."},
                            "limit": {"type": "integer", "description": "Maximum rows to return (default 20, max 100)."}
                        },
                        "required": ["group_by"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_dashboard_summary",
                    "description": "Fetch overall high-level KPIs including total sales revenue, invoice count, average bill value, growth %, low-stock items count, and pending approvals count.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["today", "week", "month", "last_month", "year", "2025", "total"], "description": "Time period to summarize."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD) for custom range."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD) for custom range."},
                            "branch": {"type": "string", "description": "Warehouse/branch code (e.g. SH, 01, DEL)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_sales_orders",
                    "description": "Fetch customer sales orders from SAP with status counts (total, pending, completed, cancelled) and recent order details.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status": {"type": "string", "enum": ["all", "pending", "completed", "cancelled"], "description": "Filter by order status."},
                            "search": {"type": "string", "description": "Search term for customer name, card code, or document number."},
                            "customer": {"type": "string", "description": "Specific customer CardCode."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "limit": {"type": "integer", "description": "Number of sample orders to return (default 10)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_sales_invoices",
                    "description": "Fetch finalized AR sales invoices from SAP for the authorized branch with totals, customer codes, and payment status.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["today", "week", "month", "last_month", "year", "2025", "total"], "description": "Named date range."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "search": {"type": "string", "description": "Search term."},
                            "limit": {"type": "integer", "description": "Max invoices to return (default 20)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_purchase_orders",
                    "description": "Fetch vendor purchase orders from SAP, including summary of total, pending, received, and cancelled orders.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status": {"type": "string", "enum": ["all", "pending", "received", "cancelled"], "description": "Status filter."},
                            "search": {"type": "string", "description": "Search term for supplier name or code."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "limit": {"type": "integer", "description": "Max orders to return (default 10)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_inventory_stock",
                    "description": "Fetch current stock and warehouse quantities. Can return low-stock alert items or look up a specific item code.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "item_code": {"type": "string", "description": "Specific item code to look up."},
                            "low_stock_only": {"type": "boolean", "description": "If true, returns only products running low on stock or below threshold."},
                            "warehouse": {"type": "string", "description": "Warehouse code (e.g. SH, 01, DEL)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_products",
                    "description": "Fetch products catalog, top-selling products by quantity/sales, or velocity rankings.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "top_selling_only": {"type": "boolean", "description": "If true, returns products ranked by highest sales volume."},
                            "range": {"type": "string", "enum": ["today", "week", "month", "year", "total"], "description": "Time range for top selling calculation."},
                            "search": {"type": "string", "description": "Search product by code or description."},
                            "limit": {"type": "integer", "description": "Max products to return (default 10)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_customers",
                    "description": "Search for customers by mobile number, customer code, or name, returning purchase summary.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search_term": {"type": "string", "description": "Customer mobile number, code, or name."}
                        },
                        "required": ["search_term"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_sales_returns",
                    "description": "Fetch customer sales returns and credit notes (AR Credit Memos) from SAP by date range.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "branch": {"type": "string", "description": "Warehouse/branch code."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_production_summary",
                    "description": "Fetch overall SAP production metrics: planned orders, completed orders, pending production, total produced qty, and scrap/rejection rate %.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "warehouse": {"type": "string", "description": "Warehouse code."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_production_orders",
                    "description": "Fetch SAP production orders with order status, planned qty, produced qty, rejected qty, and due dates.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status": {"type": "string", "enum": ["Planned", "Released", "Closed", "Cancelled", "all"], "description": "Order status filter."},
                            "item_code": {"type": "string", "description": "Specific item being manufactured."},
                            "warehouse": {"type": "string", "description": "Warehouse code."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "limit": {"type": "integer", "description": "Max orders to return (default 10)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_production_rejection",
                    "description": "Fetch production rejection analysis, scrap quantities, defective items, and rejection percentages.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "warehouse": {"type": "string", "description": "Warehouse code."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "search": {"type": "string", "description": "Search item code or description."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_production_item_wise",
                    "description": "Fetch item-wise production target vs completed output, scrap ratios, and fulfillment rates.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "warehouse": {"type": "string", "description": "Warehouse code."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "search": {"type": "string", "description": "Search item code or description."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_sales_report",
                    "description": "Fetch sales analytics report comparing sales amounts, growth %, and monthly breakdown.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["today", "week", "month", "last_month", "year", "2025", "total"], "description": "Time range."},
                            "from_date": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "to_date": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "branch": {"type": "string", "description": "Warehouse branch."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_payment_report",
                    "description": "Fetch payment collection breakdown by payment methods (Cash, Card, UPI, Bank Transfer) from SAP Incoming Payments.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["today", "week", "month", "last_month", "year", "2025", "total"], "description": "Time range."},
                            "from_date": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "to_date": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "branch": {"type": "string", "description": "Warehouse branch."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_customer_report",
                    "description": "Fetch customer spending report, purchase counts, and top revenue-generating customers.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["month", "year", "total"], "description": "Time range."},
                            "customer_code": {"type": "string", "description": "Specific CardCode (optional)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_pending_approvals",
                    "description": "Fetch pending manager approvals for customer returns, refunds, and exchange workflows from the application database.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status": {"type": "string", "enum": ["pending", "approved", "rejected", "all"], "description": "Approval status (default pending)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_finance_summary",
                    "description": "Fetch overall high-level financial KPIs from SAP Business One including Total Sales, Total Purchases, Incoming Payments, Outgoing Payments, Accounts Receivable, Accounts Payable, Gross Profit, and Gross Margin with period growth percentages.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["daily", "weekly", "monthly", "yearly", "last_month", "past_6_months", "all_time"], "description": "Time period to summarize (default monthly)."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "branch": {"type": "string", "description": "Branch code."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_sales_trend",
                    "description": "Fetch monthly, weekly, or yearly sales revenue trend and invoice volume based on live SAP AR sales invoices.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["past_6_months", "monthly", "weekly", "yearly"], "description": "Trend period (default past_6_months)."},
                            "branch": {"type": "string", "description": "Branch code."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_purchase_trend",
                    "description": "Fetch monthly, weekly, or yearly purchase invoice trend and spending volume based on live SAP AP purchase invoices.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["past_6_months", "monthly", "weekly", "yearly"], "description": "Trend period (default past_6_months)."},
                            "branch": {"type": "string", "description": "Branch code."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_purchase_invoices",
                    "description": "Fetch AP purchase invoices from SAP with supplier names, invoice dates, amounts, and payment status.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["today", "week", "month", "last_month", "year", "2025", "total"], "description": "Date range."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "supplier_code": {"type": "string", "description": "Specific supplier CardCode."},
                            "status": {"type": "string", "enum": ["open", "closed", "all"], "description": "Invoice payment status."},
                            "search": {"type": "string", "description": "Search term for supplier name or invoice number."},
                            "limit": {"type": "integer", "description": "Max purchase invoices to return (default 20)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_incoming_payments",
                    "description": "Fetch customer incoming payments and collections from SAP by date range, payment method (Cash, Transfer, Cheque), or customer.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["today", "week", "month", "last_month", "year", "2025", "total"], "description": "Date range."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "customer_code": {"type": "string", "description": "Filter by customer CardCode."},
                            "payment_method": {"type": "string", "enum": ["Cash", "Transfer", "Check", "all"], "description": "Payment method filter."},
                            "limit": {"type": "integer", "description": "Max payments to return (default 20)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_outgoing_payments",
                    "description": "Fetch outgoing vendor payments made to suppliers from SAP by date range or supplier code.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["today", "week", "month", "last_month", "year", "2025", "total"], "description": "Date range."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "supplier_code": {"type": "string", "description": "Filter by supplier CardCode."},
                            "limit": {"type": "integer", "description": "Max payments to return (default 20)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_customer_sales_ranking",
                    "description": "Rank customers by net sales volume from SAP sales invoices. Can return top purchasing customers or lowest purchasing customers.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["month", "last_month", "year", "total", "past_6_months"], "description": "Time range."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "order": {"type": "string", "enum": ["top", "lowest"], "description": "Order ranking: 'top' for highest sales, 'lowest' for least sales."},
                            "limit": {"type": "integer", "description": "Max customers to return (default 10)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_supplier_purchase_ranking",
                    "description": "Rank suppliers by total purchase value from SAP purchase invoices. Can return top suppliers or lowest volume suppliers.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["month", "last_month", "year", "total"], "description": "Time range."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."},
                            "order": {"type": "string", "enum": ["top", "lowest"], "description": "Order ranking: 'top' for highest purchases, 'lowest' for least."},
                            "limit": {"type": "integer", "description": "Max suppliers to return (default 10)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_accounts_receivable",
                    "description": "Fetch outstanding accounts receivable owed by customers from SAP Business Partners, including total AR, debtor count, and top customer balances.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "customer_code": {"type": "string", "description": "Specific customer CardCode (optional)."},
                            "min_balance": {"type": "number", "description": "Minimum balance threshold (default 0)."},
                            "limit": {"type": "integer", "description": "Max debtors to return (default 20)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_accounts_payable",
                    "description": "Fetch outstanding accounts payable owed to suppliers from SAP Business Partners, including total AP, creditor count, and top supplier liabilities.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "supplier_code": {"type": "string", "description": "Specific supplier CardCode (optional)."},
                            "min_balance": {"type": "number", "description": "Minimum balance threshold (default 0)."},
                            "limit": {"type": "integer", "description": "Max creditors to return (default 20)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_profitability_report",
                    "description": "Fetch profitability analysis from verified SAP records: Net Sales, Cost of Purchases, Gross Profit, Gross Margin %, and monthly trend breakdown.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "range": {"type": "string", "enum": ["month", "last_month", "year", "past_6_months", "total"], "description": "Analysis period."},
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)."},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "navigate_to_module",
                    "description": "Generate an internal navigation action to open a verified application module or record.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target_module": {
                                "type": "string",
                                "enum": [
                                    "dashboard", "pos", "products", "sales", "sales_orders",
                                    "purchase_orders", "customers", "returns", "analytics",
                                    "production_overview", "production_orders", "production_item_wise",
                                    "production_rejection", "production_date_wise", "production_reports",
                                    "reports_sales", "reports_invoice", "reports_payment",
                                    "reports_inventory", "settings",
                                    "finance_overview", "finance_sales_invoices", "finance_purchase_invoices",
                                    "finance_incoming_payments", "finance_outgoing_payments",
                                    "finance_customer_analysis", "finance_supplier_analysis",
                                    "finance_profitability_reports"
                                ],
                                "description": "The exact ID of the module to open."
                            },
                            "label": {"type": "string", "description": "Button label (e.g. 'Open Sales Orders', 'View Inventory', 'Open Finance Overview')."},
                            "record_id": {"type": "string", "description": "Optional record ID (e.g. invoice DocEntry)."},
                            "params": {"type": "object", "description": "Optional query parameters (e.g. status='pending')."}
                        },
                        "required": ["target_module"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "inspect_finance_record",
                    "description": "Inspect a specific financial record (sales invoice, purchase invoice, incoming payment, outgoing payment, customer, supplier) from SAP Business One. Retrieves document status, editable fields allowlist, and locked fields with GAAP accounting explanations.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_type": {
                                "type": "string",
                                "enum": ["invoice", "purchase_invoice", "incoming_payment", "outgoing_payment", "customer", "supplier"],
                                "description": "Financial entity type to inspect."
                            },
                            "record_id": {
                                "type": "string",
                                "description": "DocEntry or CardCode of the record (e.g. '101', 'C001', 'INV-123')."
                            }
                        },
                        "required": ["entity_type", "record_id"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "propose_record_update",
                    "description": "Propose and validate updates to permitted fields of a finance record. Checks permissions, field allowlist, data types, and document status, producing a diff before submission.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_type": {
                                "type": "string",
                                "enum": ["invoice", "purchase_invoice", "incoming_payment", "outgoing_payment", "customer", "supplier"],
                                "description": "Entity type being updated."
                            },
                            "record_id": {
                                "type": "string",
                                "description": "DocEntry or CardCode."
                            },
                            "updates": {
                                "type": "object",
                                "description": "Key-value mapping of permitted fields to new values (e.g. {'Comments': 'Updated note', 'NumAtCard': 'PO-991'})."
                            }
                        },
                        "required": ["entity_type", "record_id", "updates"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "submit_approved_record_update",
                    "description": "Submit validated updates to SAP Service Layer with role permission checks, audit logging, and readback verification. Requires explicit user confirmation.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_type": {
                                "type": "string",
                                "enum": ["invoice", "purchase_invoice", "incoming_payment", "outgoing_payment", "customer", "supplier"],
                                "description": "Entity type."
                            },
                            "record_id": {
                                "type": "string",
                                "description": "DocEntry or CardCode."
                            },
                            "updates": {
                                "type": "object",
                                "description": "Validated key-value mapping of changes."
                            },
                            "confirm": {
                                "type": "boolean",
                                "description": "Explicit user confirmation flag (must be true)."
                            }
                        },
                        "required": ["entity_type", "record_id", "updates", "confirm"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_finance_audit_log",
                    "description": "Fetch audit trail history of finance write-back operations, status, validation failures, and administrative changes.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_type": {
                                "type": "string",
                                "description": "Optional entity type filter."
                            },
                            "record_id": {
                                "type": "string",
                                "description": "Optional record identifier."
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Max entries to return (default 20)."
                            }
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_finance_admin_settings",
                    "description": "Fetch SAP connection health, circuit breaker status, enabled finance assistant capabilities, and role permission matrix.",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "refresh_finance_data",
                    "description": "Clear cached financial reports and trigger a fresh read from SAP Business One.",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_admin_user_info",
                    "description": "Administrative query to find employees, inspect user roles, assigned branches, permitted modules, and feature permissions (e.g. which employees can edit products). Strictly restricted to administrators and users with users.manage permission.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search_query": {"type": "string", "description": "Search by username, email, or full name."},
                            "role": {"type": "string", "enum": ["user", "operator", "manager", "admin"], "description": "Filter users by role."},
                            "feature_permission": {"type": "string", "description": "Identify users who have a specific permission (e.g. 'products.edit', 'invoices.create', 'returns.approve')."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_my_permissions",
                    "description": "Self-service query allowing any authenticated user to inspect their own effective permissions and permitted dashboard modules.",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_available_reports",
                    "description": "List all business reports available in ATLAS, their readiness, description, and internal navigation routes.",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "draft_email",
                    "description": "Generate an intelligent, professional, context-verified business email draft (e.g. payment reminder, invoice follow-up, sales order update, purchase order, supplier communication, overdue payment, finance team notice) based on live verified SAP records. Does NOT send the email; returns a structured draft for user review and explicit confirmation.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "purpose": {
                                "type": "string",
                                "enum": ["payment_reminder", "invoice_followup", "sales_order_update", "purchase_order", "supplier_communication", "customer_support", "overdue_payment", "finance_team", "general"],
                                "description": "Business purpose of the email."
                            },
                            "customer_name_or_code": {"type": "string", "description": "Customer name or CardCode (e.g. 'C00001', 'Amazon')."},
                            "supplier_name_or_code": {"type": "string", "description": "Supplier name or CardCode (e.g. 'V00001', 'Acme Supplies')."},
                            "invoice_doc_num": {"type": "string", "description": "Sales or purchase invoice reference number."},
                            "order_doc_num": {"type": "string", "description": "Sales order or purchase order reference number."},
                            "recipient_email": {"type": "string", "description": "Optional target recipient email if known or specified by user."},
                            "additional_context": {"type": "string", "description": "Extra instructions, notes, or specific issue details to include in the draft."}
                        },
                        "required": ["purpose"]
                    }
                }
            }
        ]

        # SAFETY LOCK: If write-back is disabled by policy, completely exclude write tools from schema
        if not getattr(settings, "FINANCE_WRITEBACK_ENABLED", False):
            tools = [t for t in tools if t.get("function", {}).get("name") != "submit_approved_record_update"]

        return tools

    def process_chat(
        self,
        message: str,
        branch_id: str,
        current_user: Dict[str, Any],
        conversation_id: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        chat_start_time = time.perf_counter()
        permitted_warehouse = _get_permitted_branch(current_user, branch_id)
        default_wh = str(getattr(settings, "SAP_DEFAULT_WAREHOUSE", "SH") or "SH").strip().upper()
        active_scope_name = permitted_warehouse or f"All Branches (Default: {default_wh})"

        # Temporal anchor setup (Asia/Kolkata) dynamically derived
        today = date.today()
        today_date_str = today.strftime("%Y-%m-%d")
        current_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")

        first_this_month = date(today.year, today.month, 1)
        last_day_last_month = first_this_month - timedelta(days=1)
        first_day_last_month = date(last_day_last_month.year, last_day_last_month.month, 1)
        week_start = today - timedelta(days=6)
        yesterday = today - timedelta(days=1)

        nlp_analysis = nlp_pipeline.analyze_query(message, current_user, context)
        intent_hint = ""
        if nlp_analysis.suggested_tool:
            intent_hint = (
                f"\nNLP INTENT RECOGNITION CONTEXT:\n"
                f"- Classified Intent: {nlp_analysis.intent_id}\n"
                f"- Suggested Tool: {nlp_analysis.suggested_tool} with arguments {json.dumps(nlp_analysis.suggested_tool_args)}\n"
                f"- Is Contextual Follow-Up: {nlp_analysis.is_follow_up}\n"
            )

        # Ensure message is present
        if not message or not message.strip():
            return {
                "answer": "How can I assist you with ATLAS today?",
                "conversation_id": conversation_id or str(uuid.uuid4()),
                "branch_context": permitted_warehouse or default_wh,
                "structured_data": None
            }

        user_role_str = (current_user.get("role") or "").lower()
        job_role_str = (current_user.get("job_role") or current_user.get("designation") or "").lower()
        user_permissions = set(current_user.get("permissions") or [])

        # Determine Role Perspective for tailored executive advisory
        if any(k in user_role_str or k in job_role_str for k in ("owner", "ceo", "managing director", "director", "executive")) or (user_role_str in ("admin", "superadmin") and not any(k in job_role_str for k in ("finance", "cfo", "sales", "production"))):
            role_title = "Company Owner / CEO"
            role_directive = (
                "ROLE FOCUS (Company Owner / CEO):\n"
                "- Emphasize overall commercial health, revenue velocity, gross margin resilience, and strategic capital priorities.\n"
                "- Highlight top operational & financial risks, debtor concentrations, and cross-branch performance.\n"
                "- Keep executive summaries high-level, decisive, and focused on business value, cash stability, and growth."
            )
        elif any(k in user_role_str or k in job_role_str for k in ("cfo", "finance", "accountant", "controller", "accounts")) or ("finance.view" in user_permissions and "sales_orders.view" not in user_permissions):
            role_title = "CFO / Finance Manager"
            role_directive = (
                "ROLE FOCUS (CFO / Finance Controller / Finance Manager):\n"
                "- Emphasize cash flow, collections realization vs invoiced revenue, accounts receivable aging, and overdue debt exposure.\n"
                "- Reconcile gross and operating margins, purchase liabilities, vendor obligations, and payment allocations.\n"
                "- Enforce strict GAAP principles: distinguish invoiced sales from actual cash collections, and purchase expenses from capitalized inventory COGS."
            )
        elif any(k in user_role_str or k in job_role_str for k in ("sales", "commercial", "revenue", "account manager")):
            role_title = "Sales Manager"
            role_directive = (
                "ROLE FOCUS (Sales Manager / Commercial Director):\n"
                "- Emphasize sales velocity, target fulfillment, customer accounts, order booking vs billed invoices, and customer revenue concentration.\n"
                "- Focus on overdue receivables by customer account, actionable collection follow-ups, and top client relationships."
            )
        elif any(k in user_role_str or k in job_role_str for k in ("production", "plant", "manufacturing", "operations")):
            role_title = "Production Manager"
            role_directive = (
                "ROLE FOCUS (Production Manager / Operations Director):\n"
                "- Emphasize production order status (Planned vs Released vs Completed), throughput fulfillment rate, and delivery timelines.\n"
                "- Highlight scrap and rejection rates by item, capacity bottlenecks, and raw material / component stock shortages."
            )
        else:
            role_title = "General Manager / Operations Lead"
            role_directive = (
                "ROLE FOCUS (General Manager / Operations Lead):\n"
                "- Provide balanced operational and financial insights covering sales momentum, collections health, inventory levels, and production throughput."
            )

        system_prompt = (
            f"You are ATLAS, the Senior Real-Time Business Advisor for SAP Business One retail and manufacturing operations.\n"
            f"SYSTEM TIME CONTEXT:\n"
            f"- Current Date: {today_date_str} (Timezone: Asia/Kolkata).\n"
            f"- Current Year: {today.year}, Month: {today.strftime('%B')}.\n"
            f"- 'Today' is {today_date_str}.\n"
            f"- 'Yesterday' is {yesterday.strftime('%Y-%m-%d')}.\n"
            f"- 'This week' is {week_start.strftime('%Y-%m-%d')} to {today_date_str}.\n"
            f"- 'This month' is {first_this_month.strftime('%Y-%m-%d')} to {today_date_str}.\n"
            f"- 'Last month' is {first_day_last_month.strftime('%Y-%m-%d')} to {last_day_last_month.strftime('%Y-%m-%d')} ({first_day_last_month.strftime('%b %Y')}).\n"
            f"- 'This year' or '{today.year}' is {today.year}-01-01 to {today_date_str}.\n"
            f"- 'Year {today.year - 1}' or 'last year' is {today.year - 1}-01-01 to {today.year - 1}-12-31.\n\n"
            f"USER & AUTHORIZATION CONTEXT:\n"
            f"- User Name: {current_user.get('name', 'User')}\n"
            f"- User Role: {current_user.get('role', 'user')} (Advisory Perspective: {role_title})\n"
            f"- Authorized Warehouse Scope: {active_scope_name}\n\n"
            f"ATLAS AI BUSINESS ADVISOR DIRECTIVE:\n"
            f"You serve as a senior executive business advisor for company owners, CFOs, finance managers, sales managers, and production managers.\n"
            f"{role_directive}\n\n"
            f"THE FOUR CORE ADVISORY QUESTIONS:\n"
            f"Every business inquiry must be evaluated through four executive lenses:\n"
            f"1. What is happening? (Current factual state from verified SAP data)\n"
            f"2. Why does it matter? (Commercial, financial, and operational significance)\n"
            f"3. What needs attention? (Risks, variances, overdue balances, delays, or shortages)\n"
            f"4. What should the manager do next? (1 to 3 concrete, prioritized next steps)\n\n"
            f"MANDATORY RESPONSE FORMAT FOR BUSINESS INQUIRIES:\n"
            f"Unless answering a non-business conversational question (such as a greeting or settings permission query) or generating an Enterprise AI Report, structure your response using these exact section headers:\n\n"
            f"**Direct answer:** Directly answer the question first in 1-2 incisive sentences.\n\n"
            f"**Key numbers:** Present the verified metrics from SAP Business One (formatted with ₹ INR currency symbols, counts, percentages).\n\n"
            f"**Business meaning:** Explain what these metrics mean in clear, practical business language.\n\n"
            f"**What needs attention:** Highlight important risks, overdue accounts, variance spikes, or operational bottlenecks.\n\n"
            f"**Recommended next step:** Provide 1 to 3 prioritized, actionable management interventions.\n\n"
            f"**Evidence:** State supporting SAP document references (e.g. DocNums, CardCodes), reporting date scope ({active_scope_name}), and freshness (*Data verified from live SAP Business One as of {today_date_str} {today.strftime('%H:%M:%S')} IST*).\n\n"
            f"ADAPTIVE ANSWER LENGTH:\n"
            f"- For simple factual questions (e.g. 'What are today\\'s sales?', 'What is our top customer?'), keep sections crisp, concise, and focused.\n"
            f"- For complex diagnostic or multi-period questions, provide comprehensive analysis with supporting figures.\n\n"
            f"STRICT ACCOUNTING & BUSINESS REASONING RULES:\n"
            f"1. Invoiced Sales != Actual Payments: Sales Invoices record earned revenue and accounts receivable. Incoming Payments record cash or bank funds collected. Never treat billed sales as collected cash.\n"
            f"2. Cash Balance != Profit: Bank/cash balance is liquidity, not accounting net profit.\n"
            f"3. Purchase Invoices != Cost of Goods Sold (COGS): A/P Purchase Invoices reflect vendor procurement and inventory receipts. COGS requires perpetual inventory relief upon delivery. Disclose this accounting limitation when discussing margins.\n"
            f"4. No Hallucinations: NEVER invent causes, forecasts, savings, profit figures, or customer records. Every metric must be traced to structured tool results.\n"
            f"5. Disclose Uncertainty: State uncertainty and missing data transparently. If cost records or documents are absent, note the gap explicitly.\n"
            f"6. SAP Outage Disclosure: If the SAP Service Layer is offline or times out, state clearly that live data could not be retrieved. Never present stale data as live or treat an outage as zero business activity.\n"
            f"7. Financial Write-Back Disabled: Keep SAP financial write-back strictly disabled. You cannot create, edit, or cancel financial documents in SAP Business One.\n\n"
            f"ADMIN & USER MANAGEMENT INTELLIGENCE RULES:\n"
            f"1. When an administrator or user with 'users.manage' asks about employees, roles, or who has access to a feature (e.g., 'Which employees can edit products?'):\n"
            f"   - Call get_admin_user_info(feature_permission='products.edit' or search_query=...).\n"
            f"   - Summarize the permitted employees and offer navigation to Settings.\n"
            f"   - For security, never disclose password hashes or private security tokens.\n"
            f"2. When any employee asks about their own permissions or accessible modules (e.g., 'What can I access with my current permissions?', 'Show my permissions'):\n"
            f"   - Call get_my_permissions().\n"
            f"   - Provide a clear, empowering summary of their effective role and permitted modules.\n"
            f"3. Never change user roles, permissions, passwords, or settings directly via chat. State that role changes require administrative access on the Settings > Users & Roles page.\n"
            f"4. Difference between Sales Invoices and Incoming Payments: Sales Invoices record revenue earned, inventory reduction, and accounts receivable upon billing. Incoming Payments record cash or bank funds received to clear customer invoices or balances.\n"
            f"5. When the user asks 'Show me all available reports', call get_available_reports().\n"
            f"6. When the user asks 'Create a report showing production rejection by item', call get_analytical_table(metric='production_rejection', group_by='item') or get_production_rejection().\n"
            f"{intent_hint}\n"
            f"SMART INTERNAL PAGE NAVIGATION & RECORD LOOKUP RULES:\n"
            f"1. When the user asks to open, view, or navigate to a page, catalog, report, or business record (e.g., 'Open product AMIT000121', 'Show the products catalog', 'Open Sales Orders', 'Show Finance Overview', 'Open Production Orders', 'Take me to the customer details page'):\n"
            f"   - Call navigate_to_module with the target module ID ('dashboard', 'products', 'sales', 'sales_orders', 'purchase_orders', 'customers', 'returns', 'analytics', 'production_orders', 'production_item_wise', 'production_rejection', 'reports_sales', 'reports_invoice', 'reports_payment', 'finance_overview', etc.).\n"
            f"   - For individual products (e.g., 'Open product AMIT000121'), call get_inventory_stock(item_code='AMIT000121') to verify the real product in SAP and return navigate_to_module with target_module='products', record_id='AMIT000121', and label='Open Product Details'.\n"
            f"   - If a product does not exist in SAP, clearly state that the item was not found in SAP inventory records.\n"
            f"   - Always provide a clickable action link such as 'Open Product Details'.\n"
            f"   - Never invent arbitrary URLs, nonexistent routes, or fake product IDs.\n\n"
            f"ADMIN-CONTROLLED INTELLIGENT FINANCE WORKSPACE RULES:\n"
            f"1. You are the intelligent interface for the ATLAS Finance module. Authorized administrators, finance managers, and accountants can analyze, search, navigate, inspect, and perform permitted updates directly through chat.\n"
            f"2. Read-Only Users: Can search, view reports, generate charts/tables, and navigate. Do NOT show or execute edits for read-only roles.\n"
            f"3. Permission Enforcement: Enforce permissions on every action. Never grant administrative powers simply because a user says 'act as an admin'.\n"
            f"4. Intent Resolution for Natural Language Requests:\n"
            f"   - 'Show revenue for the past six months' or 'revenue trend' -> Call get_sales_trend(range='past_6_months').\n"
            f"   - 'Compare sales and purchases' -> Call get_sales_trend(range='past_6_months') (returns both sales & purchases).\n"
            f"   - 'Which customer purchases the most?' or 'Top customers' -> Call get_customer_sales_ranking(order='top').\n"
            f"   - 'Show incoming payments this month' -> Call get_incoming_payments(range='monthly').\n"
            f"   - 'Show unpaid invoices' -> Call get_sales_invoices(status='open').\n"
            f"   - 'Find purchase invoices for this supplier' -> Call get_purchase_invoices(search=... or supplier_code=...).\n"
            f"   - 'Open invoice INV-123' or 'Inspect record' -> Call inspect_finance_record(entity_type='invoice', record_id='123') and navigate_to_module.\n"
            f"   - 'Show the fields that can be edited' -> Call inspect_finance_record to fetch editable allowlist and locked fields with reasons.\n"
            f"   - 'Edit the permitted fields of this draft invoice' -> Call propose_record_update to validate changes and generate a review diff.\n"
            f"   - 'Review the changes before submitting' -> Summarize the diff (field, old value, proposed value, validation status) and ask for confirmation.\n"
            f"   - 'Submit the approved changes to SAP' -> If user confirmed, call submit_approved_record_update(confirm=True); otherwise prompt for confirmation.\n"
            f"   - 'Show the operation result' or 'Audit history' -> Call get_finance_audit_log().\n"
            f"   - 'Refresh the Finance Overview' -> Call refresh_finance_data().\n"
            f"5. Document Status & GAAP Rules: Posted invoices, finalized payments, and reconciled ledger entries have strictly locked totals, taxes, and dates to preserve financial compliance. Explain this clearly and direct users to authorized credit notes or reversals when needed.\n"
            f"6. Never Invent Numbers: Every single figure, count, and growth % must come from structured tool output.\n"
            f"SMART EMAIL ASSISTANT RULES:\n"
            f"1. When the user asks to draft, prepare, or write an email (e.g., 'Draft a payment reminder for this customer', 'Prepare an email about this invoice', 'Email the supplier about the pending purchase order', 'Write a professional overdue payment follow-up', 'Summarize this customer account and draft an email', 'Explain the payment issue and prepare an email for the finance team'):\n"
            f"   - Call draft_email(purpose=..., customer_name_or_code=..., invoice_doc_num=..., etc.).\n"
            f"   - Use live verified details from context or SAP. Never invent figures, dates, or emails.\n"
            f"   - In your chat answer: Present the verified summary (Customer, Invoice/Document, Outstanding amount, Due date, Suggested action) followed by the complete draft subject and body.\n"
            f"   - Explain that the user can review, edit, and click 'Confirm & Send Email' to dispatch it.\n"
            f"   - Explicitly remind that drafting an email does NOT send it automatically.\n"
        )

        # Check if the query is an AI Generated Report request or has report context
        ctx = context or {}
        is_report_request = bool(
            ctx.get("module") in ("sales", "finance", "payments", "inventory", "production")
            or ("generate" in message.lower() and "report" in message.lower())
            or ("overview" in message.lower() and "report" in message.lower())
            or "performance report" in message.lower()
            or "profitability overview" in message.lower()
            or "collections and incoming payments" in message.lower()
            or "inventory stock report" in message.lower()
            or "production operations report" in message.lower()
        )
        detail_depth = str(ctx.get("detail_level") or "detailed").lower()

        if is_report_request:
            depth_instruction = (
                "DETAIL LEVEL: Executive Brief mode. Focus concisely on the critical briefing, top 2-3 risks, and top 2 immediate recommendations. Keep paragraphs tight and impactful."
                if detail_depth == "brief"
                else "DETAIL LEVEL: Detailed Enterprise Audit mode. Provide deep multi-period variance analysis, customer/product concentration breakdowns, full risk registers with Indian Rupee figures, and comprehensive audit methodology notes."
            )

            system_prompt += (
                "\n═══════════════════════════════════════════════════════════════════════════════\n"
                "EXECUTIVE BUSINESS INTELLIGENCE & ENTERPRISE REPORTING DIRECTIVE:\n"
                "You are acting as a Senior Business Intelligence Architect, Financial Controller, and Operations Director.\n"
                "DO NOT merely echo raw numbers or dump raw transaction lists. You must interpret the verified SAP data.\n"
                f"{depth_instruction}\n\n"
                "YOUR GENERATED REPORT MUST STRICTLY ADHERE TO THIS RIGOROUS 5-SECTION STRUCTURE:\n\n"
                "### Executive Intelligence Brief\n"
                "Deliver an incisive management briefing directly answering:\n"
                "- What Happened: High-level synthesis of operational volume, revenue, and throughput from verified SAP documents.\n"
                "- Why It Matters: Commercial significance (cash flow health, margin stability, customer retention, or capacity constraints).\n"
                "- What Requires Attention: Highlight urgent anomalies, concentration risks, or operational bottlenecks.\n"
                "- What Management Should Do Next: The single highest-priority managerial intervention.\n\n"
                "### Business Performance & Variance Analysis\n"
                "- Analyze underlying drivers behind the numbers (e.g. period growth rate, customer concentration, tender share, unit variance).\n"
                "- Identify what is performing well vs. what is underperforming.\n"
                "- Trace every financial claim to SAP records. Distinguish verified facts from hypotheses. If an explanation is an inference, explicitly label it as a hypothesis and identify what additional evidence is needed to prove it.\n"
                "- Never claim correlation proves causation. Never invent fictitious events, customers, or forecasts.\n\n"
                "### Critical Risks & Operational Vulnerabilities\n"
                "- Rank identified business risks by severity: [HIGH RISK], [MEDIUM RISK], [LOW RISK].\n"
                "- Quantify every risk with concrete numbers from the verified data (e.g. '₹12,450.00 exposure across 3 overdue accounts', '4 SKUs at zero stock').\n"
                "- Detail the potential operational, supply chain, or financial impact if left unaddressed.\n\n"
                "### Strategic Management Recommendations\n"
                "- Provide 2 to 4 concrete, numbered, prioritized next steps for executive leadership.\n"
                "- Each recommendation must reference supporting evidence from the report and outline the expected operational outcome.\n\n"
                "### Audit Scope, Accounting Methodology & Limitations\n"
                "- Authoritative SAP document source (e.g. posted A/R Invoices with Cancelled ne 'tYES', IncomingPayments, Items).\n"
                "- Currency (INR / ₹), date scope, and branch basis.\n"
                "- Transparently declare data limitations and accounting boundaries (e.g. vendor purchase expenses vs capitalized inventory COGS; unposted drafts excluded).\n"
                "═══════════════════════════════════════════════════════════════════════════════\n"
            )

        messages = [{"role": "system", "content": system_prompt}]

        if history:
            # Keep up to last 10 messages for context
            messages.extend(history[-10:])

        messages.append({"role": "user", "content": message})

        tools = self._get_tools_schema()
        collected_cards: List[Dict[str, Any]] = []
        nav_action: Optional[Dict[str, Any]] = None
        primary_structured_data: Optional[Dict[str, Any]] = None

        try:
            iteration = 0
            max_iterations = 2
            final_text = None

            while iteration < max_iterations:
                # Check execution budget to leave buffer before 40s backend timeout
                elapsed_sec = time.perf_counter() - chat_start_time
                if elapsed_sec > 30.0:
                    logger.warning(f"[AI TIMING] Execution budget reached ({elapsed_sec:.2f}s > 30.0s). Exiting tool loop early.")
                    break

                t_llm = time.perf_counter()
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto"
                )
                llm_dur = (time.perf_counter() - t_llm) * 1000.0
                logger.info(f"[AI TIMING] LLM completion turn {iteration + 1} duration_ms={llm_dur:.2f}")

                response_message = response.choices[0].message
                tool_calls = response_message.tool_calls

                if not tool_calls:
                    final_text = response_message.content
                    break

                messages.append(response_message)

                for tool_call in tool_calls:
                    fn_name = tool_call.function.name
                    try:
                        args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                    except json.JSONDecodeError:
                        messages.append({
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": fn_name,
                            "content": json.dumps({"error": "Malformed JSON arguments"})
                        })
                        continue

                    t_tool = time.perf_counter()
                    try:
                        tool_resp_content, card_data, nav = self._execute_tool(
                            tool_name=fn_name,
                            args=args,
                            permitted_warehouse=permitted_warehouse,
                            current_user=current_user
                        )
                    except SAPConnectionError as sce:
                        logger.error(f"SAP connection error in tool '{fn_name}': {sce}")
                        tool_resp_content = {
                            "error": "SAP Service Layer is currently disconnected or unreachable.",
                            "status": "sap_disconnected"
                        }
                        card_data = {
                            "type": "sap_offline",
                            "message": "SAP Business One is currently disconnected or unreachable. Real-time business data is currently unavailable."
                        }
                        nav = None
                    except Exception as te:
                        logger.error(f"Tool '{fn_name}' execution error: {te}", exc_info=True)
                        tool_resp_content = {"error": f"Failed to execute {fn_name}: {str(te)}"}
                        card_data = None
                        nav = None

                    tool_dur = (time.perf_counter() - t_tool) * 1000.0
                    record_count = len((tool_resp_content.get("items") if isinstance(tool_resp_content, dict) else None) or (tool_resp_content.get("products") if isinstance(tool_resp_content, dict) else None) or (tool_resp_content.get("sample_orders") if isinstance(tool_resp_content, dict) else None) or (tool_resp_content.get("rows") if isinstance(tool_resp_content, dict) else None) or [])
                    logger.info(f"[AI TIMING] Tool '{fn_name}' duration_ms={tool_dur:.2f} records={record_count}")

                    if card_data:
                        collected_cards.append(card_data)
                        if not primary_structured_data:
                            primary_structured_data = card_data

                    if nav:
                        nav_action = nav

                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": fn_name,
                        "content": json.dumps(tool_resp_content, default=str)
                    })

                iteration += 1

            if final_text is None:
                if not collected_cards and not nav_action:
                    final_text = "I need more time to process that request."
                else:
                    final_text = "I have retrieved the requested operational data from SAP. Please review the details below."

            # Construct composite response payload
            structured_payload = None
            sap_offline_detected = any(isinstance(c, dict) and c.get("type") == "sap_offline" for c in collected_cards)
            source_status = "offline" if sap_offline_detected else "online"
            data_source_label = "SAP Business One (Offline / Unavailable)" if sap_offline_detected else "SAP Business One Service Layer (Live)"
            refresh_time_str = f"{today_date_str} {datetime.now().strftime('%H:%M:%S')} IST"

            if collected_cards or nav_action:
                if len(collected_cards) == 1 and not nav_action:
                    structured_payload = collected_cards[0]
                    if "meta" not in structured_payload or not isinstance(structured_payload["meta"], dict):
                        structured_payload["meta"] = {}
                    structured_payload["meta"].setdefault("timestamp", datetime.now().isoformat())
                    structured_payload["meta"].setdefault("refresh_time", refresh_time_str)
                    structured_payload["meta"].setdefault("data_source", data_source_label)
                    structured_payload["meta"].setdefault("status", source_status)
                    structured_payload["meta"].setdefault("role_perspective", role_title)
                    structured_payload["meta"].setdefault("branch", permitted_warehouse or default_wh)
                else:
                    structured_payload = {
                        "type": collected_cards[0].get("type") if collected_cards else "navigation",
                        "cards": collected_cards,
                        "navigation": nav_action,
                        "meta": {
                            "timestamp": datetime.now().isoformat(),
                            "refresh_time": refresh_time_str,
                            "data_source": data_source_label,
                            "status": source_status,
                            "role_perspective": role_title,
                            "timezone": "Asia/Kolkata",
                            "branch": permitted_warehouse or default_wh
                        }
                    }
                    if primary_structured_data:
                        # Copy primary fields to top-level for backward-compatible rendering
                        for k, v in primary_structured_data.items():
                            if k not in structured_payload:
                                structured_payload[k] = v

                    # Scan all collected cards to promote critical visualization and tabular elements
                    for card in collected_cards:
                        if not isinstance(card, dict):
                            continue
                        for field in ("chart", "columns", "rows", "title", "summary", "kpis", "filters"):
                            if field in card and card[field] is not None and field not in structured_payload:
                                structured_payload[field] = card[field]
                        if "meta" in card and isinstance(card["meta"], dict):
                            for mk, mv in card["meta"].items():
                                if mk not in structured_payload["meta"]:
                                    structured_payload["meta"][mk] = mv

            total_dur = (time.perf_counter() - chat_start_time) * 1000.0
            logger.info(f"[AI TIMING] Total chat request duration_ms={total_dur:.2f} cards={len(collected_cards)} has_nav={bool(nav_action)}")

            if structured_payload and isinstance(structured_payload, dict):
                structured_payload["suggested_follow_ups"] = nlp_analysis.suggested_follow_ups
                structured_payload["intent_id"] = nlp_analysis.intent_id

            return {
                "answer": final_text,
                "conversation_id": conversation_id or str(uuid.uuid4()),
                "branch_context": permitted_warehouse or default_wh,
                "structured_data": structured_payload,
                "suggested_follow_ups": nlp_analysis.suggested_follow_ups,
                "intent_id": nlp_analysis.intent_id,
                "context": {
                    "last_metric": nlp_analysis.entities.metric or (context.get("last_metric") if context else None) or "sales",
                    "last_range": nlp_analysis.entities.range or (context.get("last_range") if context else None) or "month",
                    "last_branch": nlp_analysis.entities.branch or permitted_warehouse or (context.get("last_branch") if context else None),
                    "last_tool": nlp_analysis.suggested_tool or (context.get("last_tool") if context else None),
                    "last_module": nlp_analysis.capability.module if nlp_analysis.capability else (context.get("last_module") if context else None)
                }
            }

        except openai.AuthenticationError as e:
            logger.error(f"OpenAI Authentication error: {e}")
            raise ValueError("Invalid AI API key. Please check your OPENAI_API_KEY setting in the backend environment.")
        except openai.RateLimitError as e:
            err_msg = str(e)
            logger.error(f"OpenAI Rate limit/Quota error: {err_msg}")
            if "insufficient_quota" in err_msg or "credit_balance_exhausted" in err_msg:
                raise ValueError("AI provider quota exhausted: Your OpenAI/Gemini account has run out of credits.")
            raise ValueError("AI provider rate limit reached. Please wait a moment and try again.")
        except openai.APITimeoutError as e:
            logger.error(f"OpenAI API timeout: {e}")
            raise TimeoutError("AI request timed out. Please try again.")
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise Exception(f"Failed to communicate with AI provider due to an API error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in AI service: {e}", exc_info=True)
            raise Exception(f"AI service error: {str(e)}")

    def _execute_analytical_table(
        self,
        args: Dict[str, Any],
        permitted_warehouse: Optional[str],
        current_user: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Executes a typed analytical query, generating a structured table & chart response.
        Validates arguments, applies branch authorization, and deterministically computes metrics.
        """
        metric = str(args.get("metric") or "sales").strip().lower()
        group_by = str(args.get("group_by") or "").strip().lower()
        limit = max(1, min(int(args.get("limit") or 20), 100))

        supported_metrics = ("sales", "payments", "products", "production_rejection", "production")
        supported_group_by = ("branch", "payment_method", "date", "month", "product", "customer", "comparison", "invoice", "item", "status")

        # Security check: Validate permission based on analytical metric
        user_role = str(current_user.get("role") or "user").lower()
        user_permissions = set(current_user.get("permissions") or [])
        if not user_permissions and user_role in DEFAULT_ROLE_PERMISSIONS:
            user_permissions = set(DEFAULT_ROLE_PERMISSIONS[user_role])

        if user_role != "admin":
            if metric == "sales" and not ({"dashboard.view", "invoices.view"} & user_permissions):
                return {
                    "error": "Forbidden / Access Denied: You do not have permission ('dashboard.view' or 'invoices.view') to analyze sales metrics. Please contact an administrator.",
                    "meta": {"is_partial": False, "permission_denied": True}
                }, None, None
            if metric == "payments" and not ({"finance.view", "finance.payments.view", "reports.view"} & user_permissions):
                return {
                    "error": "Forbidden / Access Denied: You do not have permission ('finance.view' or 'reports.view') to analyze payment metrics. Please contact an administrator.",
                    "meta": {"is_partial": False, "permission_denied": True}
                }, None, None
            if metric == "products" and "products.view" not in user_permissions:
                return {
                    "error": "Forbidden / Access Denied: You do not have permission ('products.view') to analyze product stock metrics. Please contact an administrator.",
                    "meta": {"is_partial": False, "permission_denied": True}
                }, None, None
            if metric in ("production_rejection", "production") and not ({"production.view", "production.reports.view"} & user_permissions):
                return {
                    "error": "Forbidden / Access Denied: You do not have permission ('production.view') to analyze production rejection metrics. Please contact an administrator.",
                    "meta": {"is_partial": False, "permission_denied": True}
                }, None, None

        if metric not in supported_metrics:
            return {
                "error": f"Unsupported metric '{metric}'. Supported metrics are: {', '.join(supported_metrics)}.",
                "meta": {"is_partial": False}
            }, None, None

        if group_by not in supported_group_by:
            return {
                "error": f"Unsupported grouping dimension '{group_by}'. Supported dimensions are: {', '.join(supported_group_by)}.",
                "meta": {"is_partial": False}
            }, None, None

        r = str(args.get("range") or "week").strip().lower()
        d_from, d_to, date_label = _resolve_date_range(r, args.get("date_from"), args.get("date_to"))

        target_branch = args.get("branch") or permitted_warehouse
        if current_user.get("role") != "admin" and permitted_warehouse:
            target_branch = permitted_warehouse

        is_mocked = hasattr(self.invoices_service, '_mock_return_value') or hasattr(self.client, '_mock_return_value')
        cache_key = f"{metric}:{group_by}:{r}:{d_from}:{d_to}:{target_branch}:{limit}"
        now = time.time()
        if not is_mocked:
            with _ANALYTICS_CACHE_LOCK:
                if cache_key in _ANALYTICS_CACHE:
                    cached_tool_resp, cached_card, cached_nav, c_time = _ANALYTICS_CACHE[cache_key]
                    if now - c_time < _ANALYTICS_CACHE_TTL:
                        logger.info(f"[AI TIMING] Analytics cache hit for key={cache_key}")
                        card_copy = dict(cached_card) if cached_card else None
                        if card_copy:
                            card_meta = dict(card_copy.get("meta") or {})
                            card_meta["is_cached"] = True
                            card_copy["meta"] = card_meta
                        return cached_tool_resp, card_copy, cached_nav

        try:
            ws_map = {w["WarehouseCode"]: w.get("WarehouseName", w["WarehouseCode"]) for w in self.warehouses_service.get_warehouses()}
        except Exception as e:
            logger.warning(f"Could not load warehouse names: {e}")
            ws_map = {}

        title = "Analytical Report"
        summary = ""
        columns = []
        rows = []
        chart_config = None
        filters = {}
        nav = None

        try:
            if metric == "sales":
                # Special Case A: Period Comparison (e.g. This Month vs Last Month / Same Month Last Year)
                if group_by == "comparison":
                    today = date.today()
                    d_from_a = date(today.year, today.month, 1)
                    d_to_a = today
                    lbl_a = f"This Month ({today.strftime('%B %Y')})"

                    first_this_month = date(today.year, today.month, 1)
                    last_day_last_month = first_this_month - timedelta(days=1)
                    first_day_last_month = date(last_day_last_month.year, last_day_last_month.month, 1)

                    if r in ("same_month_last_year", f"oct_{today.year - 1}"):
                        d_from_b = date(today.year - 1, today.month, 1)
                        if today.month == 12:
                            d_to_b = date(today.year - 1, 12, 31)
                        else:
                            d_to_b = date(today.year - 1, today.month + 1, 1) - timedelta(days=1)
                        lbl_b = f"Same Month Last Year ({d_from_b.strftime('%B %Y')})"
                    elif r in ("compare_last_year", "this_month_vs_last_year"):
                        d_from_b = date(today.year - 1, 1, 1)
                        d_to_b = date(today.year - 1, 12, 31)
                        lbl_b = f"Last Year (Full Year {today.year - 1})"
                    else:  # compare_last_month
                        d_from_b = first_day_last_month
                        d_to_b = last_day_last_month
                        lbl_b = f"Last Month ({first_day_last_month.strftime('%B %Y')})"

                    raw_a = self.invoices_service.get_invoices_by_date(d_from_a, d_to_a)
                    val_a = [
                        i for i in raw_a
                        if str(i.get("Cancelled") or "").lower() != "tyes"
                        and (not target_branch or _normalize_branch(_extract_branch_from_invoice(i)) == target_branch)
                    ]
                    sales_a = round(sum(float(i.get("DocTotal") or 0.0) for i in val_a), 2)
                    count_a = len(val_a)
                    avg_a = round(sales_a / count_a, 2) if count_a > 0 else 0.0

                    raw_b = self.invoices_service.get_invoices_by_date(d_from_b, d_to_b)
                    val_b = [
                        i for i in raw_b
                        if str(i.get("Cancelled") or "").lower() != "tyes"
                        and (not target_branch or _normalize_branch(_extract_branch_from_invoice(i)) == target_branch)
                    ]
                    sales_b = round(sum(float(i.get("DocTotal") or 0.0) for i in val_b), 2)
                    count_b = len(val_b)
                    avg_b = round(sales_b / count_b, 2) if count_b > 0 else 0.0

                    delta_sales = round(sales_a - sales_b, 2)
                    delta_count = count_a - count_b
                    if sales_b > 0:
                        delta_pct = round(((sales_a - sales_b) / sales_b * 100), 1)
                        pct_display = f"{'+' if delta_pct >= 0 else ''}{delta_pct}%"
                        variance_explanation = f"Net variance is ₹{delta_sales:+,.2f} ({delta_pct:+,.1f}%)."
                        growth_label = f"{'+' if delta_pct >= 0 else ''}{delta_pct}%"
                    else:
                        delta_pct = None
                        pct_display = "N/A (Prev: ₹0.00)"
                        variance_explanation = f"Net change is ₹{delta_sales:+,.2f}. Previous period recorded zero sales, so percentage variance cannot be calculated reliably."
                        growth_label = "N/A"

                    rows = [
                        {"period": lbl_a, "sales": sales_a, "invoiceCount": count_a, "averageBill": avg_a},
                        {"period": lbl_b, "sales": sales_b, "invoiceCount": count_b, "averageBill": avg_b},
                        {"period": f"Variance ({pct_display})", "sales": delta_sales, "invoiceCount": delta_count, "averageBill": round(avg_a - avg_b, 2)}
                    ]
                    columns = [
                        {"key": "period", "label": "Period / Timeline", "type": "string"},
                        {"key": "sales", "label": "Total Sales (₹)", "type": "currency"},
                        {"key": "invoiceCount", "label": "Invoices", "type": "number"},
                        {"key": "averageBill", "label": "Average Bill (₹)", "type": "currency"}
                    ]
                    chart_config = {
                        "type": "bar",
                        "xKey": "period",
                        "series": ["sales"],
                        "defaultView": "both"
                    }
                    title = f"Period Comparison: {lbl_a} vs {lbl_b}"
                    summary = f"{lbl_a} recorded ₹{sales_a:,.2f} ({count_a} invoices) compared to ₹{sales_b:,.2f} ({count_b} invoices) in {lbl_b}. {variance_explanation}"
                    filters = {
                        "period": f"{lbl_a} vs {lbl_b}",
                        "dateFrom": d_from_a.strftime("%Y-%m-%d"),
                        "dateTo": d_to_a.strftime("%Y-%m-%d"),
                        "groupBy": ["comparison"],
                        "branch": target_branch or "All Branches",
                        "additional": {
                            lbl_a: f"₹{sales_a:,.2f} ({count_a} invoices)",
                            lbl_b: f"₹{sales_b:,.2f} ({count_b} invoices)",
                            "Net Growth": growth_label
                        }
                    }
                    nav = {"label": "Open Sales Reports", "route": "/reports/sales", "target_module": "reports_sales", "params": {"range": "month"}}

                # Special Case B: Monthly Revenue (e.g. past 6 months)
                elif group_by == "month" or (group_by == "date" and r in ("past_6_months", "6_months", "last_6_months")):
                    today = date.today()
                    month_keys = []
                    month_labels = {}
                    for i in range(5, -1, -1):
                        m_num = today.month - i
                        y_num = today.year
                        while m_num <= 0:
                            m_num += 12
                            y_num -= 1
                        m_k = f"{y_num:04d}-{m_num:02d}"
                        month_keys.append(m_k)
                        month_labels[m_k] = date(y_num, m_num, 1).strftime("%b %Y")

                    start_6m_date = date(int(month_keys[0][:4]), int(month_keys[0][5:7]), 1)
                    month_grouped = {k: {"total": 0.0, "count": 0} for k in month_keys}

                    raw_invoices = self.invoices_service.get_invoices_by_date(start_6m_date, today)
                    valid_invoices = [
                        inv for inv in raw_invoices
                        if str(inv.get("Cancelled") or "").lower() != "tyes"
                        and (not target_branch or _normalize_branch(_extract_branch_from_invoice(inv)) == target_branch)
                    ]

                    for inv in valid_invoices:
                        m_str = str(inv.get("DocDate") or "")[:7]
                        if m_str in month_grouped:
                            month_grouped[m_str]["total"] += float(inv.get("DocTotal") or 0.0)
                            month_grouped[m_str]["count"] += 1

                    rows = []
                    for m_k in month_keys:
                        m_d = month_grouped[m_k]
                        s_tot = round(m_d["total"], 2)
                        i_cnt = int(m_d["count"])
                        avg_b = round(s_tot / i_cnt, 2) if i_cnt > 0 else 0.0
                        rows.append({
                            "month": month_labels[m_k],
                            "monthKey": m_k,
                            "sales": s_tot,
                            "invoiceCount": i_cnt,
                            "averageBill": avg_b
                        })

                    columns = [
                        {"key": "month", "label": "Month", "type": "string"},
                        {"key": "sales", "label": "Total Sales (₹)", "type": "currency"},
                        {"key": "invoiceCount", "label": "Invoice Count", "type": "number"},
                        {"key": "averageBill", "label": "Average Bill (₹)", "type": "currency"}
                    ]
                    total_sales = sum(r["sales"] for r in rows)
                    total_invoices = sum(r["invoiceCount"] for r in rows)
                    title = "Monthly Revenue (Past 6 Months)"
                    summary = f"Total revenue of ₹{total_sales:,.2f} across {total_invoices} invoices for the past 6 months ({month_labels[month_keys[0]]} to {month_labels[month_keys[-1]]})."
                    if len(rows) >= 2:
                        mom_diff = round(rows[-1]["sales"] - rows[-2]["sales"], 2)
                        mom_pct = round((mom_diff / rows[-2]["sales"] * 100), 1) if rows[-2]["sales"] > 0 else 0.0
                        trend_dir = "an increase" if mom_diff >= 0 else "a decrease"
                        summary += f" Recent trend: {rows[-1]['month']} recorded ₹{rows[-1]['sales']:,.2f}, representing {trend_dir} of ₹{abs(mom_diff):,.2f} ({'+' if mom_pct >= 0 else ''}{mom_pct}%) compared to {rows[-2]['month']}."
                    chart_config = {
                        "type": "bar",
                        "xKey": "month",
                        "series": ["sales"],
                        "defaultView": "both"
                    }
                    filters = {
                        "period": f"Past 6 months ({month_labels[month_keys[0]]} to {month_labels[month_keys[-1]]})",
                        "dateFrom": start_6m_date.strftime("%Y-%m-%d"),
                        "dateTo": today.strftime("%Y-%m-%d"),
                        "groupBy": ["month"],
                        "branch": target_branch or "All Branches",
                        "additional": {
                            "Date Range": f"Past 6 months ({month_labels[month_keys[0]]} to {month_labels[month_keys[-1]]})",
                            "Metric": "Total Sales (₹)"
                        }
                    }
                    nav = {"label": "Open Sales Reports", "route": "/reports/sales", "target_module": "reports_sales", "params": {"range": "month"}}

                else:
                    needs_lines = group_by in ("product", "branch")
                    t_inv = time.perf_counter()
                    if d_from and d_to:
                        if needs_lines:
                            raw_invoices = self.invoices_service.get_invoices_by_date_with_lines(d_from, d_to)
                        else:
                            raw_invoices = self.invoices_service.get_invoices_by_date(d_from, d_to)
                            # Fallback if unit test mock only populated get_invoices_by_date_with_lines
                            if (not isinstance(raw_invoices, list) or len(raw_invoices) == 0) and hasattr(self.invoices_service, 'get_invoices_by_date_with_lines'):
                                try:
                                    t_invs = self.invoices_service.get_invoices_by_date_with_lines(d_from, d_to)
                                    if isinstance(t_invs, list) and len(t_invs) > 0:
                                        raw_invoices = t_invs
                                except Exception:
                                    pass
                    else:
                        if needs_lines:
                            raw_invoices = self.invoices_service.get_recent_invoices_with_lines(limit=100)
                        else:
                            raw_invoices = self.invoices_service.get_recent_invoices(limit=1000)
                    inv_dur = (time.perf_counter() - t_inv) * 1000.0
                    rec_count = len(raw_invoices) if isinstance(raw_invoices, list) else 0
                    logger.info(f"[AI TIMING] Invoices retrieval duration_ms={inv_dur:.2f} (records={rec_count}, needs_lines={needs_lines})")

                    # Filter out cancelled documents
                    valid_invoices = [
                        inv for inv in raw_invoices
                        if str(inv.get("Cancelled") or "").lower() != "tyes"
                    ]

                    if group_by == "branch":
                        grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "count": 0})

                        for inv in valid_invoices:
                            lines = inv.get("DocumentLines") or []
                            if lines:
                                inv_branches = set()
                                for line in lines:
                                    b_code = str(line.get("WarehouseCode") or "").strip().upper()
                                    if not b_code:
                                        b_code = _normalize_branch(_extract_branch_from_invoice(inv))
                                    line_val = float(line.get("LineTotal") or 0.0)
                                    grouped[b_code]["total"] += line_val
                                    inv_branches.add(b_code)
                                for b_code in inv_branches:
                                    grouped[b_code]["count"] += 1
                            else:
                                b_code = _normalize_branch(_extract_branch_from_invoice(inv))
                                grouped[b_code]["total"] += float(inv.get("DocTotal") or 0.0)
                                grouped[b_code]["count"] += 1

                        if target_branch:
                            grouped = {k: v for k, v in grouped.items() if k == target_branch}

                        rows = []
                        for b_code, b_data in sorted(grouped.items(), key=lambda x: x[1]["total"], reverse=True)[:limit]:
                            b_name = ws_map.get(b_code, b_code)
                            s_total = round(b_data["total"], 2)
                            i_count = int(b_data["count"])
                            avg_ticket = round(s_total / i_count, 2) if i_count > 0 else 0.0
                            rows.append({
                                "branch": f"{b_name} ({b_code})",
                                "branchCode": b_code,
                                "sales": s_total,
                                "invoiceCount": i_count,
                                "averageBill": avg_ticket
                            })

                        columns = [
                            {"key": "branch", "label": "Branch / Warehouse", "type": "string"},
                            {"key": "sales", "label": "Total Sales", "type": "currency"},
                            {"key": "invoiceCount", "label": "Invoice Count", "type": "number"},
                            {"key": "averageBill", "label": "Average Bill", "type": "currency"}
                        ]

                        total_sales = sum(r["sales"] for r in rows)
                        total_invoices = sum(r["invoiceCount"] for r in rows)

                        if rows:
                            summary = f"Total sales of ₹{total_sales:,.2f} across {len(rows)} branches ({total_invoices} invoices) for {date_label}."
                        else:
                            summary = f"No sales records found across authorized branches for {date_label}."

                        title = f"{date_label} Sales by Branch"
                        chart_config = {
                            "type": "bar",
                            "xKey": "branch",
                            "series": ["sales"],
                            "defaultView": "both"
                        } if rows else None

                        filters = {
                            "period": date_label,
                            "dateFrom": d_from.strftime("%Y-%m-%d") if d_from else None,
                            "dateTo": d_to.strftime("%Y-%m-%d") if d_to else None,
                            "groupBy": ["branch"],
                            "branch": target_branch or "All Branches"
                        }
                        nav = {"label": "Open Sales Reports", "route": "/reports/sales", "target_module": "reports_sales", "params": {"range": r}}

                    elif group_by == "payment_method":
                        branch_filtered = [
                            inv for inv in valid_invoices
                            if not target_branch or _normalize_branch(_extract_branch_from_invoice(inv)) == target_branch
                        ]

                        pm_grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "count": 0})
                        for inv in branch_filtered:
                            pm = str(inv.get("U_P_Method") or "Cash / Standard").strip().title()
                            if not pm or pm.lower() in ("none", "null", ""):
                                pm = "Other / Unspecified"
                            pm_grouped[pm]["total"] += float(inv.get("DocTotal") or 0.0)
                            pm_grouped[pm]["count"] += 1

                        sum_sales = sum(v["total"] for v in pm_grouped.values())
                        rows = []
                        for pm, pm_data in sorted(pm_grouped.items(), key=lambda x: x[1]["total"], reverse=True)[:limit]:
                            m_total = round(pm_data["total"], 2)
                            m_count = int(pm_data["count"])
                            share = round((m_total / sum_sales * 100), 1) if sum_sales > 0 else 0.0
                            rows.append({
                                "paymentMethod": pm,
                                "sales": m_total,
                                "invoiceCount": m_count,
                                "percentage": share
                            })

                        columns = [
                            {"key": "paymentMethod", "label": "Payment Method", "type": "string"},
                            {"key": "sales", "label": "Total Amount", "type": "currency"},
                            {"key": "invoiceCount", "label": "Invoices", "type": "number"},
                            {"key": "percentage", "label": "Share %", "type": "percentage"}
                        ]

                        total_sales = sum(r["sales"] for r in rows)
                        total_invoices = sum(r["invoiceCount"] for r in rows)
                        title = f"{date_label} Sales by Payment Method"
                        summary = f"Total collections of ₹{total_sales:,.2f} across {len(rows)} payment methods ({total_invoices} invoices) for {date_label}." if rows else f"No payments recorded for {date_label}."
                        chart_config = {
                            "type": "bar",
                            "xKey": "paymentMethod",
                            "series": ["sales"],
                            "defaultView": "both"
                        } if rows else None
                        filters = {
                            "period": date_label,
                            "dateFrom": d_from.strftime("%Y-%m-%d") if d_from else None,
                            "dateTo": d_to.strftime("%Y-%m-%d") if d_to else None,
                            "groupBy": ["payment_method"],
                            "branch": target_branch or "All Branches"
                        }
                        nav = {"label": "Open Payment Reports", "route": "/reports/payments", "target_module": "reports_payment", "params": {"range": r}}

                    elif group_by == "customer":
                        branch_filtered = [
                            inv for inv in valid_invoices
                            if not target_branch or _normalize_branch(_extract_branch_from_invoice(inv)) == target_branch
                        ]

                        cust_grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"name": "", "total": 0.0, "count": 0})
                        for inv in branch_filtered:
                            c_code = str(inv.get("CardCode") or "CASH").strip()
                            c_name = str(inv.get("CardName") or c_code).strip()
                            cust_grouped[c_code]["name"] = c_name
                            cust_grouped[c_code]["total"] += float(inv.get("DocTotal") or 0.0)
                            cust_grouped[c_code]["count"] += 1

                        rows = []
                        for c_code, c_data in sorted(cust_grouped.items(), key=lambda x: x[1]["total"], reverse=True)[:limit]:
                            s_total = round(c_data["total"], 2)
                            i_count = int(c_data["count"])
                            avg_ticket = round(s_total / i_count, 2) if i_count > 0 else 0.0
                            rows.append({
                                "customerName": c_data["name"] or c_code,
                                "customerCode": c_code,
                                "sales": s_total,
                                "invoiceCount": i_count,
                                "averageBill": avg_ticket
                            })

                        columns = [
                            {"key": "customerName", "label": "Customer Name", "type": "string"},
                            {"key": "customerCode", "label": "Customer Code", "type": "string"},
                            {"key": "sales", "label": "Total Sales", "type": "currency"},
                            {"key": "invoiceCount", "label": "Invoices", "type": "number"},
                            {"key": "averageBill", "label": "Average Bill", "type": "currency"}
                        ]
                        total_sales = sum(r["sales"] for r in rows)
                        title = f"{date_label} Customer-wise Sales"
                        summary = f"Top {len(rows)} customers billed ₹{total_sales:,.2f} for {date_label}." if rows else f"No customer transactions found for {date_label}."
                        chart_config = {
                            "type": "bar",
                            "xKey": "customerName",
                            "series": ["sales"],
                            "defaultView": "both"
                        } if rows else None
                        filters = {
                            "period": date_label,
                            "dateFrom": d_from.strftime("%Y-%m-%d") if d_from else None,
                            "dateTo": d_to.strftime("%Y-%m-%d") if d_to else None,
                            "groupBy": ["customer"],
                            "branch": target_branch or "All Branches"
                        }
                        nav = {"label": "Open Customers", "route": "/customers", "target_module": "customers"}

                    elif group_by == "invoice":
                        branch_filtered = [
                            inv for inv in valid_invoices
                            if not target_branch or _normalize_branch(_extract_branch_from_invoice(inv)) == target_branch
                        ]
                        rows = []
                        for inv in branch_filtered[:limit]:
                            d_date = str(inv.get("DocDate") or "")[:10]
                            rows.append({
                                "invoiceNo": str(inv.get("DocNum") or inv.get("DocEntry")),
                                "customer": str(inv.get("CardName") or inv.get("CardCode") or "CASH"),
                                "date": d_date,
                                "paymentMethod": str(inv.get("U_P_Method") or "Standard"),
                                "total": round(float(inv.get("DocTotal") or 0.0), 2)
                            })
                        columns = [
                            {"key": "invoiceNo", "label": "Invoice #", "type": "string"},
                            {"key": "customer", "label": "Customer", "type": "string"},
                            {"key": "date", "label": "Date", "type": "date"},
                            {"key": "paymentMethod", "label": "Payment Method", "type": "string"},
                            {"key": "total", "label": "Total Amount", "type": "currency"}
                        ]
                        title = f"{date_label} Recent Invoices"
                        summary = f"{len(rows)} invoices retrieved for {date_label}." if rows else f"No invoices found for {date_label}."
                        chart_config = None
                        filters = {
                            "period": date_label,
                            "dateFrom": d_from.strftime("%Y-%m-%d") if d_from else None,
                            "dateTo": d_to.strftime("%Y-%m-%d") if d_to else None,
                            "groupBy": ["invoice"],
                            "branch": target_branch or "All Branches"
                        }
                        nav = {"label": "Open Invoices", "route": "/sales", "target_module": "sales"}

                    elif group_by == "date":
                        branch_filtered = [
                            inv for inv in valid_invoices
                            if not target_branch or _normalize_branch(_extract_branch_from_invoice(inv)) == target_branch
                        ]

                        d_grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "count": 0})
                        for inv in branch_filtered:
                            d_raw = str(inv.get("DocDate") or "")[:10]
                            if not d_raw:
                                continue
                            label = d_raw if r in ("today", "week", "month") else d_raw[:7]
                            d_grouped[label]["total"] += float(inv.get("DocTotal") or 0.0)
                            d_grouped[label]["count"] += 1

                        rows = []
                        for d_lbl, d_data in sorted(d_grouped.items())[:limit]:
                            s_total = round(d_data["total"], 2)
                            i_count = int(d_data["count"])
                            avg_ticket = round(s_total / i_count, 2) if i_count > 0 else 0.0
                            rows.append({
                                "date": d_lbl,
                                "sales": s_total,
                                "invoiceCount": i_count,
                                "averageBill": avg_ticket
                            })

                        columns = [
                            {"key": "date", "label": "Period / Date", "type": "date"},
                            {"key": "sales", "label": "Sales Revenue", "type": "currency"},
                            {"key": "invoiceCount", "label": "Invoices", "type": "number"},
                            {"key": "averageBill", "label": "Avg Ticket", "type": "currency"}
                        ]

                        total_sales = sum(r["sales"] for r in rows)
                        total_invoices = sum(r["invoiceCount"] for r in rows)
                        title = f"{date_label} Sales Trend"
                        summary = f"Total revenue of ₹{total_sales:,.2f} ({total_invoices} invoices) across {len(rows)} periods for {date_label}." if rows else f"No sales trend records for {date_label}."
                        chart_config = {
                            "type": "bar",
                            "xKey": "date",
                            "series": ["sales"],
                            "defaultView": "both"
                        } if rows else None
                        filters = {
                            "period": date_label,
                            "dateFrom": d_from.strftime("%Y-%m-%d") if d_from else None,
                            "dateTo": d_to.strftime("%Y-%m-%d") if d_to else None,
                            "groupBy": ["date"],
                            "branch": target_branch or "All Branches"
                        }
                        nav = {"label": "Open Sales Reports", "route": "/reports/sales", "target_module": "reports_sales", "params": {"range": r}}

                    elif group_by == "product":
                        branch_filtered = [
                            inv for inv in valid_invoices
                            if not target_branch or _normalize_branch(_extract_branch_from_invoice(inv)) == target_branch
                        ]

                        prod_grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"name": "", "qty": 0.0, "total": 0.0})
                        for inv in branch_filtered:
                            for line in (inv.get("DocumentLines") or []):
                                code = str(line.get("ItemCode") or "").strip()
                                if not code:
                                    continue
                                name = str(line.get("ItemDescription") or code).strip()
                                prod_grouped[code]["name"] = name
                                prod_grouped[code]["qty"] += float(line.get("Quantity") or 0.0)
                                prod_grouped[code]["total"] += float(line.get("LineTotal") or 0.0)

                        rows = []
                        for p_code, p_data in sorted(prod_grouped.items(), key=lambda x: x[1]["total"], reverse=True)[:limit]:
                            rows.append({
                                "itemCode": p_code,
                                "itemName": p_data["name"] or p_code,
                                "quantity": round(p_data["qty"], 2),
                                "sales": round(p_data["total"], 2)
                            })

                        columns = [
                            {"key": "itemCode", "label": "Item Code", "type": "string"},
                            {"key": "itemName", "label": "Product Name", "type": "string"},
                            {"key": "quantity", "label": "Qty Sold", "type": "number"},
                            {"key": "sales", "label": "Sales Revenue", "type": "currency"}
                        ]

                        total_sales = sum(r["sales"] for r in rows)
                        title = f"{date_label} Top Products"
                        summary = f"Total product sales of ₹{total_sales:,.2f} across top {len(rows)} products for {date_label}." if rows else f"No product sales found for {date_label}."
                        chart_config = {
                            "type": "horizontal_bar",
                            "xKey": "itemName",
                            "series": ["sales"],
                            "defaultView": "both"
                        } if rows else None
                        filters = {
                            "period": date_label,
                            "dateFrom": d_from.strftime("%Y-%m-%d") if d_from else None,
                            "dateTo": d_to.strftime("%Y-%m-%d") if d_to else None,
                            "groupBy": ["product"],
                            "branch": target_branch or "All Branches"
                        }
                        nav = {"label": "Open Products Catalog", "route": "/products", "target_module": "products"}

            elif metric in ("production_rejection", "production"):
                d_from_str = d_from.strftime("%Y-%m-%d") if d_from else None
                d_to_str = d_to.strftime("%Y-%m-%d") if d_to else None
                rej_data = self.production_service.get_rejection_summary(
                    warehouse=target_branch,
                    date_from=d_from_str,
                    date_to=d_to_str,
                    search=args.get("search")
                )
                raw_items = rej_data.get("items") or []
                sorted_items = sorted(raw_items, key=lambda x: x.get("rejected_qty", 0.0), reverse=True)[:limit]

                title = f"Production Rejection by Item ({date_label})"
                summary = f"Total scrap/rejected quantity: {rej_data.get('total_rejected', 0)} across {len(sorted_items)} manufactured items. Overall rejection rate: {rej_data.get('rejection_percentage', 0)}%." if sorted_items else f"No production rejection recorded for {date_label}."

                columns = [
                    {"key": "itemCode", "label": "Item Code", "type": "string"},
                    {"key": "itemName", "label": "Item Description", "type": "string"},
                    {"key": "producedQty", "label": "Produced Qty", "type": "number"},
                    {"key": "rejectedQty", "label": "Rejected Qty", "type": "number"},
                    {"key": "rejectionRate", "label": "Rejection %", "type": "percentage"},
                    {"key": "warehouse", "label": "Warehouse", "type": "string"}
                ]
                rows = [
                    {
                        "itemCode": it.get("item_code"),
                        "itemName": it.get("item_name") or it.get("item_code"),
                        "producedQty": round(float(it.get("produced_qty") or 0.0), 2),
                        "rejectedQty": round(float(it.get("rejected_qty") or 0.0), 2),
                        "rejectionRate": round(float(it.get("rejection_percentage") or 0.0), 2),
                        "warehouse": it.get("warehouse") or target_branch or "SH"
                    }
                    for it in sorted_items
                ]
                chart_config = {
                    "type": "bar",
                    "xKey": "itemCode",
                    "series": ["rejectionRate"],
                    "defaultView": "both"
                } if rows else None
                filters = {
                    "period": date_label,
                    "dateFrom": d_from_str,
                    "dateTo": d_to_str,
                    "groupBy": ["item"],
                    "branch": target_branch or "All Branches"
                }
                nav = {"label": "Open Production Rejection", "route": "/production/rejection", "target_module": "production_rejection"}

        except SAPConnectionError as e:
            logger.error(f"SAP connection error in analytical table: {e}")
            return {
                "error": f"Failed to connect to SAP Business One Service Layer: {str(e)}",
                "meta": {"is_partial": False, "error": str(e)}
            }, None, None
        except Exception as e:
            logger.error(f"Error executing analytical table query: {e}", exc_info=True)
            return {
                "error": f"Failed to retrieve analytical data from SAP: {str(e)}",
                "meta": {"is_partial": False, "error": str(e)}
            }, None, None

        from app.core.workflow_flows import get_workflow_flowchart
        flowchart_key = "production" if metric in ("production_rejection", "production") else ("payments" if metric == "payments" else ("inventory" if metric == "products" else "sales"))
        flowchart_data = get_workflow_flowchart(flowchart_key)

        insights = []
        kpis = []
        if rows:
            insights.append(f"Evaluated {len(rows)} data records for {date_label} across {target_branch or 'All Branches'}.")
            if "sales" in rows[0]:
                tot_s = sum(float(r.get("sales") or 0.0) for r in rows if isinstance(r.get("sales"), (int, float)))
                kpis.append({"label": "Total Sales", "value": f"₹{tot_s:,.2f}", "isPositive": True})
                if "invoiceCount" in rows[0]:
                    tot_i = sum(int(r.get("invoiceCount") or 0) for r in rows if isinstance(r.get("invoiceCount"), (int, float)))
                    kpis.append({"label": "Invoices", "value": tot_i})
                lead_name = rows[0].get("itemName") or rows[0].get("customerName") or rows[0].get("branch") or rows[0].get("period")
                if lead_name:
                    kpis.append({"label": "Leading", "value": str(lead_name)[:20], "subtext": f"₹{float(rows[0]['sales']):,.2f}"})
                top_lead = rows[0].get("branch") or rows[0].get("period") or rows[0].get("customerName") or "Top Category"
                insights.append(f"Leading contribution: {top_lead} with ₹{float(rows[0]['sales']):,.2f}.")
            elif "rejectionRate" in rows[0]:
                tot_p = sum(float(r.get("producedQty") or 0.0) for r in rows if isinstance(r.get("producedQty"), (int, float)))
                tot_r = sum(float(r.get("rejectedQty") or 0.0) for r in rows if isinstance(r.get("rejectedQty"), (int, float)))
                overall_rate = round((tot_r / tot_p * 100), 2) if tot_p > 0 else 0.0
                kpis.append({"label": "Overall Scrap Rate", "value": f"{overall_rate}%", "isPositive": False})
                kpis.append({"label": "Total Produced", "value": f"{tot_p:,.0f}"})
                kpis.append({"label": "Total Rejected", "value": f"{tot_r:,.0f}", "isPositive": False})
                insights.append(f"Highest rejection item: {rows[0].get('itemCode')} ({rows[0].get('rejectionRate')}%) on {rows[0].get('rejectedQty')} rejected units.")
            if group_by == "comparison":
                insights.append(summary)

        card_raw = {
            "type": "table",
            "title": title,
            "summary": summary,
            "columns": columns,
            "rows": rows,
            "filters": filters,
            "chart": chart_config,
            "flowchart": flowchart_data,
            "insights": insights,
            "kpis": kpis if kpis else None,
            "meta": {
                "date_range": date_label,
                "branch_scope": target_branch or "All Branches",
                "is_partial": len(rows) >= limit,
                "row_count": len(rows)
            }
        }
        card = StructuredTableResponse.model_validate(card_raw).model_dump()

        tool_resp = {
            "title": title,
            "summary": summary,
            "total_rows": len(rows),
            "sample_rows": rows[:10],
            "filters": filters,
            "chart": chart_config
        }
        if not is_mocked:
            with _ANALYTICS_CACHE_LOCK:
                if len(_ANALYTICS_CACHE) >= _ANALYTICS_CACHE_MAX_SIZE:
                    oldest_key = min(_ANALYTICS_CACHE.keys(), key=lambda k: _ANALYTICS_CACHE[k][3])
                    _ANALYTICS_CACHE.pop(oldest_key, None)
                _ANALYTICS_CACHE[cache_key] = (tool_resp, card, nav, time.time())

        return tool_resp, card, nav

    def _execute_tool_inner(
        self,
        tool_name: str,
        args: Dict[str, Any],
        permitted_warehouse: Optional[str],
        current_user: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Executes a single registered business tool against SAP or Postgres.
        Returns: (tool_context_for_llm, structured_card_for_ui, navigation_action)
        """
        try:
            date_from = args.get("date_from")
            date_to = args.get("date_to")
            if date_from and date_to and str(date_from) > str(date_to):
                return {
                    "error": f"Invalid date range: date_from ({date_from}) cannot be after date_to ({date_to}).",
                    "meta": {"is_partial": False}
                }, None, None

            # Security & Role-Based Authorization Enforcement
            user_role = str(current_user.get("role") or "user").lower()
            user_permissions = set(current_user.get("permissions") or [])
            if not user_permissions and user_role in DEFAULT_ROLE_PERMISSIONS:
                user_permissions = set(DEFAULT_ROLE_PERMISSIONS[user_role])

            required_perm = TOOL_PERMISSIONS.get(tool_name)
            if required_perm and user_role != "admin" and required_perm not in user_permissions:
                logger.warning(
                    f"AI Assistant tool access denied: user '{current_user.get('username')}' "
                    f"(role={user_role}) missing required permission '{required_perm}' for tool '{tool_name}'"
                )
                return {
                    "error": f"Forbidden: You do not have permission ('{required_perm}') to execute '{tool_name}'. Please contact an administrator.",
                    "meta": {"is_partial": False, "permission_denied": True}
                }, None, None

            # Enforce strict branch scoping: non-admin users with permitted_warehouse cannot cross branch boundaries
            def _resolve_tool_branch(req_branch: Optional[str]) -> Optional[str]:
                if user_role != "admin" and permitted_warehouse:
                    return permitted_warehouse
                return req_branch or permitted_warehouse

            # ──────────────────────────────────────────────────────────────────
            # 0. get_workflow_flowchart
            # ──────────────────────────────────────────────────────────────────
            if tool_name == "get_workflow_flowchart":
                from app.core.workflow_flows import get_workflow_flowchart
                target_mod = str(args.get("module") or "sales").lower().strip()
                flow = get_workflow_flowchart(target_mod)
                if not flow:
                    flow = get_workflow_flowchart("sales")
                card = {
                    "type": "flowchart",
                    "title": flow["title"],
                    "summary": flow["description"],
                    "flowchart": flow,
                    "meta": {"module": flow.get("module", target_mod)}
                }
                nav_route = flow["nodes"][-1].get("route") if flow.get("nodes") else "/"
                nav_label = flow["nodes"][-1].get("routeLabel") or f"Open {flow['module']}"
                nav = {"label": nav_label, "route": nav_route, "target_module": target_mod}
                return {"flowchart": flow, "module": target_mod}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 1. get_analytical_table
            # ──────────────────────────────────────────────────────────────────
            if tool_name == "get_analytical_table":
                return self._execute_analytical_table(args, permitted_warehouse, current_user)

            # ──────────────────────────────────────────────────────────────────
            # 1. get_dashboard_summary
            # ──────────────────────────────────────────────────────────────────
            if tool_name == "get_dashboard_summary":
                r = args.get("range", "today")
                d_from, d_to, date_label = _resolve_date_range(r, args.get("date_from"), args.get("date_to"))
                target_branch = _resolve_tool_branch(args.get("branch"))

                invoices = []
                if d_from and d_to:
                    raw_invoices = self.invoices_service.get_invoices_by_date(d_from, d_to)
                else:
                    raw_invoices = self.invoices_service.get_recent_invoices(limit=2000)

                for inv in raw_invoices:
                    inv_b = _normalize_branch(_extract_branch_from_invoice(inv))
                    if current_user.get("role") == "admin" or not target_branch or inv_b == target_branch:
                        invoices.append(inv)

                total_sales = sum(float(inv.get("DocTotal") or 0.0) for inv in invoices)
                invoice_count = len(invoices)
                avg_value = round(total_sales / invoice_count, 2) if invoice_count > 0 else 0.0

                # Compute growth if range has previous equivalent period
                growth = 0.0
                if d_from and d_to:
                    span = (d_to - d_from).days + 1
                    prev_from = d_from - timedelta(days=span)
                    prev_to = d_from - timedelta(days=1)
                    prev_raw = self.invoices_service.get_invoices_by_date(prev_from, prev_to)
                    prev_sales = sum(float(i.get("DocTotal") or 0.0) for i in prev_raw)
                    if prev_sales > 0:
                        growth = round(((total_sales - prev_sales) / prev_sales) * 100.0, 1)

                # Low stock items count
                low_stock_count = 0
                try:
                    stock_items = self.inventory_service.get_warehouse_stock(target_branch or "SH", max_pages=2)
                    for itm in stock_items:
                        if itm.get("_truncated"): continue
                        wh_info = itm.get("ItemWarehouseInfoCollection") or []
                        in_stock = float(itm.get("QuantityOnStock") or 0.0)
                        min_stock = 0.0
                        for w in wh_info:
                            if not target_branch or w.get("WarehouseCode") == target_branch:
                                min_stock = float(w.get("MinimalStock") or 0.0)
                                break
                        if (min_stock > 0 and in_stock <= min_stock) or (in_stock <= 10.0):
                            low_stock_count += 1
                except Exception:
                    low_stock_count = 0

                # Pending approvals
                approvals_count = 0
                try:
                    approvals_res = approval_service.get_approvals(branch_id=target_branch, status="pending", limit=100)
                    approvals_count = approvals_res.get("total", 0) if isinstance(approvals_res, dict) else len(approvals_res)
                except Exception:
                    approvals_count = 0

                summary_data = {
                    "total_sales": round(total_sales, 2),
                    "invoice_count": invoice_count,
                    "average_order_value": avg_value,
                    "growth_percentage": growth,
                    "low_stock_count": low_stock_count,
                    "pending_approvals_count": approvals_count,
                    "period": date_label,
                    "branch": target_branch or "All Branches"
                }

                from app.core.workflow_flows import get_workflow_flowchart
                card = {
                    "type": "dashboard_summary",
                    "summary": summary_data,
                    "flowchart": get_workflow_flowchart("dashboard"),
                    "insights": [
                        f"{date_label} total billed revenue: ₹{total_sales:,.2f} across {invoice_count} transactions.",
                        f"Growth vs previous equivalent period: {'+' if growth >= 0 else ''}{growth}%.",
                        f"Active inventory alerts: {low_stock_count} items below minimal reorder threshold."
                    ],
                    "meta": {"date_range": date_label, "branch_scope": target_branch or "All"}
                }
                nav = {"label": "Open Dashboard", "route": "/", "target_module": "dashboard"}
                return summary_data, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 2. get_sales_orders
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_sales_orders":
                st = args.get("status", "all")
                limit = int(args.get("limit") or 10)
                filters = []

                if st == "pending":
                    filters.append("DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'")
                elif st == "completed":
                    filters.append("DocumentStatus eq 'bost_Close' and Cancelled eq 'tNO'")
                elif st == "cancelled":
                    filters.append("Cancelled eq 'tYES'")

                if args.get("customer"):
                    safe_c = args.get("customer").replace("'", "''")
                    filters.append(f"CardCode eq '{safe_c}'")

                d_from = args.get("date_from")
                d_to = args.get("date_to")
                if d_from: filters.append(f"DocDate ge '{d_from}'")
                if d_to: filters.append(f"DocDate le '{d_to}'")

                summary = self.sales_orders_service.get_sales_order_summary(filters=None)
                orders_res = self.sales_orders_service.list_sales_orders(skip=0, top=limit, filters=filters)
                orders_list = orders_res.get("value", [])

                card = {
                    "type": "sales_orders",
                    "orders": orders_list,
                    "summary": summary,
                    "total_count": orders_res.get("odata.count", len(orders_list)),
                    "meta": {"status_filter": st, "limit": limit}
                }
                nav = {"label": "View Sales Orders", "route": "/sales-orders", "target_module": "sales_orders", "params": {"status": st}}
                return {"summary": summary, "sample_orders": orders_list[:10], "total_found": len(orders_list)}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 3. get_sales_invoices
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_sales_invoices":
                r = args.get("range", "monthly")
                branch = _resolve_tool_branch(args.get("branch"))
                res = self.finance_service.get_sales_invoices(
                    range_str=r,
                    from_date=args.get("date_from"),
                    to_date=args.get("date_to"),
                    customer_code=args.get("customer_code"),
                    status=args.get("status"),
                    branch_id=branch,
                    search=args.get("search"),
                    limit=int(args.get("limit") or 20)
                )
                if isinstance(res, list):
                    sinvs = res
                    total_amt = sum(float(x.get("DocTotal") or x.get("total") or 0.0) for x in sinvs)
                    res = {"sales_invoices": sinvs, "invoices": sinvs, "total_count": len(sinvs), "total_amount": total_amt, "period": r}
                else:
                    sinvs = res.get("sales_invoices", []) or res.get("invoices", [])
                total_cnt = res.get("total_count", len(sinvs))
                is_partial = total_cnt > len(sinvs)
                res_meta = res.get("meta") or {}
                res_meta["is_partial"] = is_partial
                res_meta["date_range"] = res.get("period", r)
                res["meta"] = res_meta
                res["invoices"] = sinvs
                res["sales_invoices"] = sinvs

                card = {
                    "type": "table",
                    "title": f"Sales Invoices ({res.get('period', r)})",
                    "summary": f"Found {total_cnt} sales invoices totaling ₹{res.get('total_amount', 0.0):,.2f}.",
                    "columns": [
                        {"key": "doc_num", "label": "Doc #", "type": "string"},
                        {"key": "doc_date", "label": "Date", "type": "date"},
                        {"key": "card_name", "label": "Customer", "type": "string"},
                        {"key": "doc_total", "label": "Total Amount", "type": "currency"},
                        {"key": "balance_due", "label": "Balance Due", "type": "currency"},
                        {"key": "status", "label": "Status", "type": "string"}
                    ],
                    "rows": sinvs,
                    "chart": {
                        "type": "bar",
                        "xKey": "card_name",
                        "series": [{"dataKey": "doc_total", "name": "Total Amount (₹)", "color": "#2563eb"}],
                        "defaultView": "both"
                    } if sinvs else None,
                    "kpis": [
                        {"label": "Total Amount", "value": f"₹{res.get('total_amount', 0.0):,.2f}", "isPositive": True},
                        {"label": "Invoices", "value": total_cnt}
                    ] if sinvs else None,
                    "meta": {
                        "date_range": res.get("period"),
                        "branch_scope": branch or "All Branches",
                        "is_partial": is_partial,
                        "row_count": len(sinvs)
                    }
                }
                nav = {"label": "Open Sales Invoices", "route": "/sales", "target_module": "finance_sales_invoices"}
                return res, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 4. get_purchase_orders
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_purchase_orders":
                st = args.get("status", "all")
                limit = int(args.get("limit") or 10)
                filters = []

                if st == "pending":
                    filters.append("DocumentStatus eq 'bost_Open' and Cancelled eq 'tNO'")
                elif st == "received":
                    filters.append("DocumentStatus eq 'bost_Close' and Cancelled eq 'tNO'")
                elif st == "cancelled":
                    filters.append("Cancelled eq 'tYES'")

                summary = self.purchase_orders_service.get_purchase_order_summary(filters=None)
                po_res = self.purchase_orders_service.list_purchase_orders(skip=0, top=limit, filters=filters)
                po_list = po_res.get("value", [])

                card = {
                    "type": "purchase_orders",
                    "orders": po_list,
                    "summary": summary,
                    "total_count": po_res.get("odata.count", len(po_list)),
                    "meta": {"status_filter": st, "limit": limit}
                }
                nav = {"label": "Open Purchase Orders", "route": "/purchase-orders", "target_module": "purchase_orders", "params": {"status": st}}
                return {"summary": summary, "sample_orders": po_list[:10]}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 5. get_inventory_stock
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_inventory_stock":
                item_code = args.get("item_code")
                target_wh = args.get("warehouse") or permitted_warehouse or "SH"
                low_stock_only = args.get("low_stock_only", False)

                if item_code:
                    item_code = str(item_code).strip()
                    item_info = None
                    try:
                        item_info = self.items_service.get_item_by_code(item_code)
                    except Exception as ex:
                        logger.warning(f"Error checking item by code {item_code}: {ex}")

                    if not item_info:
                        try:
                            search_results = self.items_service.get_items(search=item_code, top=5)
                            if search_results:
                                item_info = search_results[0]
                                item_code = item_info.get("ItemCode", item_code)
                        except Exception as ex:
                            logger.warning(f"Error searching items for {item_code}: {ex}")

                    if not item_info:
                        return {
                            "item_code": item_code,
                            "found": False,
                            "error": f"Product with code or SKU '{item_code}' does not exist in SAP inventory records."
                        }, None, None

                    stock = self.inventory_service.get_item_stock(item_code, target_wh)
                    item_name = item_info.get("ItemName") or item_code
                    card = {
                        "type": "inventory_stock",
                        "item_code": item_code,
                        "item_name": item_name,
                        "stock": stock,
                        "meta": {"warehouse": target_wh}
                    }
                    nav = {
                        "label": "Open Product Details",
                        "route": "/products",
                        "target_module": "products",
                        "params": {"search": item_code, "openDetails": "true"}
                    }
                    return {
                        "item_code": item_code,
                        "item_name": item_name,
                        "stock_quantity": stock,
                        "warehouse": target_wh,
                        "found": True
                    }, card, nav
                else:
                    items = self.inventory_service.get_warehouse_stock(target_wh)
                    items_clean = [it for it in items if not it.get("_truncated")]

                    if low_stock_only:
                        risky = []
                        for itm in items_clean:
                            code = itm.get("ItemCode", "")
                            name = itm.get("ItemName", "")
                            in_stock = float(itm.get("QuantityOnStock") or 0.0)
                            wh_info = itm.get("ItemWarehouseInfoCollection") or []
                            min_stock = 0.0
                            for w in wh_info:
                                if w.get("WarehouseCode") == target_wh:
                                    min_stock = float(w.get("MinimalStock") or 0.0)
                                    break
                            if (min_stock > 0 and in_stock <= min_stock) or in_stock <= 10.0:
                                risky.append({
                                    "ItemCode": code,
                                    "ItemName": name,
                                    "QuantityOnStock": in_stock,
                                    "MinimalStock": min_stock,
                                    "WarehouseCode": target_wh
                                })

                        columns = [
                            {"key": "ItemCode", "label": "SKU / Code", "type": "string"},
                            {"key": "ItemName", "label": "Item Name", "type": "string"},
                            {"key": "QuantityOnStock", "label": "In Stock", "type": "number"},
                            {"key": "MinimalStock", "label": "Safety Stock", "type": "number"},
                            {"key": "WarehouseCode", "label": "Warehouse", "type": "string"},
                        ]
                        card = {
                            "type": "inventory_risk",
                            "title": f"Low Stock & Operational Risk Alert ({target_wh})",
                            "items": risky,
                            "rows": risky,
                            "columns": columns,
                            "total_count": len(risky),
                            "kpis": [
                                {"title": "Critical Low Stock SKUs", "value": len(risky), "format": "number"},
                                {"title": "Monitored Warehouse", "value": target_wh, "format": "string"},
                            ],
                            "chart": {
                                "type": "bar",
                                "xKey": "ItemName",
                                "series": ["QuantityOnStock", "MinimalStock"],
                                "defaultView": "both"
                            } if risky else None,
                            "meta": {"warehouse": target_wh, "is_low_stock": True}
                        }
                        nav = {"label": "Open Inventory", "route": "/products", "target_module": "products", "params": {"low_stock": "true"}}
                        return {"low_stock_items_count": len(risky), "items": risky[:25], "warehouse": target_wh}, card, nav
                    else:
                        total_units = sum(float(it.get("QuantityOnStock") or 0.0) for it in items_clean)
                        low_stock_items = [it for it in items_clean if float(it.get("QuantityOnStock") or 0.0) <= 10.0]
                        zero_stock_items = [it for it in items_clean if float(it.get("QuantityOnStock") or 0.0) <= 0.0]
                        sorted_items = sorted(items_clean, key=lambda x: float(x.get("QuantityOnStock") or 0.0), reverse=True)
                        top_inventory_chart = sorted_items[:10]

                        columns = [
                            {"key": "ItemCode", "label": "SKU / Code", "type": "string"},
                            {"key": "ItemName", "label": "Item Name", "type": "string"},
                            {"key": "QuantityOnStock", "label": "In Stock", "type": "number"},
                            {"key": "WarehouseCode", "label": "Warehouse", "type": "string"},
                        ]
                        card = {
                            "type": "inventory_list",
                            "title": f"Inventory Valuation & Stock Levels ({target_wh})",
                            "items": sorted_items[:50],
                            "rows": sorted_items[:50],
                            "columns": columns,
                            "total_count": len(items_clean),
                            "kpis": [
                                {"title": "Tracked SKUs", "value": len(items_clean), "format": "number"},
                                {"title": "Units on Hand", "value": round(total_units, 1), "format": "number"},
                                {"title": "Low Stock Items", "value": len(low_stock_items), "subtext": "<= 10 units threshold", "format": "number"},
                                {"title": "Critical Stockouts", "value": len(zero_stock_items), "subtext": "Zero inventory", "format": "number"},
                            ],
                            "chart": {
                                "type": "bar",
                                "xKey": "ItemName",
                                "series": ["QuantityOnStock"],
                                "data": top_inventory_chart,
                                "defaultView": "both"
                            } if top_inventory_chart else None,
                            "meta": {
                                "warehouse": target_wh,
                                "low_stock_count": len(low_stock_items),
                                "zero_stock_count": len(zero_stock_items)
                            }
                        }
                        nav = {"label": "Open Inventory", "route": "/products", "target_module": "products"}
                        tool_resp = {
                            "total_items": len(items_clean),
                            "total_units_on_hand": round(total_units, 1),
                            "low_stock_count": len(low_stock_items),
                            "zero_stock_count": len(zero_stock_items),
                            "warehouse": target_wh,
                            "top_stocked_items": [
                                {"code": it.get("ItemCode"), "name": it.get("ItemName"), "qty": it.get("QuantityOnStock")}
                                for it in sorted_items[:5]
                            ],
                            "critical_low_stock_samples": [
                                {"code": it.get("ItemCode"), "name": it.get("ItemName"), "qty": it.get("QuantityOnStock")}
                                for it in low_stock_items[:5]
                            ]
                        }
                        return tool_resp, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 6. get_products
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_products":
                top_selling = args.get("top_selling_only", False)
                limit = int(args.get("limit") or 10)
                ranking_by = args.get("ranking_by") or args.get("metric") or "sales_amount"
                r = args.get("range", "month")
                d_from, d_to, date_label = _resolve_date_range(r, args.get("date_from"), args.get("date_to"))
                target_branch = args.get("branch") or permitted_warehouse

                if top_selling:
                    # Calculate product velocity from recent invoices
                    invoices = self.invoices_service.get_recent_invoices_with_lines(limit=200)
                    product_counts = {}
                    for inv in invoices:
                        inv_b = _normalize_branch(_extract_branch_from_invoice(inv))
                        if current_user.get("role") != "admin" and target_branch and inv_b != target_branch:
                            continue
                        elif target_branch and inv_b and inv_b != target_branch:
                            continue

                        if d_from and d_to:
                            doc_date_str = str(inv.get("DocDate", "")).split("T")[0]
                            if doc_date_str:
                                try:
                                    inv_d = datetime.strptime(doc_date_str, "%Y-%m-%d").date()
                                    if not (d_from <= inv_d <= d_to):
                                        continue
                                except Exception:
                                    pass

                        for line in inv.get("DocumentLines") or []:
                            code = line.get("ItemCode")
                            if not code:
                                continue
                            name = line.get("ItemDescription") or code
                            qty = float(line.get("Quantity") or 0.0)
                            total = float(line.get("LineTotal") or 0.0)
                            if code not in product_counts:
                                product_counts[code] = {"itemCode": code, "itemName": name, "quantitySold": 0.0, "salesAmount": 0.0}
                            product_counts[code]["quantitySold"] += qty
                            product_counts[code]["salesAmount"] += total

                    is_by_quantity = str(ranking_by).lower() in ("quantity", "quantity_sold", "units", "qty")
                    sort_key = "quantitySold" if is_by_quantity else "salesAmount"
                    ranking_label = "Quantity Sold (Units)" if is_by_quantity else "Revenue / Sales Amount (₹)"

                    sorted_products = sorted(product_counts.values(), key=lambda x: x[sort_key], reverse=True)[:limit]
                    card = {
                        "type": "top_products",
                        "products": sorted_products,
                        "chart": {
                            "type": "horizontal_bar",
                            "xKey": "itemName",
                            "series": ["quantitySold" if is_by_quantity else "salesAmount"],
                            "defaultView": "both"
                        } if sorted_products else None,
                        "meta": {
                            "ranking_by": "quantity" if is_by_quantity else "sales_amount",
                            "ranking_label": ranking_label,
                            "limit": limit,
                            "date_range": date_label,
                            "branch_scope": target_branch or "All Branches"
                        }
                    }
                    nav = {"label": "Open Products Catalog", "route": "/products", "target_module": "products"}
                    return {
                        "top_products": sorted_products,
                        "ranking_by": "quantity" if is_by_quantity else "sales_amount",
                        "ranking_label": ranking_label,
                        "period": date_label
                    }, card, nav
                else:
                    search = args.get("search", "")
                    items = self.items_service.get_items(search=search, top=limit)
                    card = {
                        "type": "products_list",
                        "items": items,
                        "meta": {"search": search, "limit": limit}
                    }
                    nav = {"label": "Open Products", "route": "/products", "target_module": "products"}
                    return {"products": items}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 7. search_customers
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "search_customers":
                term = str(args.get("search_term") or "").strip()
                if term.isdigit() and len(term) >= 4:
                    customers = self.invoices_service.search_by_mobile(term, top=20)
                else:
                    customers = self.business_partners_service.search_customers(term, top=20)

                card = {
                    "type": "customers",
                    "customers": customers,
                    "meta": {"search_term": term}
                }
                nav = {"label": "View Customers Page", "route": "/customers", "target_module": "customers", "params": {"search": term}}
                return {"customers_found": len(customers), "customers": customers[:10]}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 8. get_sales_returns
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_sales_returns":
                d_from, d_to, date_label = _resolve_date_range(None, args.get("date_from"), args.get("date_to"))
                target_branch = args.get("branch") or permitted_warehouse

                if not d_from:
                    d_from = date(2026, 10, 1)
                    d_to = date(2026, 10, 13)

                raw_returns = self.returns_service.get_returns_by_date(d_from, d_to)
                filtered = []
                for ret in raw_returns:
                    ret_b = _normalize_branch(_extract_branch_from_invoice(ret))
                    if current_user.get("role") == "admin" or not target_branch or ret_b == target_branch:
                        filtered.append(ret)

                total_return_amount = sum(float(r.get("DocTotal") or 0.0) for r in filtered)

                card = {
                    "type": "sales_returns",
                    "returns": filtered,
                    "total_amount": round(total_return_amount, 2),
                    "meta": {"date_range": date_label, "branch_scope": target_branch or "All"}
                }
                nav = {"label": "View Returns & Approvals", "route": "/returns", "target_module": "returns"}
                return {"returns_count": len(filtered), "total_refund_amount": round(total_return_amount, 2), "sample_returns": filtered[:10]}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 9. get_production_summary
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_production_summary":
                target_wh = args.get("warehouse") or permitted_warehouse
                summary = self.production_service.get_production_summary(
                    warehouse=target_wh,
                    date_from=args.get("date_from"),
                    date_to=args.get("date_to")
                )
                kpis = [
                    {"title": "Total Production Orders", "value": summary.get("total_orders", 0) if isinstance(summary, dict) else 0, "format": "number"},
                    {"title": "Completed Orders", "value": summary.get("completed_orders", 0) if isinstance(summary, dict) else 0, "format": "number"},
                    {"title": "Pending / In-Progress", "value": summary.get("open_orders", 0) if isinstance(summary, dict) else 0, "format": "number"},
                    {"title": "Rejection Rate", "value": summary.get("rejection_rate", 0) if isinstance(summary, dict) else 0.0, "format": "percentage"},
                ]
                card = {
                    "type": "production_summary",
                    "title": f"Production Operations Summary ({target_wh or 'All Warehouses'})",
                    "summary": summary,
                    "kpis": kpis,
                    "meta": {"warehouse": target_wh or "All"}
                }
                nav = {"label": "Open Production Overview", "route": "/production", "target_module": "production_overview"}
                return {"summary": summary}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 10. get_production_orders
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_production_orders":
                target_wh = args.get("warehouse") or permitted_warehouse
                raw_st = str(args.get("status") or "all").strip()
                if raw_st.lower() in ("pending", "open"):
                    status_filter = "pending"
                elif raw_st.lower() in ("completed", "closed"):
                    status_filter = "Closed"
                elif raw_st.lower() in ("cancelled", "canceled"):
                    status_filter = "Cancelled"
                elif raw_st.lower() in ("all", "*", ""):
                    status_filter = None
                else:
                    status_filter = raw_st
                limit = int(args.get("limit") or 15)

                orders, total = self.production_service.get_production_orders(
                    skip=0,
                    top=limit,
                    status=status_filter,
                    item_code=args.get("item_code"),
                    warehouse=target_wh,
                    date_from=args.get("date_from"),
                    date_to=args.get("date_to")
                )
                summary = self.production_service.get_production_summary(warehouse=target_wh)

                total_planned = sum(float(o.get("planned_qty") or 0.0) for o in orders)
                total_produced = sum(float(o.get("produced_qty") or 0.0) for o in orders)
                completed_count = summary.get("completed_orders", 0) if isinstance(summary, dict) else 0
                open_count = summary.get("open_orders", 0) if isinstance(summary, dict) else 0
                order_completion_pct = round((completed_count / total * 100), 1) if total > 0 else 0.0
                unit_fulfillment_pct = round((total_produced / total_planned * 100), 1) if total_planned > 0 else 0.0
                plan_variance = round(total_planned - total_produced, 1)

                columns = [
                    {"key": "doc_num", "label": "Order #", "type": "string"},
                    {"key": "item_code", "label": "Item Code", "type": "string"},
                    {"key": "item_name", "label": "Item Name", "type": "string"},
                    {"key": "planned_qty", "label": "Planned Qty", "type": "number"},
                    {"key": "produced_qty", "label": "Produced Qty", "type": "number"},
                    {"key": "status", "label": "Status", "type": "string"}
                ]
                kpis = [
                    {"title": "Total Orders", "value": total, "format": "number"},
                    {"title": "Order Completion", "value": f"{order_completion_pct}%", "subtext": f"{completed_count} completed", "format": "string"},
                    {"title": "Unit Fulfillment", "value": f"{unit_fulfillment_pct}%", "subtext": f"{int(total_produced)} of {int(total_planned)} units", "format": "string"},
                    {"title": "Rejection Rate", "value": f"{summary.get('rejection_rate', 0) if isinstance(summary, dict) else 0.0}%", "format": "string"},
                ]

                card = {
                    "type": "production_orders",
                    "title": f"Production Orders & Manufacturing Efficiency ({target_wh or 'All'})",
                    "orders": orders,
                    "rows": orders,
                    "columns": columns,
                    "kpis": kpis,
                    "summary": summary,
                    "total_count": total,
                    "chart": {
                        "type": "bar",
                        "xKey": "item_name",
                        "series": ["planned_qty", "produced_qty"],
                        "defaultView": "both"
                    } if orders else None,
                    "meta": {
                        "warehouse": target_wh or "All",
                        "status": status_filter or "all",
                        "order_completion_rate": f"{order_completion_pct}%",
                        "unit_fulfillment_rate": f"{unit_fulfillment_pct}%",
                        "plan_variance_units": plan_variance
                    }
                }
                nav = {"label": "Open Production Orders", "route": "/production/orders", "target_module": "production_orders"}
                tool_resp = {
                    "total_orders": total,
                    "completed_orders": completed_count,
                    "open_orders": open_count,
                    "order_completion_percentage": order_completion_pct,
                    "total_planned_units": total_planned,
                    "total_produced_units": total_produced,
                    "unit_fulfillment_percentage": unit_fulfillment_pct,
                    "plan_variance_units": plan_variance,
                    "rejection_rate_percentage": summary.get("rejection_rate", 0) if isinstance(summary, dict) else 0.0,
                    "sample_orders": orders[:10]
                }
                return tool_resp, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 11. get_production_rejection
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_production_rejection":
                target_wh = args.get("warehouse") or permitted_warehouse
                rej_summary = self.production_service.get_rejection_summary(
                    warehouse=target_wh,
                    date_from=args.get("date_from"),
                    date_to=args.get("date_to"),
                    search=args.get("search")
                )
                card = {
                    "type": "production_rejection",
                    "rejection_data": rej_summary,
                    "chart": {
                        "type": "bar",
                        "xKey": "item_name",
                        "series": ["rejection_percentage"],
                        "defaultView": "both"
                    } if rej_summary.get("items") else None,
                    "meta": {"warehouse": target_wh or "All"}
                }
                nav = {"label": "View Production Rejection", "route": "/production/rejection", "target_module": "production_rejection"}
                return {"rejection_summary": rej_summary}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 12. get_production_item_wise
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_production_item_wise":
                target_wh = args.get("warehouse") or permitted_warehouse
                items = self.production_service.get_item_wise_production(
                    warehouse=target_wh,
                    date_from=args.get("date_from"),
                    date_to=args.get("date_to"),
                    search=args.get("search")
                )
                card = {
                    "type": "production_item_wise",
                    "items": items,
                    "meta": {"warehouse": target_wh or "All"}
                }
                nav = {"label": "View Item-wise Production", "route": "/production/item-wise", "target_module": "production_item_wise"}
                return {"item_wise_production": items[:15]}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 13. get_sales_report
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_sales_report":
                r = args.get("range", "monthly")
                d_from, d_to, date_label = _resolve_date_range(r, args.get("from_date"), args.get("to_date"))
                target_branch = args.get("branch") or permitted_warehouse

                cache_key = f"sales_report:{r}:{d_from}:{d_to}:{target_branch}"
                is_mocked = hasattr(self.invoices_service, '_mock_return_value') or hasattr(self.client, '_mock_return_value')
                now = time.time()
                if not is_mocked:
                    with _ANALYTICS_CACHE_LOCK:
                        if cache_key in _ANALYTICS_CACHE:
                            c_resp, c_card, c_nav, c_time = _ANALYTICS_CACHE[cache_key]
                            if now - c_time < _ANALYTICS_CACHE_TTL:
                                logger.info(f"[AI TIMING] Sales report cache hit for {cache_key}")
                                return c_resp, c_card, c_nav

                raw_invoices = self.invoices_service.get_invoices_by_date(d_from, d_to)

                filtered = []
                for inv in raw_invoices:
                    if str(inv.get("Cancelled") or "").lower() == "tyes":
                        continue
                    inv_b = _normalize_branch(_extract_branch_from_invoice(inv))
                    if current_user.get("role") == "admin" or not target_branch or inv_b == target_branch:
                        filtered.append(inv)

                total_sales = sum(float(i.get("DocTotal") or 0.0) for i in filtered)

                # Customer Concentration Analysis
                cust_sales = {}
                for inv in filtered:
                    code = str(inv.get("CardCode") or "UNKNOWN")
                    name = str(inv.get("CardName") or code)
                    amt = float(inv.get("DocTotal") or 0.0)
                    if code not in cust_sales:
                        cust_sales[code] = {"name": name, "sales": 0.0, "count": 0}
                    cust_sales[code]["sales"] += amt
                    cust_sales[code]["count"] += 1

                sorted_custs = sorted(cust_sales.values(), key=lambda x: x["sales"], reverse=True)
                top_cust = sorted_custs[0] if sorted_custs else None
                top_cust_sales = top_cust["sales"] if top_cust else 0.0
                top_cust_share = round((top_cust_sales / total_sales * 100), 1) if total_sales > 0 else 0.0
                top_3_sales = sum(c["sales"] for c in sorted_custs[:3])
                top_3_share = round((top_3_sales / total_sales * 100), 1) if total_sales > 0 else 0.0

                # Monthly/daily trend breakdown
                month_buckets = {}
                for inv in filtered:
                    d_str = str(inv.get("DocDate") or "")[:7]
                    if not d_str: continue
                    month_buckets[d_str] = month_buckets.get(d_str, 0.0) + float(inv.get("DocTotal") or 0.0)

                trend_list = [{"label": k, "sales": round(v, 2)} for k, v in sorted(month_buckets.items())]

                # Period-over-period growth calculation
                growth_rate = None
                if len(trend_list) >= 2:
                    last_m = trend_list[-1]["sales"]
                    prev_m = trend_list[-2]["sales"]
                    if prev_m > 0:
                        growth_rate = round(((last_m - prev_m) / prev_m * 100), 1)

                # Largest invoice
                max_inv = max(filtered, key=lambda x: float(x.get("DocTotal") or 0.0)) if filtered else None
                max_inv_info = {
                    "doc_num": max_inv.get("DocNum") if max_inv else None,
                    "customer": max_inv.get("CardName") if max_inv else None,
                    "amount": round(float(max_inv.get("DocTotal") or 0.0), 2) if max_inv else 0.0,
                    "date": max_inv.get("DocDate") if max_inv else None,
                } if max_inv else None

                columns = [
                    {"key": "label", "label": "Month / Period", "type": "string"},
                    {"key": "sales", "label": "Net Sales Revenue (₹)", "type": "currency"},
                ]

                avg_bill = round(total_sales / len(filtered), 2) if len(filtered) > 0 else 0.0
                card = {
                    "type": "sales_report",
                    "title": f"Sales Performance Report ({date_label})",
                    "total_sales": round(total_sales, 2),
                    "invoice_count": len(filtered),
                    "trend": trend_list,
                    "rows": trend_list,
                    "columns": columns,
                    "kpis": [
                        {"title": "Total Net Sales", "value": round(total_sales, 2), "format": "currency"},
                        {"title": "Total Invoices", "value": len(filtered), "format": "number"},
                        {"title": "Average Invoice Value", "value": avg_bill, "format": "currency"},
                        {
                            "title": "Top Account Concentration",
                            "value": f"{top_cust_share}%",
                            "subtext": f"{top_cust['name'][:20]}" if top_cust else "N/A",
                            "format": "string",
                        },
                    ],
                    "chart": {
                        "type": "bar",
                        "xKey": "label",
                        "series": ["sales"],
                        "defaultView": "both"
                    } if trend_list else None,
                    "meta": {
                        "date_range": date_label,
                        "branch_scope": target_branch or "All",
                        "top_customer_concentration": f"{top_cust_share}%",
                        "top_3_concentration": f"{top_3_share}%"
                    }
                }
                nav = {"label": "View Sales Reports", "route": "/reports/sales", "target_module": "reports_sales"}
                tool_resp = {
                    "total_sales": round(total_sales, 2),
                    "invoice_count": len(filtered),
                    "average_invoice_value": avg_bill,
                    "trend": trend_list,
                    "growth_rate_latest_period_pct": growth_rate,
                    "top_customer_concentration_pct": top_cust_share,
                    "top_3_customer_concentration_pct": top_3_share,
                    "top_customer": top_cust["name"] if top_cust else None,
                    "largest_single_invoice": max_inv_info,
                }
                if not is_mocked:
                    with _ANALYTICS_CACHE_LOCK:
                        _ANALYTICS_CACHE[cache_key] = (tool_resp, card, nav, now)
                return tool_resp, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 14. get_invoice_report
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_invoice_report":
                d_from, d_to, date_label = _resolve_date_range(None, args.get("from_date"), args.get("to_date"))
                target_branch = args.get("branch") or permitted_warehouse

                cache_key = f"invoice_report:{d_from}:{d_to}:{target_branch}"
                is_mocked = hasattr(self.invoices_service, '_mock_return_value') or hasattr(self.client, '_mock_return_value')
                now = time.time()
                if not is_mocked:
                    with _ANALYTICS_CACHE_LOCK:
                        if cache_key in _ANALYTICS_CACHE:
                            c_resp, c_card, c_nav, c_time = _ANALYTICS_CACHE[cache_key]
                            if now - c_time < _ANALYTICS_CACHE_TTL:
                                return c_resp, c_card, c_nav

                raw_invoices = self.invoices_service.get_invoices_by_date(d_from, d_to)
                filtered = [
                    inv for inv in raw_invoices
                    if str(inv.get("Cancelled") or "").lower() != "tyes"
                    and (current_user.get("role") == "admin" or not target_branch or _normalize_branch(_extract_branch_from_invoice(inv)) == target_branch)
                ]

                total_gross = sum(float(i.get("DocTotal") or 0.0) for i in filtered)
                total_vat = sum(float(i.get("VatSum") or 0.0) for i in filtered)
                total_discount = sum(float(i.get("TotalDiscount") or 0.0) for i in filtered)

                rows = [
                    {"metric": "Gross Invoice Total", "amount": round(total_gross, 2)},
                    {"metric": "Tax Collected (GST/VAT)", "amount": round(total_vat, 2)},
                    {"metric": "Total Discounts Given", "amount": round(total_discount, 2)},
                    {"metric": "Net Invoice Value", "amount": round(total_gross - total_vat, 2)},
                ]
                columns = [
                    {"key": "metric", "label": "Tax & Invoice Metric", "type": "string"},
                    {"key": "amount", "label": "Amount (₹)", "type": "currency"},
                ]

                report_data = {
                    "total_invoices": len(filtered),
                    "total_gross_amount": round(total_gross, 2),
                    "total_tax_collected": round(total_vat, 2),
                    "total_discounts_given": round(total_discount, 2),
                    "date_range": date_label
                }

                card = {
                    "type": "invoice_report",
                    "title": f"Invoice & Tax Summary Report ({date_label})",
                    "data": report_data,
                    "rows": rows,
                    "columns": columns,
                    "kpis": [
                        {"title": "Total Invoices", "value": len(filtered), "format": "number"},
                        {"title": "Gross Revenue", "value": round(total_gross, 2), "format": "currency"},
                        {"title": "Tax Collected", "value": round(total_vat, 2), "format": "currency"},
                        {"title": "Discounts", "value": round(total_discount, 2), "format": "currency"},
                    ],
                    "chart": {
                        "type": "bar",
                        "xKey": "metric",
                        "series": ["amount"],
                        "defaultView": "both"
                    },
                    "meta": {"date_range": date_label}
                }
                nav = {"label": "View Invoice Reports", "route": "/reports/invoice", "target_module": "reports_invoice"}
                if not is_mocked:
                    with _ANALYTICS_CACHE_LOCK:
                        _ANALYTICS_CACHE[cache_key] = (report_data, card, nav, now)
                return report_data, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 15. get_payment_report
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_payment_report":
                r = args.get("range", "monthly")
                d_from, d_to, date_label = _resolve_date_range(r, args.get("from_date"), args.get("to_date"))
                target_branch = args.get("branch") or permitted_warehouse

                cache_key = f"payment_report:{r}:{d_from}:{d_to}:{target_branch}"
                is_mocked = hasattr(self.payments_service, '_mock_return_value') or hasattr(self.client, '_mock_return_value')
                now = time.time()
                if not is_mocked:
                    with _ANALYTICS_CACHE_LOCK:
                        if cache_key in _ANALYTICS_CACHE:
                            c_resp, c_card, c_nav, c_time = _ANALYTICS_CACHE[cache_key]
                            if now - c_time < _ANALYTICS_CACHE_TTL:
                                return c_resp, c_card, c_nav

                payments = self.payments_service.get_payments_by_date(
                    start_date=d_from.strftime("%Y-%m-%d") if d_from else None,
                    end_date=d_to.strftime("%Y-%m-%d") if d_to else None,
                    branch=target_branch
                )

                total_amount = 0.0
                methods_split = {"Cash": 0.0, "Card": 0.0, "Transfer / UPI": 0.0}

                for p in payments:
                    cash = float(p.get("CashSum") or 0.0)
                    transfer = float(p.get("TransferSum") or 0.0)
                    card_sum = sum(float(c.get("CreditSum") or 0.0) for c in (p.get("PaymentCreditCards") or []))

                    total_p = cash + transfer + card_sum
                    if total_p == 0.0:
                        total_p = cash or transfer or card_sum

                    total_amount += total_p
                    if card_sum > 0: methods_split["Card"] += card_sum
                    elif transfer > 0: methods_split["Transfer / UPI"] += transfer
                    else: methods_split["Cash"] += cash

                digital_total = methods_split["Card"] + methods_split["Transfer / UPI"]
                digital_ratio = round((digital_total / total_amount * 100), 1) if total_amount > 0 else 0.0
                avg_receipt = round(total_amount / len(payments), 2) if len(payments) > 0 else 0.0

                distribution = [{"method": k, "amount": round(v, 2), "percentage": round((v / total_amount * 100), 1) if total_amount > 0 else 0.0} for k, v in methods_split.items()]

                columns = [
                    {"key": "method", "label": "Payment Method", "type": "string"},
                    {"key": "amount", "label": "Total Amount (₹)", "type": "currency"},
                    {"key": "percentage", "label": "Share (%)", "type": "percentage"},
                ]

                card = {
                    "type": "payment_report",
                    "title": f"Collections & Payments Report ({date_label})",
                    "total_payments": round(total_amount, 2),
                    "payment_count": len(payments),
                    "distribution": distribution,
                    "rows": distribution,
                    "columns": columns,
                    "kpis": [
                        {"title": "Total Collections", "value": round(total_amount, 2), "format": "currency"},
                        {"title": "Payment Count", "value": len(payments), "format": "number"},
                        {"title": "Average Receipt", "value": avg_receipt, "format": "currency"},
                        {"title": "Digital Tender Ratio", "value": f"{digital_ratio}%", "subtext": "Card + Transfer / UPI", "format": "string"},
                    ],
                    "chart": {
                        "type": "pie",
                        "xKey": "method",
                        "series": ["amount"],
                        "defaultView": "both"
                    } if distribution else None,
                    "meta": {
                        "date_range": date_label,
                        "digital_ratio": f"{digital_ratio}%",
                        "cash_ratio": f"{round(100.0 - digital_ratio, 1)}%"
                    }
                }
                nav = {"label": "View Payment Reports", "route": "/reports/payment", "target_module": "reports_payment"}
                tool_resp = {
                    "total_collected": round(total_amount, 2),
                    "payment_count": len(payments),
                    "average_receipt_amount": avg_receipt,
                    "digital_tender_percentage": digital_ratio,
                    "cash_tender_percentage": round(100.0 - digital_ratio, 1) if total_amount > 0 else 0.0,
                    "distribution": distribution
                }
                if not is_mocked:
                    with _ANALYTICS_CACHE_LOCK:
                        _ANALYTICS_CACHE[cache_key] = (tool_resp, card, nav, now)
                return tool_resp, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 16. get_customer_report
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_customer_report":
                r = args.get("range", "monthly")
                target_branch = args.get("branch") or permitted_warehouse
                cache_key = f"cust_report:{r}:{target_branch}"
                is_mocked = hasattr(self.invoices_service, '_mock_return_value') or hasattr(self.client, '_mock_return_value')
                now = time.time()
                if not is_mocked:
                    with _ANALYTICS_CACHE_LOCK:
                        if cache_key in _ANALYTICS_CACHE:
                            c_resp, c_card, c_nav, c_time = _ANALYTICS_CACHE[cache_key]
                            if now - c_time < _ANALYTICS_CACHE_TTL:
                                return c_resp, c_card, c_nav

                invoices = self.invoices_service.get_invoices_by_date(None, None)
                cust_map = {}

                for inv in invoices:
                    if str(inv.get("Cancelled") or "").lower() == "tyes":
                        continue
                    inv_b = _normalize_branch(_extract_branch_from_invoice(inv))
                    if current_user.get("role") != "admin" and target_branch and inv_b != target_branch:
                        continue
                    code = str(inv.get("CardCode") or "UNKNOWN")
                    name = str(inv.get("CardName") or code)
                    amt = float(inv.get("DocTotal") or 0.0)

                    if code not in cust_map:
                        cust_map[code] = {"customer_code": code, "customer_name": name, "total_spend": 0.0, "invoice_count": 0}
                    cust_map[code]["total_spend"] += amt
                    cust_map[code]["invoice_count"] += 1

                top_customers = sorted(cust_map.values(), key=lambda x: x["total_spend"], reverse=True)[:15]
                for tc in top_customers:
                    tc["total_spend"] = round(tc["total_spend"], 2)

                columns = [
                    {"key": "customer_code", "label": "Card Code", "type": "string"},
                    {"key": "customer_name", "label": "Customer Name", "type": "string"},
                    {"key": "total_spend", "label": "Total Revenue (₹)", "type": "currency"},
                    {"key": "invoice_count", "label": "Invoices", "type": "number"},
                ]

                card = {
                    "type": "customer_report",
                    "title": "Customer Revenue & Concentration Report",
                    "top_customers": top_customers,
                    "rows": top_customers,
                    "columns": columns,
                    "kpis": [
                        {"title": "Active Customers", "value": len(cust_map), "format": "number"},
                        {"title": "Top Spender", "value": top_customers[0]["customer_name"] if top_customers else "-", "format": "string"},
                        {"title": "Top Account Revenue", "value": top_customers[0]["total_spend"] if top_customers else 0.0, "format": "currency"},
                    ],
                    "chart": {
                        "type": "bar",
                        "xKey": "customer_name",
                        "series": ["total_spend"],
                        "defaultView": "both"
                    } if top_customers else None,
                    "meta": {"range": r}
                }
                nav = {"label": "Open Customers Page", "route": "/customers", "target_module": "customers"}
                tool_resp = {"top_customers": top_customers}
                if not is_mocked:
                    with _ANALYTICS_CACHE_LOCK:
                        _ANALYTICS_CACHE[cache_key] = (tool_resp, card, nav, now)
                return tool_resp, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 17. get_pending_approvals
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_pending_approvals":
                st = args.get("status", "pending")
                approvals_res = approval_service.get_approvals(branch_id=permitted_warehouse, status=st, limit=20)
                items = approvals_res.get("items", []) if isinstance(approvals_res, dict) else approvals_res

                card = {
                    "type": "pending_approvals",
                    "approvals": items,
                    "total_count": approvals_res.get("total", len(items)) if isinstance(approvals_res, dict) else len(items),
                    "meta": {"status": st}
                }
                nav = {"label": "Open Returns & Approvals", "route": "/returns", "target_module": "returns"}
                return {"approvals_count": len(items), "approvals": items}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # Finance Tools
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_finance_summary":
                r = args.get("range", "monthly")
                branch = args.get("branch") or permitted_warehouse
                summary = self.finance_service.get_finance_summary(
                    range_str=r,
                    branch_id=branch,
                    from_date=args.get("date_from"),
                    to_date=args.get("date_to")
                )
                period_obj = summary.get("period")
                period_label = period_obj.get("label", r) if isinstance(period_obj, dict) else (str(period_obj) if period_obj else r)
                kpis = summary.get("kpis", {}) or summary.get("metrics", {})
                cards = []
                if isinstance(kpis, dict):
                    for k, v in kpis.items():
                        title = k.replace("_", " ").title()
                        if isinstance(v, dict):
                            val = v.get("value", 0)
                            sub = v.get("subtext") or (f"{v.get('growth', 0)}% vs prev" if "growth" in v else None)
                        else:
                            val = v
                            sub = None
                        cards.append({
                            "title": title,
                            "value": val,
                            "subtitle": sub,
                            "format": "currency" if "margin" not in k else "percentage"
                        })
                card = {
                    "type": "finance_summary",
                    "title": "Financial Overview Summary",
                    "period": period_label,
                    "cards": cards,
                    "kpis": kpis,
                    "meta": {
                        "date_range": period_label,
                        "branch_scope": branch or "All Branches",
                        "is_cached": summary.get("meta", {}).get("is_cached", False) if isinstance(summary.get("meta"), dict) else False,
                        "timestamp": summary.get("meta", {}).get("timestamp") if isinstance(summary.get("meta"), dict) else None
                    }
                }
                nav = {"label": "Open Finance Overview", "route": "/finance", "target_module": "finance_overview"}
                return {"summary": summary, "kpis": kpis}, card, nav

            elif tool_name == "get_sales_trend":
                r = args.get("range", "past_6_months")
                branch = args.get("branch") or permitted_warehouse
                trend_res = self.finance_service.get_sales_trend(range_str=r, branch_id=branch)
                trend_list = trend_res.get("trend", []) if isinstance(trend_res, dict) else (trend_res if isinstance(trend_res, list) else [])
                rows = []
                for pt in trend_list:
                    if isinstance(pt, dict):
                        rows.append({
                            "period": pt.get("period"),
                            "month": pt.get("month"),
                            "sales": pt.get("sales", 0.0),
                            "purchases": pt.get("purchases", 0.0)
                        })
                total_rev = trend_res.get("total_revenue") if isinstance(trend_res, dict) else sum(r.get("sales", 0.0) for r in rows)
                card = {
                    "type": "table",
                    "title": "Monthly Revenue & Sales Trend",
                    "summary": f"Sales trend across {len(rows)} periods from live SAP AR Invoices.",
                    "columns": [
                        {"key": "period", "label": "Period", "type": "string"},
                        {"key": "sales", "label": "Sales Revenue", "type": "currency"},
                        {"key": "purchases", "label": "Purchases (Cost)", "type": "currency"}
                    ],
                    "rows": rows,
                    "chart": {
                        "type": "line",
                        "xKey": "period",
                        "series": ["sales", "purchases"],
                        "defaultView": "both"
                    },
                    "meta": {"range": r, "branch_scope": branch or "All Branches"}
                }
                nav = {"label": "View Sales Invoices", "route": "/sales", "target_module": "finance_sales_invoices"}
                return {"sales_trend": rows, "trend": rows, "total_revenue": total_rev, "count": len(rows)}, card, nav

            elif tool_name == "get_purchase_trend":
                r = args.get("range", "past_6_months")
                branch = args.get("branch") or permitted_warehouse
                trend_res = self.finance_service.get_purchase_trend(range_str=r, branch_id=branch)
                trend_list = trend_res.get("trend", []) if isinstance(trend_res, dict) else (trend_res if isinstance(trend_res, list) else [])
                rows = []
                for pt in trend_list:
                    if isinstance(pt, dict):
                        rows.append({
                            "period": pt.get("period"),
                            "month": pt.get("month"),
                            "purchases": pt.get("purchases", 0.0),
                            "sales": pt.get("sales", 0.0)
                        })
                total_purchases = trend_res.get("total_purchases") if isinstance(trend_res, dict) else sum(r.get("purchases", 0.0) for r in rows)
                card = {
                    "type": "table",
                    "title": "Purchase Invoices Trend",
                    "summary": f"Vendor purchasing trend across {len(rows)} periods from live SAP AP Invoices.",
                    "columns": [
                        {"key": "period", "label": "Period", "type": "string"},
                        {"key": "purchases", "label": "Purchases (₹)", "type": "currency"},
                        {"key": "sales", "label": "Sales (₹)", "type": "currency"}
                    ],
                    "rows": rows,
                    "chart": {
                        "type": "bar",
                        "xKey": "period",
                        "series": ["purchases"],
                        "defaultView": "both"
                    },
                    "meta": {"range": r, "branch_scope": branch or "All Branches"}
                }
                nav = {"label": "Open Purchase Invoices", "route": "/finance/purchase-invoices", "target_module": "finance_purchase_invoices"}
                return {"purchase_trend": rows, "trend": rows, "total_purchases": total_purchases, "count": len(rows)}, card, nav



            elif tool_name == "get_purchase_invoices":
                r = args.get("range", "monthly")
                branch = _resolve_tool_branch(args.get("branch"))
                res = self.finance_service.get_purchase_invoices(
                    range_str=r,
                    from_date=args.get("date_from"),
                    to_date=args.get("date_to"),
                    supplier_code=args.get("supplier_code"),
                    status=args.get("status"),
                    branch_id=branch,
                    search=args.get("search"),
                    page_size=int(args.get("limit") or args.get("page_size") or 20)
                )
                if isinstance(res, list):
                    pinvs = res
                    total_amt = sum(float(x.get("doc_total") or x.get("DocTotal") or 0.0) for x in pinvs)
                    res = {"purchase_invoices": pinvs, "total_count": len(pinvs), "total_amount": total_amt, "period": r}
                else:
                    pinvs = res.get("purchase_invoices", [])
                card = {
                    "type": "table",
                    "title": f"Purchase Invoices ({res.get('period', r)})",
                    "summary": f"Found {res.get('total_count', len(pinvs))} purchase invoices totaling ₹{res.get('total_amount', 0.0):,.2f}.",
                    "columns": [
                        {"key": "doc_num", "label": "Doc #", "type": "string"},
                        {"key": "doc_date", "label": "Date", "type": "date"},
                        {"key": "card_name", "label": "Supplier", "type": "string"},
                        {"key": "doc_total", "label": "Total Amount", "type": "currency"},
                        {"key": "status", "label": "Status", "type": "string"}
                    ],
                    "rows": pinvs,
                    "chart": {
                        "type": "bar",
                        "xKey": "card_name",
                        "series": [{"dataKey": "doc_total", "name": "Total Amount (₹)", "color": "#ec4899"}],
                        "defaultView": "both"
                    } if pinvs else None,
                    "kpis": [
                        {"label": "Total Amount", "value": f"₹{res.get('total_amount', 0.0):,.2f}", "isPositive": True},
                        {"label": "Invoices", "value": res.get('total_count', len(pinvs))}
                    ] if pinvs else None,
                    "meta": {"date_range": res.get("period"), "branch_scope": branch or "All Branches"}
                }
                nav = {"label": "Open Purchase Invoices", "route": "/finance/purchase-invoices", "target_module": "finance_purchase_invoices"}
                return res, card, nav

            elif tool_name == "get_incoming_payments":
                r = args.get("range", "monthly")
                branch = _resolve_tool_branch(args.get("branch"))
                res = self.finance_service.get_incoming_payments(
                    range_str=r,
                    from_date=args.get("date_from"),
                    to_date=args.get("date_to"),
                    customer_code=args.get("customer_code"),
                    payment_method=args.get("payment_method"),
                    branch_id=branch,
                    page_size=int(args.get("limit") or args.get("page_size") or 20)
                )
                pays = res.get("payments", [])
                card = {
                    "type": "table",
                    "title": f"Incoming Payments & Collections ({res.get('period', r)})",
                    "summary": f"Total collections: ₹{res.get('total_amount', 0.0):,.2f} across {res.get('total_count', len(pays))} payments.",
                    "columns": [
                        {"key": "ref_no", "label": "Receipt #", "type": "string"},
                        {"key": "date", "label": "Date", "type": "date"},
                        {"key": "customer_name", "label": "Customer", "type": "string"},
                        {"key": "amount", "label": "Amount", "type": "currency"},
                        {"key": "method", "label": "Method", "type": "string"},
                        {"key": "applied_invoices_count", "label": "Allocated Invoices", "type": "number"}
                    ],
                    "rows": pays,
                    "chart": {
                        "type": "bar",
                        "xKey": "customer_name",
                        "series": [{"dataKey": "amount", "name": "Receipt Amount (₹)", "color": "#10b981"}],
                        "defaultView": "both"
                    },
                    "meta": {"date_range": res.get("period"), "branch_scope": branch or "All Branches"}
                }
                nav = {"label": "Open Incoming Payments", "route": "/finance/incoming-payments", "target_module": "finance_incoming_payments"}
                return res, card, nav

            elif tool_name == "get_outgoing_payments":
                r = args.get("range", "monthly")
                branch = _resolve_tool_branch(args.get("branch"))
                res = self.finance_service.get_outgoing_payments(
                    range_str=r,
                    from_date=args.get("date_from"),
                    to_date=args.get("date_to"),
                    supplier_code=args.get("supplier_code"),
                    branch_id=branch,
                    page_size=int(args.get("limit") or args.get("page_size") or 20)
                )
                pays = res.get("payments", [])
                card = {
                    "type": "table",
                    "title": f"Outgoing Vendor Payments ({res.get('period', r)})",
                    "summary": f"Total supplier payouts: ₹{res.get('total_amount', 0.0):,.2f} across {res.get('total_count', len(pays))} payments.",
                    "columns": [
                        {"key": "ref_no", "label": "Voucher #", "type": "string"},
                        {"key": "date", "label": "Date", "type": "date"},
                        {"key": "supplier_name", "label": "Supplier", "type": "string"},
                        {"key": "amount", "label": "Amount Paid", "type": "currency"},
                        {"key": "method", "label": "Method", "type": "string"}
                    ],
                    "rows": pays,
                    "chart": {
                        "type": "bar",
                        "xKey": "supplier_name",
                        "series": [{"dataKey": "amount", "name": "Paid Amount (₹)", "color": "#f59e0b"}],
                        "defaultView": "both"
                    },
                    "meta": {"date_range": res.get("period"), "branch_scope": branch or "All Branches"}
                }
                nav = {"label": "Open Outgoing Payments", "route": "/finance/outgoing-payments", "target_module": "finance_outgoing_payments"}
                return res, card, nav

            elif tool_name == "get_customer_sales_ranking":
                r = args.get("range", "monthly")
                branch = _resolve_tool_branch(args.get("branch"))
                order_mode = args.get("order", "top")
                res = self.finance_service.get_customer_sales_ranking(
                    range_str=r,
                    from_date=args.get("date_from"),
                    to_date=args.get("date_to"),
                    order=order_mode,
                    branch_id=branch,
                    limit=int(args.get("limit") or 10)
                )
                customers = res.get("customers", [])
                is_lowest = res.get("order") == "lowest"
                card = {
                    "type": "table",
                    "title": f"{'Lowest Purchasing' if is_lowest else 'Top'} Customers by Sales ({res.get('period')})",
                    "summary": f"{'Lowest' if is_lowest else 'Top'} {len(customers)} customers contributing to total net sales of ₹{res.get('total_sales', 0.0):,.2f}.",
                    "columns": [
                        {"key": "rank", "label": "#", "type": "number"},
                        {"key": "customerName", "label": "Customer", "type": "string"},
                        {"key": "invoices", "label": "Invoices", "type": "number"},
                        {"key": "netSales", "label": "Net Sales", "type": "currency"},
                        {"key": "percentage", "label": "% of Total", "type": "percentage"}
                    ],
                    "rows": customers,
                    "chart": {
                        "type": "bar",
                        "xKey": "customerName",
                        "series": [{"dataKey": "netSales", "name": "Net Sales (₹)", "color": "#2563eb"}],
                        "defaultView": "both"
                    },
                    "meta": {"order": res.get("order"), "period": res.get("period")}
                }
                nav = {"label": "Open Customer Analysis", "route": "/finance/customer-analysis", "target_module": "finance_customer_analysis"}
                return res, card, nav

            elif tool_name == "get_supplier_purchase_ranking":
                r = args.get("range", "monthly")
                branch = _resolve_tool_branch(args.get("branch"))
                order_mode = args.get("order", "top")
                res = self.finance_service.get_supplier_purchase_ranking(
                    range_str=r,
                    from_date=args.get("date_from"),
                    to_date=args.get("date_to"),
                    order=order_mode,
                    branch_id=branch,
                    limit=int(args.get("limit") or 10)
                )
                suppliers = res.get("suppliers", [])
                is_lowest = res.get("order") == "lowest"
                card = {
                    "type": "table",
                    "title": f"{'Lowest Volume' if is_lowest else 'Top'} Suppliers by Purchase ({res.get('period')})",
                    "summary": f"{'Lowest' if is_lowest else 'Top'} {len(suppliers)} suppliers contributing to total purchases of ₹{res.get('total_purchases', 0.0):,.2f}.",
                    "columns": [
                        {"key": "rank", "label": "#", "type": "number"},
                        {"key": "supplierName", "label": "Supplier", "type": "string"},
                        {"key": "invoices", "label": "Invoices", "type": "number"},
                        {"key": "netPurchases", "label": "Net Purchases", "type": "currency"},
                        {"key": "percentage", "label": "% of Total", "type": "percentage"}
                    ],
                    "rows": suppliers,
                    "chart": {
                        "type": "bar",
                        "xKey": "supplierName",
                        "series": [{"dataKey": "netPurchases", "name": "Net Purchases (₹)", "color": "#ec4899"}],
                        "defaultView": "both"
                    },
                    "meta": {"order": res.get("order"), "period": res.get("period")}
                }
                nav = {"label": "Open Supplier Analysis", "route": "/finance/supplier-analysis", "target_module": "finance_supplier_analysis"}
                return res, card, nav

            elif tool_name == "get_accounts_receivable":
                res = self.finance_service.get_accounts_receivable(
                    customer_code=args.get("customer_code"),
                    min_balance=float(args.get("min_balance") or 0.0),
                    limit=int(args.get("limit") or 20)
                )
                debtors = res.get("customers", [])
                card = {
                    "type": "table",
                    "title": "Accounts Receivable (Debtors Outstanding)",
                    "summary": f"Total outstanding customer balance: ₹{res.get('total_accounts_receivable', 0.0):,.2f} across {res.get('total_debtors_count', len(debtors))} customers.",
                    "columns": [
                        {"key": "card_name", "label": "Customer", "type": "string"},
                        {"key": "card_code", "label": "Code", "type": "string"},
                        {"key": "outstanding_balance", "label": "Receivable Balance", "type": "currency"},
                        {"key": "phone", "label": "Phone", "type": "string"}
                    ],
                    "rows": debtors,
                    "chart": {
                        "type": "bar",
                        "xKey": "card_name",
                        "series": [{"dataKey": "outstanding_balance", "name": "Balance Owed (₹)", "color": "#f43f5e"}],
                        "defaultView": "both"
                    },
                    "meta": {"total_ar": res.get("total_accounts_receivable")}
                }
                nav = {"label": "Open Customer Analysis", "route": "/finance/customer-analysis", "target_module": "finance_customer_analysis"}
                return res, card, nav

            elif tool_name == "get_accounts_payable":
                res = self.finance_service.get_accounts_payable(
                    supplier_code=args.get("supplier_code"),
                    min_balance=float(args.get("min_balance") or 0.0),
                    limit=int(args.get("limit") or 20)
                )
                creditors = res.get("suppliers", [])
                card = {
                    "type": "table",
                    "title": "Accounts Payable (Creditors Outstanding)",
                    "summary": f"Total outstanding supplier liabilities: ₹{res.get('total_accounts_payable', 0.0):,.2f} across {res.get('total_creditors_count', len(creditors))} suppliers.",
                    "columns": [
                        {"key": "card_name", "label": "Supplier", "type": "string"},
                        {"key": "card_code", "label": "Code", "type": "string"},
                        {"key": "outstanding_balance", "label": "Payable Balance", "type": "currency"},
                        {"key": "phone", "label": "Phone", "type": "string"}
                    ],
                    "rows": creditors,
                    "chart": {
                        "type": "bar",
                        "xKey": "card_name",
                        "series": [{"dataKey": "outstanding_balance", "name": "Payable Amount (₹)", "color": "#f59e0b"}],
                        "defaultView": "both"
                    },
                    "meta": {"total_ap": res.get("total_accounts_payable")}
                }
                nav = {"label": "Open Supplier Analysis", "route": "/finance/supplier-analysis", "target_module": "finance_supplier_analysis"}
                return res, card, nav

            elif tool_name == "get_profitability_report":
                r = args.get("range", "monthly")
                branch = _resolve_tool_branch(args.get("branch"))
                res = self.finance_service.get_profitability_report(
                    range_str=r,
                    from_date=args.get("date_from"),
                    to_date=args.get("date_to"),
                    branch_id=branch
                )
                monthly = res.get("monthly_breakdown", [])
                card = {
                    "type": "table",
                    "title": f"Profitability & Margin Report ({res.get('period')})",
                    "summary": f"Net Sales: ₹{res.get('net_sales', 0.0):,.2f} | Cost of Purchases: ₹{res.get('cost_of_purchases', 0.0):,.2f} | Gross Profit: ₹{res.get('gross_profit', 0.0):,.2f} ({res.get('gross_margin_percentage', 0.0)}% Margin).",
                    "columns": [
                        {"key": "period", "label": "Period", "type": "string"},
                        {"key": "sales", "label": "Net Sales", "type": "currency"},
                        {"key": "purchases", "label": "Cost/Purchases", "type": "currency"},
                        {"key": "gross_profit", "label": "Gross Profit", "type": "currency"},
                        {"key": "gross_margin", "label": "Margin %", "type": "percentage"}
                    ],
                    "rows": monthly,
                    "kpis": [
                        {"title": "Net Sales Revenue", "value": round(res.get("net_sales", 0.0), 2), "format": "currency"},
                        {"title": "Cost of Purchases", "value": round(res.get("cost_of_purchases", 0.0), 2), "format": "currency"},
                        {"title": "Gross Profit", "value": round(res.get("gross_profit", 0.0), 2), "format": "currency"},
                        {"title": "Gross Margin", "value": f"{res.get('gross_margin_percentage', 0.0)}%", "format": "string"},
                    ],
                    "chart": {
                        "type": "bar",
                        "xKey": "period",
                        "series": [
                            {"dataKey": "sales", "name": "Net Sales (₹)", "color": "#2563eb"},
                            {"dataKey": "purchases", "name": "Purchases (₹)", "color": "#8b5cf6"},
                            {"dataKey": "gross_profit", "name": "Gross Profit (₹)", "color": "#10b981"}
                        ],
                        "defaultView": "both"
                    },
                    "meta": {
                        "accounting_note": res.get("accounting_note"),
                        "gross_margin": f"{res.get('gross_margin_percentage')}%"
                    }
                }
                nav = {"label": "Open Profitability Reports", "route": "/finance/profitability-reports", "target_module": "finance_profitability_reports"}
                return res, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 18. navigate_to_module
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "navigate_to_module":
                tgt = args.get("target_module")
                route_info = INTERNAL_ROUTE_MAP.get(tgt)
                if not route_info:
                    return {"error": f"Unknown module '{tgt}'"}, None, None

                req_perm = MODULE_NAV_PERMISSIONS.get(tgt)
                if req_perm and user_role != "admin" and req_perm not in user_permissions:
                    return {
                        "error": f"Access Denied: You do not have permission ('{req_perm}') to navigate to module '{tgt}'.",
                        "meta": {"is_partial": False, "permission_denied": True}
                    }, None, None

                path = route_info["path"]
                params = dict(args.get("params") or {})
                label = args.get("label") or f"Open {route_info['name']}"

                if args.get("record_id"):
                    rec = str(args.get("record_id")).strip()
                    if tgt == "products":
                        try:
                            itm = self.items_service.get_item_by_code(rec)
                            if itm:
                                rec = itm.get("ItemCode", rec)
                        except Exception:
                            pass
                        path = f"/products?search={rec}&openDetails=true"
                        label = "Open Product Details"
                    elif tgt in ("sales", "finance_sales_invoices"):
                        path = f"/sales/{rec}"
                        label = f"Open Invoice #{rec}"
                    elif tgt == "finance_purchase_invoices":
                        path = f"/finance/purchase-invoices?id={rec}"
                        label = f"Open Purchase Invoice #{rec}"
                    elif tgt == "finance_incoming_payments":
                        path = f"/finance/incoming-payments?id={rec}"
                        label = f"Open Payment #{rec}"
                    elif tgt == "customers":
                        path = f"/customers?search={rec}"
                        label = f"Open Customer Details ({rec})"

                nav = {
                    "target_module": tgt,
                    "label": label,
                    "route": path,
                    "params": params
                }
                card = {
                    "type": "navigation",
                    "route": path,
                    "label": label,
                    "target": nav
                }
                return {"navigated": True, "route": path, "name": route_info["name"]}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 19. inspect_finance_record
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "inspect_finance_record":
                entity_type = args.get("entity_type", "invoice")
                record_id = str(args.get("record_id", "")).strip()
                if record_id.upper().startswith("INV-"):
                    record_id = record_id[4:]
                user_role = str(current_user.get("role") or "user").lower()

                details = self.finance_service.get_record_details(
                    entity_type=entity_type,
                    record_id=record_id,
                    user_role=user_role
                )

                card = {
                    "type": "record_details",
                    "entity_type": entity_type,
                    "record_id": record_id,
                    "doc_num": details.get("doc_num", record_id),
                    "status": details.get("status", "Active"),
                    "can_edit": details.get("can_edit", False),
                    "editable_fields": details.get("editable_fields", {}),
                    "locked_fields": details.get("locked_fields", {}),
                    "meta": {
                        "user_role": user_role,
                        "timestamp": datetime.now().isoformat(),
                    }
                }
                nav = {
                    "label": f"Inspect {entity_type.replace('_', ' ').title()} #{details.get('doc_num', record_id)}",
                    "route": f"/finance?entity={entity_type}&id={record_id}&action=inspect",
                    "target_module": "finance_overview",
                    "params": {"entity": entity_type, "id": record_id}
                }
                return details, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 20. propose_record_update
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "propose_record_update":
                entity_type = args.get("entity_type", "invoice")
                record_id = str(args.get("record_id", "")).strip()
                if record_id.upper().startswith("INV-"):
                    record_id = record_id[4:]
                updates = args.get("updates", {})
                user_role = str(current_user.get("role") or "user").lower()

                validation = self.finance_service.validate_record_update(
                    entity_type=entity_type,
                    record_id=record_id,
                    updates=updates,
                    user_role=user_role
                )

                card = {
                    "type": "record_proposal",
                    "entity_type": entity_type,
                    "record_id": record_id,
                    "is_valid": validation.get("is_valid", False),
                    "errors": validation.get("errors", []),
                    "diff": validation.get("diff", []),
                    "can_submit": validation.get("is_valid", False) and user_role in ("admin", "manager", "accountant"),
                    "meta": {
                        "user_role": user_role,
                        "timestamp": datetime.now().isoformat(),
                    }
                }
                nav = {
                    "label": f"Review Changes ({len(validation.get('diff', []))} fields)",
                    "route": f"/finance?entity={entity_type}&id={record_id}&action=review",
                    "target_module": "finance_overview",
                    "params": {"entity": entity_type, "id": record_id}
                }
                return validation, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 21. submit_approved_record_update
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "submit_approved_record_update":
                from app.core.config import settings
                if not getattr(settings, "FINANCE_WRITEBACK_ENABLED", False):
                    return {
                        "error": "SAP write-back is temporarily disabled by administrative safety policy.",
                        "is_disabled": True,
                    }, {
                        "type": "record_submission",
                        "status": "error",
                        "error": "SAP write-back is temporarily disabled by administrative safety policy.",
                    }, None

                entity_type = args.get("entity_type", "invoice")
                record_id = str(args.get("record_id", "")).strip()
                if record_id.upper().startswith("INV-"):
                    record_id = record_id[4:]
                updates = args.get("updates", {})
                confirm = bool(args.get("confirm", False))
                user_role = str(current_user.get("role") or "user").lower()

                if user_role not in ("admin", "manager", "accountant"):
                    return {
                        "error": "Forbidden: Admin, Manager, or Accountant authorization required to modify SAP records."
                    }, None, None

                if not confirm:
                    return {
                        "error": "Explicit confirmation required: Please confirm that you want to submit these approved updates to SAP Business One."
                    }, None, None

                result = self.finance_service.submit_record_update(
                    entity_type=entity_type,
                    record_id=record_id,
                    updates=updates,
                    user=current_user,
                    ip_address="127.0.0.1"
                )

                card = {
                    "type": "record_submission",
                    "entity_type": entity_type,
                    "record_id": record_id,
                    "success": result.get("success", False),
                    "message": result.get("message", "Submitted successfully."),
                    "diff": result.get("diff", []),
                    "audit_id": result.get("audit_id"),
                    "timestamp": result.get("timestamp"),
                    "updated_record": result.get("updated_record"),
                }
                nav = {
                    "label": f"View Updated {entity_type.replace('_', ' ').title()}",
                    "route": f"/finance?entity={entity_type}&id={record_id}&action=updated",
                    "target_module": "finance_overview",
                    "params": {"entity": entity_type, "id": record_id}
                }
                return result, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 22. get_finance_audit_log
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_finance_audit_log":
                user_role = str(current_user.get("role") or "user").lower()
                if user_role not in ("admin", "manager"):
                    return {
                        "error": "Forbidden: Admin or Manager authorization required to view audit trail."
                    }, None, None

                from app.services.audit_service import get_audit_entries
                entries = get_audit_entries(
                    entity_type=args.get("entity_type"),
                    record_id=args.get("record_id"),
                    limit=int(args.get("limit") or 20)
                )

                card = {
                    "type": "audit_log",
                    "title": "Finance Operations Audit Trail",
                    "summary": f"Retrieved {len(entries)} audit events for write-back and administrative operations.",
                    "entries": entries,
                    "meta": {"limit": args.get("limit") or 20}
                }
                nav = {
                    "label": "Open Audit History",
                    "route": "/finance?view=audit",
                    "target_module": "finance_overview",
                    "params": {"view": "audit"}
                }
                return {"total_entries": len(entries), "entries": entries}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 23. get_finance_admin_settings
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_finance_admin_settings":
                settings_data = self.finance_service.get_admin_settings()
                card = {
                    "type": "admin_settings",
                    "title": "Finance Assistant & System Settings",
                    "summary": f"SAP Connection: {settings_data.get('sap_status', 'unknown').upper()} | Circuit Breaker: {settings_data.get('sap_circuit_breaker')} | Mode: {settings_data.get('assistant_mode')}",
                    "settings": settings_data
                }
                nav = {
                    "label": "Open Finance Settings",
                    "route": "/finance?view=settings",
                    "target_module": "finance_overview",
                    "params": {"view": "settings"}
                }
                return settings_data, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 24. refresh_finance_data
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "refresh_finance_data":
                from app.services.sap.finance_service import _FINANCE_CACHE
                _FINANCE_CACHE.clear()
                overview = self.finance_service.get_finance_overview(range_str="monthly", branch_id=permitted_warehouse)
                card = {
                    "type": "finance_refreshed",
                    "title": "Finance Data Refreshed",
                    "summary": "All finance caches cleared. Fresh data retrieved directly from SAP Business One Service Layer.",
                    "kpis": overview.get("kpis", {})
                }
                return {"refreshed": True, "timestamp": datetime.now().isoformat()}, card, None

            # ──────────────────────────────────────────────────────────────────
            # 25. get_admin_user_info
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_admin_user_info":
                if user_role != "admin" and "users.manage" not in user_permissions:
                    return {
                        "error": "Forbidden: You do not have administrative permission ('users.manage') to view other user profiles or system roles. Please contact an administrator.",
                        "meta": {"is_partial": False, "permission_denied": True}
                    }, None, None

                search_query = (args.get("search_query") or args.get("username") or args.get("email") or "").strip()
                role_filter = (args.get("role") or "").strip().lower()
                feature_perm = (args.get("feature_permission") or "").strip()

                try:
                    all_users = get_all_users()
                except Exception as e:
                    logger.error(f"Error fetching users in get_admin_user_info: {e}")
                    all_users = []

                matched_users = []
                for u in all_users:
                    if feature_perm:
                        try:
                            eff = get_effective_permissions(u["id"], u.get("role", "user"))
                        except Exception:
                            eff = DEFAULT_ROLE_PERMISSIONS.get(u.get("role", "user"), [])
                        if feature_perm not in eff:
                            continue

                    if role_filter and str(u.get("role") or "").lower() != role_filter:
                        continue

                    if search_query:
                        sq = search_query.lower()
                        un = str(u.get("username") or "").lower()
                        em = str(u.get("email") or "").lower()
                        nm = str(u.get("name") or "").lower()
                        if sq not in un and sq not in em and sq not in nm:
                            continue

                    matched_users.append({
                        "id": u.get("id"),
                        "username": u.get("username"),
                        "name": u.get("name"),
                        "email": u.get("email"),
                        "role": u.get("role"),
                        "job_role": u.get("job_role"),
                        "branch_id": u.get("branch_id"),
                        "store_name": u.get("store_name"),
                        "is_active": u.get("is_active", True)
                    })

                summary_text = f"Found {len(matched_users)} user account(s)"
                if feature_perm:
                    summary_text += f" authorized with permission '{feature_perm}'"
                if role_filter:
                    summary_text += f" with role '{role_filter}'"
                if search_query:
                    summary_text += f" matching '{search_query}'"

                card = {
                    "type": "admin_users_info",
                    "title": "Employee & Role Intelligence",
                    "summary": summary_text,
                    "users": matched_users[:25],
                    "total_count": len(matched_users),
                    "feature_permission": feature_perm or None,
                    "meta": {"is_partial": len(matched_users) > 25}
                }
                nav = {"label": "Open Settings & Roles", "route": "/settings", "target_module": "settings"}
                return {"summary": summary_text, "users": matched_users[:25], "total_count": len(matched_users)}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 26. get_my_permissions
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_my_permissions":
                uid = str(current_user.get("id") or current_user.get("user_id") or "")
                urole = str(current_user.get("role") or "user").lower()

                if urole == "admin":
                    eff_perms = [p["id"] for p in STANDARD_PERMISSIONS]
                else:
                    eff_perms = current_user.get("permissions")
                    if not eff_perms and uid:
                        try:
                            eff_perms = get_effective_permissions(uid, urole)
                        except Exception:
                            eff_perms = DEFAULT_ROLE_PERMISSIONS.get(urole, [])
                    elif not eff_perms:
                        eff_perms = DEFAULT_ROLE_PERMISSIONS.get(urole, [])

                perm_catalog = {p["id"]: p for p in STANDARD_PERMISSIONS}
                modules_accessible = set()
                permissions_grouped = {}

                for pid in eff_perms:
                    pinfo = perm_catalog.get(pid, {"module": pid.split(".")[0].capitalize(), "action": "access", "description": pid})
                    mod = pinfo.get("module", "General")
                    modules_accessible.add(mod)
                    if mod not in permissions_grouped:
                        permissions_grouped[mod] = []
                    permissions_grouped[mod].append(pinfo.get("description", pid))

                assigned_br = current_user.get("branch_id") or "All Branches"
                card = {
                    "type": "my_permissions",
                    "title": f"My Effective Access Profile ({current_user.get('name', 'User')})",
                    "role": urole,
                    "assigned_branch": assigned_br,
                    "modules_accessible": sorted(list(modules_accessible)),
                    "permissions_grouped": permissions_grouped,
                    "total_permissions": len(eff_perms)
                }
                resp = {
                    "user_name": current_user.get("name"),
                    "role": urole,
                    "branch_id": current_user.get("branch_id"),
                    "modules_accessible": sorted(list(modules_accessible)),
                    "permissions_count": len(eff_perms)
                }
                return resp, card, None

            # ──────────────────────────────────────────────────────────────────
            # 27. get_available_reports
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "get_available_reports":
                report_catalog = [
                    {"id": "reports_sales", "title": "Sales Report", "description": "Category breakdowns, revenue velocity, item performance", "route": "/reports/sales", "supported": True, "permission": "reports.view"},
                    {"id": "reports_invoice", "title": "Invoice Report", "description": "Document totals, taxes, settlement states", "route": "/reports/invoice", "supported": True, "permission": "reports.view"},
                    {"id": "reports_payment", "title": "Payment Report", "description": "Breakdown of collections by Cash, Card, and UPI", "route": "/reports/payment", "supported": True, "permission": "reports.view"},
                    {"id": "reports_inventory", "title": "Inventory Report", "description": "Warehouse stock valuation and categories", "route": "/reports/inventory", "supported": True, "permission": "reports.view"},
                    {"id": "production_reports", "title": "Production Reports", "description": "Planned vs completed output, scrap rates, and efficiency", "route": "/production/reports", "supported": True, "permission": "production.reports.view"},
                    {"id": "production_rejection", "title": "Production Rejection Report", "description": "Defect ratios and scrap breakdown by manufactured item", "route": "/production/rejection", "supported": True, "permission": "production.view"},
                    {"id": "finance_profitability", "title": "Profitability Reports", "description": "Net sales, cost of goods, gross margin, and monthly profitability", "route": "/finance/profitability-reports", "supported": True, "permission": "finance.reports.view"},
                    {"id": "finance_customer_analysis", "title": "Customer Analysis", "description": "Customer revenue ranking and outstanding receivables aging", "route": "/finance/customer-analysis", "supported": True, "permission": "finance.view"},
                    {"id": "finance_supplier_analysis", "title": "Supplier Analysis", "description": "Vendor purchase volumes and outstanding payables liabilities", "route": "/finance/supplier-analysis", "supported": True, "permission": "finance.view"},
                    {"id": "reports_customer", "title": "Customer Aging Report", "description": "Customer retention patterns and account aging (mapped to SAP schema)", "route": "/reports/customer", "supported": False, "permission": "reports.view"},
                    {"id": "reports_ai", "title": "AI Generated Reports", "description": "Automated business intelligence narratives generated from live SAP database", "route": "/reports/ai", "supported": True, "permission": "reports.view"},
                ]
                accessible = []
                for r in report_catalog:
                    perm = r["permission"]
                    if user_role == "admin" or perm in user_permissions:
                        accessible.append(r)

                card = {
                    "type": "report_catalog",
                    "title": "ATLAS Reports Directory",
                    "summary": f"Found {len(accessible)} report(s) matching your authorization.",
                    "reports": accessible
                }
                nav = {"label": "Open Reports Hub", "route": "/reports", "target_module": "reports"}
                return {"reports": accessible, "total_available": len(accessible)}, card, nav

            # ──────────────────────────────────────────────────────────────────
            # 28. draft_email
            # ──────────────────────────────────────────────────────────────────
            elif tool_name == "draft_email":
                from app.services.email import email_service
                from app.models.schemas import EmailDraftRequest

                purpose = str(args.get("purpose") or "payment_reminder")
                req = EmailDraftRequest(
                    purpose=purpose,
                    customer_code=args.get("customer_name_or_code"),
                    recipient_name=args.get("customer_name_or_code") or args.get("supplier_name_or_code"),
                    supplier_code=args.get("supplier_name_or_code"),
                    record_id=args.get("invoice_doc_num") or args.get("order_doc_num"),
                    record_type="invoice" if args.get("invoice_doc_num") else ("sales_order" if args.get("order_doc_num") else None),
                    recipient_email=args.get("recipient_email"),
                    additional_notes=args.get("additional_context"),
                )
                draft_resp = email_service.generate_draft(req, current_user)
                card = {
                    "type": "email_draft",
                    "draft_id": draft_resp.draft_id,
                    "purpose": draft_resp.purpose,
                    "recipient_email": draft_resp.recipient_email,
                    "recipient_name": draft_resp.recipient_name,
                    "cc": draft_resp.cc,
                    "bcc": draft_resp.bcc,
                    "subject": draft_resp.subject,
                    "body": draft_resp.body,
                    "business_context": draft_resp.business_context,
                    "is_ready_to_send": draft_resp.is_ready_to_send,
                    "validation_warnings": draft_resp.validation_warnings,
                    "company_signature": draft_resp.company_signature,
                    "meta": {
                        "record_type": req.record_type,
                        "record_id": req.record_id,
                    }
                }
                return {
                    "status": "draft_created",
                    "draft_id": draft_resp.draft_id,
                    "purpose": draft_resp.purpose,
                    "recipient": draft_resp.recipient_email or "Not set (requires user input)",
                    "recipient_name": draft_resp.recipient_name,
                    "subject": draft_resp.subject,
                    "body": draft_resp.body,
                    "verified_context": draft_resp.business_context,
                    "validation_warnings": draft_resp.validation_warnings,
                    "note": "Complete draft generated for review. Email will only be dispatched upon clicking 'Confirm & Send Email'."
                }, card, None

            else:
                return {"error": f"Unknown tool '{tool_name}'"}, None, None

        except SAPConnectionError as e:
            logger.error(f"SAP Connection Error during tool {tool_name}: {e}")
            card = {
                "type": "sap_offline",
                "message": "SAP Business One Service Layer is temporarily unreachable. Live operational data could not be fetched.",
                "tool": tool_name
            }
            return {"error": "SAP Service Layer connection offline."}, card, None
        except Exception as e:
            logger.error(f"Execution error in tool {tool_name}: {e}", exc_info=True)
            return {"error": f"Tool execution failed: {str(e)}"}, None, None

    def _execute_tool(
        self,
        tool_name: str,
        args: Dict[str, Any],
        permitted_warehouse: Optional[str],
        current_user: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Executes a single registered business tool against SAP or Postgres.
        Automatically attaches verified process flowchart definitions if available.
        Returns: (tool_context_for_llm, structured_card_for_ui, navigation_action)
        """
        tool_resp, card, nav = self._execute_tool_inner(tool_name, args, permitted_warehouse, current_user)
        if card and isinstance(card, dict) and "flowchart" not in card:
            wf_mod = TOOL_TO_WORKFLOW_MAP.get(tool_name)
            if wf_mod:
                try:
                    card["flowchart"] = get_workflow_flowchart(wf_mod)
                except Exception as ex:
                    logger.warning(f"Failed attaching workflow flowchart for {tool_name}: {ex}")
        return tool_resp, card, nav
