"""Tests for Finance AI Assistant Tool Calling and Financial Analytics."""

import pytest
from unittest.mock import MagicMock, patch
import json
from app.services.ai_service import AIAssistantService, INTERNAL_ROUTE_MAP
from app.core.config import settings

@pytest.fixture
def mock_openai():
    with patch('app.services.ai_service.openai.OpenAI') as mock:
        yield mock

@pytest.fixture
def ai_service(mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.SAPFinanceService') as mock_fin_svc:
        service = AIAssistantService()
        service.finance_service = mock_fin_svc.return_value
        yield service

@pytest.fixture
def test_user():
    return {"name": "Finance Admin", "role": "admin", "branch_id": None}

def test_finance_tools_registered_in_schema(ai_service):
    """Verify that read-only finance tools are registered and write-back tool is excluded by default safety policy."""
    schemas = ai_service._get_tools_schema()
    tool_names = [t["function"]["name"] for t in schemas]
    
    expected_read_only_tools = [
        "get_finance_summary",
        "get_sales_trend",
        "get_purchase_trend",
        "get_sales_invoices",
        "get_purchase_invoices",
        "get_incoming_payments",
        "get_outgoing_payments",
        "get_customer_sales_ranking",
        "get_supplier_purchase_ranking",
        "get_accounts_receivable",
        "get_accounts_payable",
        "get_profitability_report",
        "inspect_finance_record",
        "propose_record_update",
        "get_finance_audit_log",
        "get_finance_admin_settings",
        "refresh_finance_data",
    ]
    
    for tool in expected_read_only_tools:
        assert tool in tool_names, f"Tool {tool} missing from tools schema"

    # Safety assertion: write-back tool must NOT be present when writeback is disabled
    assert "submit_approved_record_update" not in tool_names

    # When explicitly enabled, write-back tool must be present
    with patch("app.services.ai_service.settings.FINANCE_WRITEBACK_ENABLED", True):
        enabled_schema = ai_service._get_tools_schema()
        enabled_tool_names = [t["function"]["name"] for t in enabled_schema]
        assert "submit_approved_record_update" in enabled_tool_names

def test_finance_internal_route_map():
    """Verify route registry contains all finance target modules."""
    expected_modules = [
        "finance_overview",
        "finance_purchase_invoices",
        "finance_incoming_payments",
        "finance_outgoing_payments",
        "finance_customer_analysis",
        "finance_supplier_analysis",
        "finance_profitability_reports",
        "sales",
    ]
    for mod in expected_modules:
        assert mod in INTERNAL_ROUTE_MAP
        assert "path" in INTERNAL_ROUTE_MAP[mod]
        assert "name" in INTERNAL_ROUTE_MAP[mod]

def test_execute_get_sales_trend(ai_service, test_user):
    """Test get_sales_trend tool execution and Recharts payload structure."""
    ai_service.finance_service.get_sales_trend.return_value = {
        "period": "past_6_months",
        "total_revenue": 2220050.0,
        "trend": [
            {"period": "Nov 2024", "month": "2024-11", "sales": 364500.0, "invoice_count": 22},
            {"period": "Dec 2024", "month": "2024-12", "sales": 390700.0, "invoice_count": 25},
            {"period": "Jan 2025", "month": "2025-01", "sales": 373100.0, "invoice_count": 24},
            {"period": "Feb 2025", "month": "2025-02", "sales": 379500.0, "invoice_count": 23},
            {"period": "Mar 2025", "month": "2025-03", "sales": 405200.0, "invoice_count": 27},
            {"period": "Apr 2025", "month": "2025-04", "sales": 308150.0, "invoice_count": 20},
        ],
        "currency": "INR",
        "is_cached": False
    }

    context, card, nav = ai_service._execute_tool(
        "get_sales_trend",
        {"period": "past_6_months"},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert "trend" in context
    assert context["total_revenue"] == 2220050.0
    assert card is not None
    assert card["type"] == "table"
    assert card["chart"]["type"] == "line"
    assert card["chart"]["xKey"] == "period"
    assert "sales" in card["chart"]["series"]
    assert card["chart"]["defaultView"] == "both"
    assert nav["route"] in ("/sales", "/finance")

def test_execute_customer_sales_ranking(ai_service, test_user):
    """Test get_customer_sales_ranking tool execution (top and lowest)."""
    ai_service.finance_service.get_customer_sales_ranking.return_value = {
        "period": "this_month",
        "order": "top",
        "ranking": [
            {"rank": 1, "card_code": "C001", "customer_name": "Rekha limited", "invoice_count": 8, "net_sales": 112450.0, "percentage": 27.8},
            {"rank": 2, "card_code": "C002", "customer_name": "Amazon", "invoice_count": 5, "net_sales": 68930.0, "percentage": 17.0},
        ],
        "is_cached": False
    }

    context, card, nav = ai_service._execute_tool(
        "get_customer_sales_ranking",
        {"order": "top", "limit": 5},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert len(context["ranking"]) == 2
    assert card["type"] == "table"
    assert card["chart"]["type"] == "bar"
    assert nav["route"] == "/finance/customer-analysis"

def test_execute_accounts_receivable(ai_service, test_user):
    """Test get_accounts_receivable tool execution."""
    ai_service.finance_service.get_accounts_receivable.return_value = {
        "total_outstanding": 123560.0,
        "debtor_count": 2,
        "debtors": [
            {"rank": 1, "card_code": "C001", "customer_name": "Rekha limited", "balance": 75000.0, "phone": "9876543210"},
            {"rank": 2, "card_code": "C002", "customer_name": "Amazon", "balance": 48560.0, "phone": "9876543211"},
        ],
        "is_cached": False
    }

    context, card, nav = ai_service._execute_tool(
        "get_accounts_receivable",
        {"limit": 10},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert card["type"] == "table"
    assert card["chart"]["type"] == "bar"
    assert nav["route"] == "/finance/customer-analysis"

def test_execute_profitability_report(ai_service, test_user):
    """Test get_profitability_report tool with verified inputs."""
    ai_service.finance_service.get_profitability_report.return_value = {
        "period": "monthly",
        "net_sales": 405180.0,
        "purchases_or_cogs": 218460.0,
        "gross_profit": 186720.0,
        "gross_margin_percentage": 46.08,
        "notes": "Verified against SAP AR Invoices and AP Invoices.",
        "is_cached": False
    }

    context, card, nav = ai_service._execute_tool(
        "get_profitability_report",
        {"range": "monthly"},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert context["gross_profit"] == 186720.0
    assert context["gross_margin_percentage"] == 46.08
    assert card["type"] == "table"
    assert nav["route"] == "/finance/profitability-reports"

def test_execute_finance_summary(ai_service, test_user):
    """Test get_finance_summary returns 8-metric KPI card layout."""
    ai_service.finance_service.get_finance_summary.return_value = {
        "period": "monthly",
        "metrics": {
            "total_sales": 405180.0,
            "total_purchases": 218460.0,
            "incoming_payments": 362400.0,
            "outgoing_payments": 194700.0,
            "accounts_receivable": 123560.0,
            "accounts_payable": 86340.0,
            "gross_profit": 186720.0,
            "gross_margin": 46.1,
        },
        "is_cached": False
    }

    context, card, nav = ai_service._execute_tool(
        "get_finance_summary",
        {"range": "monthly"},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert card["type"] == "finance_summary"
    assert len(card["cards"]) == 8
    assert nav["route"] == "/finance"

def test_navigate_to_module_tool(ai_service, test_user):
    """Test navigate_to_module execution for incoming payments."""
    context, card, nav = ai_service._execute_tool(
        "navigate_to_module",
        {
            "target_module": "finance_incoming_payments",
            "label": "Open Incoming Payments"
        },
        permitted_warehouse=None,
        current_user=test_user
    )

    assert card["type"] == "navigation"
    assert card["target"]["route"] == "/finance/incoming-payments"
    assert card["target"]["label"] == "Open Incoming Payments"

def test_tool_failure_returns_graceful_error(ai_service, test_user):
    """Verify tool errors return structured error feedback rather than crashing."""
    ai_service.finance_service.get_sales_invoices.side_effect = Exception("General timeout")

    context, card, nav = ai_service._execute_tool(
        "get_sales_invoices",
        {"limit": 5},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert "error" in context
    assert "Tool execution failed" in context["error"]

def test_sap_offline_returns_offline_card(ai_service, test_user):
    """Verify SAPConnectionError returns structured sap_offline card."""
    from app.services.sap.client import SAPConnectionError
    ai_service.finance_service.get_sales_invoices.side_effect = SAPConnectionError("SAP unreachable")

    context, card, nav = ai_service._execute_tool(
        "get_sales_invoices",
        {"limit": 5},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert "error" in context
    assert card is not None
    assert card["type"] == "sap_offline"
    assert "temporarily unreachable" in card["message"]

def test_execute_inspect_finance_record(ai_service, test_user):
    """Test inspect_finance_record tool execution."""
    ai_service.finance_service.get_record_details.return_value = {
        "entity_type": "invoice",
        "record_id": "101",
        "doc_num": "INV-101",
        "status": "Open",
        "can_edit": True,
        "editable_fields": {
            "Comments": {"label": "Invoice Remarks", "current_value": "Original note"}
        },
        "locked_fields": {
            "DocTotal": {"reason": "Locked by SAP"}
        }
    }

    context, card, nav = ai_service._execute_tool(
        "inspect_finance_record",
        {"entity_type": "invoice", "record_id": "101"},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert card["type"] == "record_details"
    assert card["record_id"] == "101"
    assert card["can_edit"] is True
    assert "Comments" in card["editable_fields"]
    assert "DocTotal" in card["locked_fields"]

def test_execute_propose_record_update(ai_service, test_user):
    """Test propose_record_update tool execution and diff generation."""
    ai_service.finance_service.validate_record_update.return_value = {
        "is_valid": True,
        "errors": [],
        "diff": [
            {
                "field": "Comments",
                "label": "Invoice Remarks",
                "old_value": "Original note",
                "new_value": "Approved by Director",
                "permitted": True
            }
        ],
        "record_id": "101",
        "entity_type": "invoice"
    }

    context, card, nav = ai_service._execute_tool(
        "propose_record_update",
        {"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "Approved by Director"}},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert card["type"] == "record_proposal"
    assert card["is_valid"] is True
    assert len(card["diff"]) == 1
    assert card["diff"][0]["new_value"] == "Approved by Director"

def test_submit_approved_record_update_blocked_by_safety_policy(ai_service, test_user):
    """Test that submit_approved_record_update is blocked by safety policy when disabled."""
    context, card, nav = ai_service._execute_tool(
        "submit_approved_record_update",
        {"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
        permitted_warehouse=None,
        current_user=test_user
    )
    assert context.get("is_disabled") is True
    assert "safety policy" in context.get("error", "").lower()
    assert card["type"] == "record_submission"
    assert card["status"] == "error"

def test_execute_submit_approved_record_update(ai_service, test_user):
    """Test submit_approved_record_update with confirmation when enabled."""
    ai_service.finance_service.submit_record_update.return_value = {
        "success": True,
        "message": "Successfully updated invoice 101 in SAP Business One.",
        "diff": [{"field": "Comments", "old_value": "Old", "new_value": "New"}],
        "updated_record": {"Comments": "New"},
        "audit_id": "AUD-12345678",
        "timestamp": "2026-10-14T10:00:00Z"
    }

    with patch("app.core.config.settings.FINANCE_WRITEBACK_ENABLED", True):
        context, card, nav = ai_service._execute_tool(
            "submit_approved_record_update",
            {"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
            permitted_warehouse=None,
            current_user=test_user
        )

        assert card["type"] == "record_submission"
        assert card["success"] is True
        assert card["audit_id"] == "AUD-12345678"

def test_submit_approved_record_update_requires_confirmation(ai_service, test_user):
    """Test submit_approved_record_update rejects if confirm is False."""
    with patch("app.core.config.settings.FINANCE_WRITEBACK_ENABLED", True):
        context, card, nav = ai_service._execute_tool(
            "submit_approved_record_update",
            {"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": False},
            permitted_warehouse=None,
            current_user=test_user
        )

        assert "error" in context
        assert "Explicit confirmation required" in context["error"]
        assert card is None

def test_read_only_user_cannot_submit_record_update(ai_service):
    """Verify that a read-only user cannot submit record updates."""
    read_only_user = {"name": "Readonly Viewer", "role": "user", "branch_id": None}
    with patch("app.core.config.settings.FINANCE_WRITEBACK_ENABLED", True):
        context, card, nav = ai_service._execute_tool(
            "submit_approved_record_update",
            {"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
            permitted_warehouse=None,
            current_user=read_only_user
        )

        assert "error" in context
        assert "Forbidden" in context["error"]
        assert card is None

def test_execute_get_finance_admin_settings(ai_service, test_user):
    """Test get_finance_admin_settings tool."""
    ai_service.finance_service.get_admin_settings.return_value = {
        "assistant_mode": "FINANCE_INTELLIGENT_WORKSPACE",
        "sap_status": "connected",
        "sap_circuit_breaker": "CLOSED",
        "enabled_capabilities": ["sales_revenue_analysis", "admin_controlled_sap_writeback"]
    }

    context, card, nav = ai_service._execute_tool(
        "get_finance_admin_settings",
        {},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert card["type"] == "admin_settings"
    assert "settings" in card
    assert card["settings"]["sap_status"] == "connected"

def test_execute_refresh_finance_data(ai_service, test_user):
    """Test refresh_finance_data tool."""
    ai_service.finance_service.get_finance_overview.return_value = {
        "kpis": {"total_sales": {"value": 500000.0}}
    }

    context, card, nav = ai_service._execute_tool(
        "refresh_finance_data",
        {},
        permitted_warehouse=None,
        current_user=test_user
    )

    assert card["type"] == "finance_refreshed"
    assert context["refreshed"] is True

