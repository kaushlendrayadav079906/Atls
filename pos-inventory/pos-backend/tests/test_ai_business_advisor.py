"""
Unit and integration tests for ATLAS AI Business Advisor.
Verifies:
- 4-question executive framework (What is happening, Why it matters, What needs attention, Next steps)
- Standardized section headers (Direct answer, Key numbers, Business meaning, What needs attention, Recommended next step, Evidence)
- Role-based perspectives (Owner/CEO, CFO/Finance, Sales Manager, Production Manager)
- Representative business queries: sales, collections & partial payment allocations, receivables, margins, inventory, production
- SAP offline and unavailable data handling
- Branch and tool authorization enforcement
- Financial write-back safety guard
"""

import json
from unittest.mock import MagicMock, patch
import pytest

from app.core.config import settings
from app.services.ai_service import AIAssistantService
from app.services.sap.client import SAPConnectionError


@pytest.fixture(autouse=True)
def ensure_openai_api_key():
    orig_key = settings.OPENAI_API_KEY
    settings.OPENAI_API_KEY = "test-advisor-key"
    yield
    settings.OPENAI_API_KEY = orig_key


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_role_perspective_owner_ceo(mock_openai):
    """Verify Owner/CEO user receives executive overview perspective and 4-question mandate."""
    mock_llm_instance = mock_openai.return_value
    mock_choice = MagicMock()
    mock_choice.message.content = (
        "**Direct answer:** Sales today stand at ₹45,000 across 12 transactions.\n\n"
        "**Key numbers:** Revenue: ₹45,000.00 | Transactions: 12 | Growth: +12.5%.\n\n"
        "**Business meaning:** Momentum remains strong with steady throughput across main counters.\n\n"
        "**What needs attention:** High concentration in top 2 customer bills.\n\n"
        "**Recommended next step:** Review stock availability for fast-moving items.\n\n"
        "**Evidence:** Invoices #1001-#1012, Scope: Main Branch as of 2026-10-24."
    )
    mock_choice.message.tool_calls = None
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_llm_instance.chat.completions.create.return_value = mock_response

    service = AIAssistantService()
    owner_user = {
        "id": "u-owner-1",
        "name": "Vikram Singhania",
        "role": "owner",
        "job_role": "Managing Director",
        "branch_id": "SH",
        "permissions": ["dashboard.view", "finance.view", "products.view"]
    }

    res = service.process_chat(
        message="What is our business performance today?",
        branch_id="SH",
        current_user=owner_user
    )

    assert "Direct answer:" in res["answer"]
    assert "Key numbers:" in res["answer"]
    assert "Business meaning:" in res["answer"]
    assert "What needs attention:" in res["answer"]
    assert "Recommended next step:" in res["answer"]
    assert "Evidence:" in res["answer"]

    # Verify system prompt injected Owner/CEO perspective
    call_args = mock_llm_instance.chat.completions.create.call_args[1]
    system_msg = call_args["messages"][0]["content"]
    assert "Advisory Perspective: Company Owner / CEO" in system_msg
    assert "ROLE FOCUS (Company Owner / CEO)" in system_msg
    assert "THE FOUR CORE ADVISORY QUESTIONS" in system_msg


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_role_perspective_cfo_finance(mock_openai):
    """Verify CFO/Finance user receives cash reconciliation & GAAP standards perspective."""
    mock_llm_instance = mock_openai.return_value
    mock_choice = MagicMock()
    mock_choice.message.content = (
        "**Direct answer:** Invoiced revenue is ₹1,20,000 while cash collected is ₹85,000.\n\n"
        "**Key numbers:** Invoiced: ₹1,20,000.00 | Receipts: ₹85,000.00 | Gap: ₹35,000.00.\n\n"
        "**Business meaning:** Actual collections lag invoiced billing by ₹35,000.\n\n"
        "**What needs attention:** ₹35,000 remains uncollected across 3 customer accounts.\n\n"
        "**Recommended next step:** 1. Dispatch overdue statements to pending accounts.\n\n"
        "**Evidence:** Live SAP AR Invoices and Incoming Payments."
    )
    mock_choice.message.tool_calls = None
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_llm_instance.chat.completions.create.return_value = mock_response

    service = AIAssistantService()
    cfo_user = {
        "id": "u-cfo-1",
        "name": "Pooja Mehta",
        "role": "finance_manager",
        "job_role": "Chief Financial Officer",
        "branch_id": "SH",
        "permissions": ["finance.view", "finance.payments.view", "finance.reports.view"]
    }

    res = service.process_chat(
        message="Compare invoiced revenue and collections",
        branch_id="SH",
        current_user=cfo_user
    )

    call_args = mock_llm_instance.chat.completions.create.call_args[1]
    system_msg = call_args["messages"][0]["content"]
    assert "Advisory Perspective: CFO / Finance Manager" in system_msg
    assert "Invoiced Sales != Actual Payments" in system_msg
    assert "Purchase Invoices != Cost of Goods Sold" in system_msg


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_incoming_payments_and_allocations(mock_openai):
    """Verify incoming payments tool execution and invoice allocation tracking."""
    mock_llm_instance = mock_openai.return_value

    tool_call = MagicMock()
    tool_call.function.name = "get_incoming_payments"
    tool_call.function.arguments = json.dumps({"range": "month", "limit": 5})
    tool_call.id = "call_payments"

    step1_choice = MagicMock()
    step1_choice.message.content = None
    step1_choice.message.tool_calls = [tool_call]
    step1_response = MagicMock(choices=[step1_choice])

    step2_choice = MagicMock()
    step2_choice.message.content = (
        "**Direct answer:** Collections this month total ₹75,000 with 100% allocation to open invoices.\n\n"
        "**Key numbers:** Collections: ₹75,000.00 | Total Receipts: 2 | Invoices Cleared: 3.\n\n"
        "**Business meaning:** Cash collections were successfully applied against customer accounts.\n\n"
        "**What needs attention:** None; all funds are reconciled.\n\n"
        "**Recommended next step:** Reconcile bank ledger statement.\n\n"
        "**Evidence:** SAP IncomingPayments DocNum 501, 502."
    )
    step2_choice.message.tool_calls = None
    step2_response = MagicMock(choices=[step2_choice])

    mock_llm_instance.chat.completions.create.side_effect = [step1_response, step2_response]

    service = AIAssistantService()
    # Mock finance_service.get_incoming_payments
    service.finance_service.get_incoming_payments = MagicMock(return_value={
        "payments": [
            {
                "doc_num": 501,
                "ref_no": "RCT-501",
                "date": "2026-10-24",
                "customer_name": "Acme Retail Ltd",
                "amount": 50000.0,
                "method": "Bank Transfer",
                "applied_invoices_count": 2,
                "applied_invoices": [
                    {"doc_num": 101, "sum_applied": 30000.0},
                    {"doc_num": 102, "sum_applied": 20000.0}
                ]
            }
        ],
        "total_count": 1,
        "total_amount": 50000.0,
        "period": "month"
    })

    admin_user = {"name": "Admin", "role": "admin", "permissions": []}
    res = service.process_chat(
        message="Show incoming payments this month and payment allocations",
        branch_id="SH",
        current_user=admin_user
    )

    assert "Direct answer:" in res["answer"]
    assert res["structured_data"] is not None
    assert res["structured_data"]["type"] == "table"
    # Verify metadata freshness & source status
    meta = res["structured_data"].get("meta", {})
    assert meta.get("status") == "online"
    assert "Live" in meta.get("data_source", "")
    assert "IST" in meta.get("refresh_time", "")


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_sap_offline_discloses_truthfully(mock_openai):
    """Verify that when SAP is disconnected, the advisor never reports zero business activity or fabricates data."""
    mock_llm_instance = mock_openai.return_value

    tool_call = MagicMock()
    tool_call.function.name = "get_sales_invoices"
    tool_call.function.arguments = json.dumps({"range": "today"})
    tool_call.id = "call_inv_offline"

    step1_choice = MagicMock()
    step1_choice.message.content = None
    step1_choice.message.tool_calls = [tool_call]
    step1_response = MagicMock(choices=[step1_choice])

    step2_choice = MagicMock()
    step2_choice.message.content = (
        "**Direct answer:** Live sales records could not be retrieved because the SAP Business One Service Layer is currently disconnected.\n\n"
        "**Key numbers:** Verified Live Sales: Unavailable (SAP Offline).\n\n"
        "**Business meaning:** The system cannot verify current transactions without an active SAP connection.\n\n"
        "**What needs attention:** Network connectivity to SAP server 100.108.17.64:50001 requires inspection.\n\n"
        "**Recommended next step:** 1. Contact the SAP system administrator to restore Service Layer connectivity.\n\n"
        "**Evidence:** Connection timeout at 2026-10-24."
    )
    step2_choice.message.tool_calls = None
    step2_response = MagicMock(choices=[step2_choice])

    mock_llm_instance.chat.completions.create.side_effect = [step1_response, step2_response]

    service = AIAssistantService()
    # Mock finance_service.get_sales_invoices raising SAPConnectionError
    service.finance_service.get_sales_invoices = MagicMock(
        side_effect=SAPConnectionError("SAP Service Layer connection timed out")
    )

    admin_user = {"name": "Admin", "role": "admin", "permissions": []}
    res = service.process_chat(
        message="What are today's sales?",
        branch_id="SH",
        current_user=admin_user
    )

    assert res["structured_data"] is not None
    # Verify sap_offline card produced
    assert res["structured_data"]["type"] == "sap_offline"
    meta = res["structured_data"].get("meta", {})
    assert meta.get("status") == "offline"
    assert "Offline" in meta.get("data_source", "")


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_branch_isolation_and_rbac(mock_openai):
    """Verify that a store manager cannot query across unauthorized branches."""
    mock_llm_instance = mock_openai.return_value

    tool_call = MagicMock()
    tool_call.function.name = "get_sales_invoices"
    # Store manager for branch SH attempts to query branch 'DEL'
    tool_call.function.arguments = json.dumps({"branch": "DEL", "range": "today"})
    tool_call.id = "call_cross_branch"

    step1_choice = MagicMock()
    step1_choice.message.content = None
    step1_choice.message.tool_calls = [tool_call]
    step1_response = MagicMock(choices=[step1_choice])

    step2_choice = MagicMock()
    step2_choice.message.content = "**Direct answer:** Results filtered to your authorized branch SH."
    step2_choice.message.tool_calls = None
    step2_response = MagicMock(choices=[step2_choice])

    mock_llm_instance.chat.completions.create.side_effect = [step1_response, step2_response]

    service = AIAssistantService()
    service.finance_service.get_sales_invoices = MagicMock(return_value={
        "sales_invoices": [],
        "total_count": 0,
        "total_amount": 0.0,
        "period": "today"
    })

    # Manager user locked to SH
    manager_user = {
        "name": "Branch Manager",
        "role": "manager",
        "branch_id": "SH",
        "permissions": ["invoices.view"]
    }

    res = service.process_chat(
        message="Show sales invoices for Delhi branch",
        branch_id="DEL",
        current_user=manager_user
    )

    # Verify that get_sales_invoices was called with 'SH', ignoring the requested 'DEL'
    service.finance_service.get_sales_invoices.assert_called_once()
    called_branch = service.finance_service.get_sales_invoices.call_args[1].get("branch_id")
    assert called_branch == "SH"


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_outstanding_receivables(mock_openai):
    """Verify debtors / accounts receivable tracking and exposure ranking."""
    mock_llm_instance = mock_openai.return_value

    tool_call = MagicMock()
    tool_call.function.name = "get_accounts_receivable"
    tool_call.function.arguments = json.dumps({"min_balance": 1000.0, "limit": 5})
    tool_call.id = "call_ar"

    step1_choice = MagicMock()
    step1_choice.message.content = None
    step1_choice.message.tool_calls = [tool_call]
    step1_response = MagicMock(choices=[step1_choice])

    step2_choice = MagicMock()
    step2_choice.message.content = (
        "**Direct answer:** Total overdue customer balance is ₹1,45,000 across 2 client accounts.\n\n"
        "**Key numbers:** Outstanding Debt: ₹1,45,000.00 | High-Risk Accounts: 2.\n\n"
        "**Business meaning:** Accounts receivable concentration is elevated with 68% tied to Acme Ltd.\n\n"
        "**What needs attention:** Acme Ltd has ₹98,000 overdue past agreed credit terms.\n\n"
        "**Recommended next step:** 1. Issue payment reminder statement to Acme Ltd.\n\n"
        "**Evidence:** SAP Debtors Ledger CardCodes C0001, C0002."
    )
    step2_choice.message.tool_calls = None
    step2_response = MagicMock(choices=[step2_choice])

    mock_llm_instance.chat.completions.create.side_effect = [step1_response, step2_response]

    service = AIAssistantService()
    service.finance_service.get_accounts_receivable = MagicMock(return_value={
        "customers": [
            {"card_code": "C0001", "card_name": "Acme Ltd", "outstanding_balance": 98000.0, "phone": "9876543210"},
            {"card_code": "C0002", "card_name": "Beta Corp", "outstanding_balance": 47000.0, "phone": "9876543211"}
        ],
        "total_debtors_count": 2,
        "total_accounts_receivable": 145000.0
    })

    admin_user = {"name": "Admin", "role": "admin", "permissions": []}
    res = service.process_chat(
        message="Which customer balances are outstanding?",
        branch_id="SH",
        current_user=admin_user
    )

    assert "Direct answer:" in res["answer"]
    assert res["structured_data"] is not None
    assert res["structured_data"]["type"] == "table"
    assert res["structured_data"]["title"] == "Accounts Receivable (Debtors Outstanding)"


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_profitability_with_missing_cost_data(mock_openai):
    """Verify profitability analysis discloses missing cost data and accounting boundaries."""
    mock_llm_instance = mock_openai.return_value

    tool_call = MagicMock()
    tool_call.function.name = "get_profitability_report"
    tool_call.function.arguments = json.dumps({"range": "month"})
    tool_call.id = "call_profit"

    step1_choice = MagicMock()
    step1_choice.message.content = None
    step1_choice.message.tool_calls = [tool_call]
    step1_response = MagicMock(choices=[step1_choice])

    step2_choice = MagicMock()
    step2_choice.message.content = (
        "**Direct answer:** Estimated gross margin is 35.5% based on net sales of ₹2,00,000 against purchase expenses.\n\n"
        "**Key numbers:** Net Sales: ₹2,00,000.00 | Cost of Purchases: ₹1,29,000.00 | Gross Profit: ₹71,000.00 (35.5%).\n\n"
        "**Business meaning:** Trading margin is positive, but purchase bills are treated as cost proxy.\n\n"
        "**What needs attention:** Direct COGS is estimated because perpetual inventory valuation is unposted.\n\n"
        "**Recommended next step:** 1. Reconcile monthly physical inventory to establish true COGS.\n\n"
        "**Evidence:** Live SAP A/R Invoices & A/P Invoices as of 2026-10-24."
    )
    step2_choice.message.tool_calls = None
    step2_response = MagicMock(choices=[step2_choice])

    mock_llm_instance.chat.completions.create.side_effect = [step1_response, step2_response]

    service = AIAssistantService()
    service.finance_service.get_profitability_report = MagicMock(return_value={
        "net_sales": 200000.0,
        "cost_of_purchases": 129000.0,
        "gross_profit": 71000.0,
        "gross_margin_percentage": 35.5,
        "period": "month",
        "monthly_breakdown": [
            {"period": "Oct 2026", "sales": 200000.0, "purchases": 129000.0, "gross_profit": 71000.0, "gross_margin": 35.5}
        ],
        "accounting_note": "Cost of purchases is based on recorded A/P Invoices. True GAAP Cost of Goods Sold (COGS) requires perpetual inventory adjustment."
    })

    admin_user = {"name": "Admin", "role": "admin", "permissions": []}
    res = service.process_chat(
        message="What is our profitability this month?",
        branch_id="SH",
        current_user=admin_user
    )

    assert "Direct answer:" in res["answer"]
    assert res["structured_data"] is not None
    assert res["structured_data"]["type"] == "table"
    assert "accounting_note" in res["structured_data"].get("meta", {})


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_inventory_shortages(mock_openai):
    """Verify inventory shortage detection with safety stock thresholds."""
    mock_llm_instance = mock_openai.return_value

    tool_call = MagicMock()
    tool_call.function.name = "get_inventory_stock"
    tool_call.function.arguments = json.dumps({"low_stock_only": True, "warehouse": "SH"})
    tool_call.id = "call_stock"

    step1_choice = MagicMock()
    step1_choice.message.content = None
    step1_choice.message.tool_calls = [tool_call]
    step1_response = MagicMock(choices=[step1_choice])

    step2_choice = MagicMock()
    step2_choice.message.content = (
        "**Direct answer:** 2 items are currently below minimum safety thresholds in warehouse SH.\n\n"
        "**Key numbers:** Critical SKUs: 2 | Zero Stock: 1 | Near Exhaustion: 1.\n\n"
        "**Business meaning:** Stockout risk threatens upcoming customer fulfillment.\n\n"
        "**What needs attention:** SKU-101 has 0 units remaining against 20 minimum required.\n\n"
        "**Recommended next step:** 1. Raise urgent purchase order for SKU-101.\n\n"
        "**Evidence:** SAP ItemWarehouseInfoCollection Warehouse SH."
    )
    step2_choice.message.tool_calls = None
    step2_response = MagicMock(choices=[step2_choice])

    mock_llm_instance.chat.completions.create.side_effect = [step1_response, step2_response]

    service = AIAssistantService()
    service.inventory_service.get_warehouse_stock = MagicMock(return_value=[
        {
            "ItemCode": "SKU-101",
            "ItemName": "Widget Pro",
            "QuantityOnStock": 0.0,
            "ItemWarehouseInfoCollection": [{"WarehouseCode": "SH", "MinimalStock": 20.0}]
        },
        {
            "ItemCode": "SKU-102",
            "ItemName": "Component Base",
            "QuantityOnStock": 4.0,
            "ItemWarehouseInfoCollection": [{"WarehouseCode": "SH", "MinimalStock": 15.0}]
        }
    ])

    admin_user = {"name": "Admin", "role": "admin", "permissions": []}
    res = service.process_chat(
        message="Which products have low stock?",
        branch_id="SH",
        current_user=admin_user
    )

    assert "Direct answer:" in res["answer"]
    assert res["structured_data"] is not None
    assert res["structured_data"]["type"] in ("low_stock_alerts", "inventory_risk")
    assert len(res["structured_data"]["items"]) == 2


@patch("app.services.ai_service.openai.OpenAI")
def test_advisor_production_delays_and_metrics(mock_openai):
    """Verify production operational metrics and delay detection."""
    mock_llm_instance = mock_openai.return_value

    tool_call = MagicMock()
    tool_call.function.name = "get_production_orders"
    tool_call.function.arguments = json.dumps({"status": "pending"})
    tool_call.id = "call_prod_orders"

    step1_choice = MagicMock()
    step1_choice.message.content = None
    step1_choice.message.tool_calls = [tool_call]
    step1_response = MagicMock(choices=[step1_choice])

    step2_choice = MagicMock()
    step2_choice.message.content = (
        "**Direct answer:** 5 production work orders are open with an overall fulfillment rate of 45.0%.\n\n"
        "**Key numbers:** Open Orders: 5 | Plan Variance: 550 units behind schedule | Rejection Rate: 2.1%.\n\n"
        "**Business meaning:** Production throughput is running below planned capacity.\n\n"
        "**What needs attention:** Assembly batch #882 is delayed due to component shortages.\n\n"
        "**Recommended next step:** 1. Expedite pending raw materials to workstation 2.\n\n"
        "**Evidence:** SAP ProductionOrders DocNums 880-884."
    )
    step2_choice.message.tool_calls = None
    step2_response = MagicMock(choices=[step2_choice])

    mock_llm_instance.chat.completions.create.side_effect = [step1_response, step2_response]

    service = AIAssistantService()
    service.production_service.get_production_orders = MagicMock(return_value=(
        [
            {"doc_num": "880", "item_code": "PROD-1", "item_name": "Assembly Unit", "planned_qty": 500, "produced_qty": 200, "status": "bost_Open"},
            {"doc_num": "881", "item_code": "PROD-2", "item_name": "Chassis Mount", "planned_qty": 500, "produced_qty": 250, "status": "bost_Open"}
        ],
        2
    ))
    service.production_service.get_production_summary = MagicMock(return_value={
        "total_orders": 2,
        "completed_orders": 0,
        "open_orders": 2,
        "rejection_rate": 2.1
    })

    admin_user = {"name": "Admin", "role": "admin", "permissions": []}
    res = service.process_chat(
        message="How many production orders are pending and what is our delay?",
        branch_id="SH",
        current_user=admin_user
    )

    assert "Direct answer:" in res["answer"]
    assert res["structured_data"] is not None
    assert res["structured_data"]["type"] == "production_orders"
    meta = res["structured_data"].get("meta", {})
    assert "order_completion_rate" in meta
    assert "plan_variance_units" in meta


def test_advisor_finance_writeback_strictly_disabled():
    """Verify that financial write-back cannot be executed and safety policy remains enforced."""
    service = AIAssistantService()
    with patch("app.core.config.settings.FINANCE_WRITEBACK_ENABLED", False):
        resp, card, nav = service._execute_tool(
            tool_name="submit_approved_record_update",
            args={"entity_type": "invoice", "record_id": "1001", "updates": {"DocTotal": 99999.0}},
            permitted_warehouse="SH",
            current_user={"role": "admin"}
        )
        assert resp.get("is_disabled") is True
        assert "disabled" in resp.get("error", "").lower()


