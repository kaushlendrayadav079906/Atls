import pytest
from unittest.mock import MagicMock, patch
from app.services.ai_service import AIAssistantService
from app.core.config import settings
from fastapi.testclient import TestClient
from app.main import app
import openai
import json
from fastapi import HTTPException

client = TestClient(app)

@pytest.fixture
def mock_openai():
    with patch('app.services.ai_service.openai.OpenAI') as mock:
        yield mock

def test_ai_service_initialization(mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    service = AIAssistantService()
    assert service.client is not None
    assert service.model == settings.OPENAI_MODEL

def test_missing_api_key(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    with pytest.raises(ValueError, match="OPENAI_API_KEY is not configured"):
        AIAssistantService()

@patch('app.services.ai_service.SAPProductionService')
def test_process_chat_success(mock_sap_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = "Summary: ..."
    mock_choice1.message.tool_calls = None
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_llm_instance.chat.completions.create.return_value = mock_response1
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(
            message="Hello",
            branch_id="WH-01",
            current_user=user,
            conversation_id="conv-1"
        )
        
    assert res["answer"] == "Summary: ..."
    assert res["conversation_id"] == "conv-1"
    assert res["branch_context"] == "WH-01"

@patch('app.services.ai_service.SAPProductionService')
def test_unauthorized_branch(mock_sap_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    # Simulate _get_permitted_branch raising HTTPException
    with patch('app.services.ai_service._get_permitted_branch', side_effect=HTTPException(status_code=403, detail="Unauthorized")):
        with pytest.raises(HTTPException):
            service.process_chat(
                message="Hello",
                branch_id="WH-02",
                current_user=user
            )

@patch('app.services.ai_service.SAPProductionService')
def test_process_chat_with_tool_call(mock_sap_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    # First response: call a tool
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_production_orders"
    mock_tool_call.function.arguments = json.dumps({"date_from": "2024-01-01", "date_to": "2024-01-31"})
    mock_tool_call.id = "call_123"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    # Second response: final answer
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Here are the orders."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    
    mock_sap_service.return_value.get_production_orders.return_value = ([{"docNum": 1}], 1)
    mock_sap_service.return_value.get_production_summary.return_value = {"total": 1}
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(
            message="Get orders",
            branch_id="WH-01",
            current_user=user
        )
        
    assert res["answer"] == "Here are the orders."
    assert res["structured_data"] is not None
    assert res["structured_data"]["orders"][0]["docNum"] == 1

@patch('app.services.ai_service.SAPProductionService')
def test_process_chat_invalid_dates(mock_sap_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    # First response: call a tool with invalid dates
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_production_orders"
    mock_tool_call.function.arguments = json.dumps({"date_from": "2024-02-01", "date_to": "2024-01-01"})
    mock_tool_call.id = "call_123"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    # Second response
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Invalid dates."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(
            message="Get orders",
            branch_id="WH-01",
            current_user=user
        )
        
    assert res["answer"] == "Invalid dates."
    # API should not have been called due to validation
    mock_sap_service.return_value.get_production_orders.assert_not_called()

@patch('app.services.ai_service.SAPProductionService')
def test_process_chat_api_error(mock_sap_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    mock_llm_instance.chat.completions.create.side_effect = openai.APIError(
        message="Rate limit",
        request=MagicMock(),
        body=None
    )
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        with pytest.raises(Exception, match="Failed to communicate with AI provider due to an API error."):
            service.process_chat(
                message="Hello",
                branch_id="WH-01",
                current_user=user
            )

@patch('app.services.ai_service.SAPProductionService')
def test_process_chat_malformed_arguments(mock_sap_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_production_orders"
    mock_tool_call.function.arguments = "{ invalid json"
    mock_tool_call.id = "call_123"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Malformed."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(
            message="Hello",
            branch_id="WH-01",
            current_user=user
        )
        
    assert res["answer"] == "Malformed."

@patch('app.services.ai_service.SAPProductionService')
def test_process_chat_iteration_limit(mock_sap_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    # Always return a tool call to simulate an infinite loop
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "unknown_tool"
    mock_tool_call.function.arguments = "{}"
    mock_tool_call.id = "call_123"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_llm_instance.chat.completions.create.return_value = mock_response1
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(
            message="Hello",
            branch_id="WH-01",
            current_user=user
        )
        
    # Should stop after max_iterations and return fallback text
    assert res["answer"] == "I need more time to process that request."

@patch('app.services.ai_service.SAPInvoicesService')
def test_process_chat_sales_invoices(mock_invoices_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_sales_invoices"
    mock_tool_call.function.arguments = json.dumps({"date_from": "2024-01-01", "date_to": "2024-01-31"})
    mock_tool_call.id = "call_sales"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Here are the sales."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    
    mock_invoices_service.return_value.get_invoices_by_date.return_value = [{"DocEntry": 1, "U_Branch": "WH-01"}]
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(message="Get sales", branch_id="WH-01", current_user=user)
        
    assert res["answer"] == "Here are the sales."
    assert res["structured_data"]["type"] in ("sales_invoices", "table")

@patch('app.services.ai_service.SAPInventoryService')
def test_process_chat_inventory_stock(mock_inventory_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_inventory_stock"
    mock_tool_call.function.arguments = json.dumps({"item_code": "ITM1"})
    mock_tool_call.id = "call_inv"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Item has 10 units."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    
    mock_inventory_service.return_value.get_item_stock.return_value = 10.0
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(message="Get stock", branch_id="WH-01", current_user=user)
        
    assert res["answer"] == "Item has 10 units."
    assert res["structured_data"]["type"] == "inventory_stock"

@patch('app.services.ai_service.SAPBusinessPartnersService')
def test_process_chat_search_customers(mock_bp_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "search_customers"
    mock_tool_call.function.arguments = json.dumps({"search_term": "John"})
    mock_tool_call.id = "call_cust"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Found customer."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    
    mock_bp_service.return_value.search_customers.return_value = [{"CardName": "John Doe"}]
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(message="Find John", branch_id="WH-01", current_user=user)
        
    assert res["answer"] == "Found customer."
@patch('app.services.ai_service.SAPReturnsService')
def test_process_chat_sales_returns(mock_returns_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_sales_returns"
    mock_tool_call.function.arguments = json.dumps({"date_from": "2024-01-01", "date_to": "2024-01-31"})
    mock_tool_call.id = "call_returns"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Here are the returns."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    
    mock_returns_service.return_value.get_returns_by_date.return_value = [{"DocEntry": 1, "U_Branch": "WH-01"}]
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(message="Get returns", branch_id="WH-01", current_user=user)
        
    assert res["answer"] == "Here are the returns."
    assert res["structured_data"]["type"] == "sales_returns"

@patch('app.services.ai_service.SAPInvoicesService')
def test_process_chat_sales_invoices_partial(mock_invoices_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_sales_invoices"
    mock_tool_call.function.arguments = json.dumps({})
    mock_tool_call.id = "call_sales"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Truncated."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    
    mock_invoices = [{"DocEntry": i, "U_Branch": "WH-01", "DocTotal": 100.0} for i in range(101)]
    mock_invoices_service.return_value.get_recent_invoices.return_value = mock_invoices
    mock_invoices_service.return_value.get_invoices_by_date.return_value = mock_invoices
    
    service = AIAssistantService()
    service.finance_service.invoices_service = mock_invoices_service.return_value
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(message="Get sales", branch_id="WH-01", current_user=user)
        
    assert res["answer"] == "Truncated."
    # Ensure tool message captured 'is_partial': true
    called_messages = mock_llm_instance.chat.completions.create.call_args_list[1][1]['messages']
    tool_msg = next((m for m in called_messages if m.get("role") == "tool"), None)
    assert tool_msg is not None
    content = json.loads(tool_msg["content"])
    assert content["meta"]["is_partial"] is True

@patch('app.services.ai_service.SAPItemsService')
def test_process_chat_get_products(mock_items_service, mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value
    
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_products"
    mock_tool_call.function.arguments = json.dumps({"search": "Widget", "limit": 5})
    mock_tool_call.id = "call_prod"
    
    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]
    
    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Here are the products."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]
    
    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]
    mock_items_service.return_value.get_items.return_value = [{"ItemCode": "W1", "ItemName": "Widget A"}]
    
    service = AIAssistantService()
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}
    
    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(message="Search products Widget", branch_id="WH-01", current_user=user)
        
    assert res["answer"] == "Here are the products."
    mock_items_service.return_value.get_items.assert_called_once_with(search="Widget", top=5)


@patch('app.services.ai_service.SAPWarehousesService')
@patch('app.services.ai_service.SAPInvoicesService')
@patch('app.services.ai_service.openai.OpenAI')
def test_analytical_table_weekly_sales_by_branch(mock_openai, mock_invoices_service, mock_warehouses_service):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_analytical_table"
    mock_tool_call.function.arguments = json.dumps({"metric": "sales", "group_by": "branch", "range": "week"})
    mock_tool_call.id = "call_table_1"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Here is the weekly sales breakdown by branch."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    mock_warehouses_service.return_value.get_warehouses.return_value = [
        {"WarehouseCode": "SH", "WarehouseName": "Sahibabad"},
        {"WarehouseCode": "DEL", "WarehouseName": "Delhi"}
    ]

    # Controlled fixture: 2 valid invoices, 1 cancelled invoice (must be excluded)
    mock_invoices_service.return_value.get_invoices_by_date_with_lines.return_value = [
        {
            "DocEntry": 101,
            "DocNum": 101,
            "DocDate": "2026-10-10",
            "DocTotal": 3000.0,
            "Cancelled": "tNO",
            "DocumentLines": [
                {"LineTotal": 2000.0, "WarehouseCode": "SH"},
                {"LineTotal": 1000.0, "WarehouseCode": "DEL"}
            ]
        },
        {
            "DocEntry": 102,
            "DocNum": 102,
            "DocDate": "2026-10-11",
            "DocTotal": 1500.0,
            "Cancelled": "tNO",
            "DocumentLines": [
                {"LineTotal": 1500.0, "WarehouseCode": "SH"}
            ]
        },
        {
            "DocEntry": 103,
            "DocNum": 103,
            "DocDate": "2026-10-12",
            "DocTotal": 9999.0,
            "Cancelled": "tYES",  # Cancelled document must be excluded
            "DocumentLines": [
                {"LineTotal": 9999.0, "WarehouseCode": "SH"}
            ]
        }
    ]

    service = AIAssistantService()
    admin_user = {"name": "Admin User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value=None):
        res = service.process_chat(
            message="Show weekly sales by branch.",
            branch_id="SH",
            current_user=admin_user
        )

    assert res["answer"] == "Here is the weekly sales breakdown by branch."
    card = res["structured_data"]
    assert card is not None
    assert card["type"] == "table"
    assert "Weekly Sales by Branch" in card["title"] or "Sales by Branch" in card["title"]
    assert len(card["columns"]) == 4
    col_keys = [c["key"] for c in card["columns"]]
    assert "branch" in col_keys
    assert "sales" in col_keys
    assert "invoiceCount" in col_keys
    assert "averageBill" in col_keys

    # Check rows & deterministic calculations:
    # SH: 2000 + 1500 = 3500, Count = 2
    # DEL: 1000, Count = 1
    # Cancelled invoice (9999) is excluded!
    rows = card["rows"]
    assert len(rows) == 2
    sh_row = next(r for r in rows if r["branchCode"] == "SH")
    del_row = next(r for r in rows if r["branchCode"] == "DEL")
    assert sh_row["sales"] == 3500.0
    assert sh_row["invoiceCount"] == 2
    assert del_row["sales"] == 1000.0
    assert del_row["invoiceCount"] == 1

    # Check chart config
    assert card["chart"] is not None
    assert card["chart"]["type"] == "bar"
    assert card["chart"]["xKey"] == "branch"
    assert card["chart"]["series"] == ["sales"]


@patch('app.services.ai_service.SAPWarehousesService')
@patch('app.services.ai_service.SAPInvoicesService')
@patch('app.services.ai_service.openai.OpenAI')
def test_analytical_table_branch_authorization_manager(mock_openai, mock_invoices_service, mock_warehouses_service):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_analytical_table"
    mock_tool_call.function.arguments = json.dumps({"metric": "sales", "group_by": "branch", "range": "week"})
    mock_tool_call.id = "call_table_2"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Manager scoped results."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    mock_invoices_service.return_value.get_invoices_by_date_with_lines.return_value = [
        {"DocEntry": 1, "DocTotal": 1000.0, "Cancelled": "tNO", "DocumentLines": [{"LineTotal": 1000.0, "WarehouseCode": "SH"}]},
        {"DocEntry": 2, "DocTotal": 2000.0, "Cancelled": "tNO", "DocumentLines": [{"LineTotal": 2000.0, "WarehouseCode": "DEL"}]}
    ]

    service = AIAssistantService()
    # Manager locked to SH
    manager_user = {"name": "Manager User", "role": "manager", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value="SH"):
        res = service.process_chat(
            message="Show weekly sales by branch.",
            branch_id="SH",
            current_user=manager_user
        )

    card = res["structured_data"]
    assert card["type"] == "table"
    # DEL must be filtered out for non-admin locked to SH
    assert len(card["rows"]) == 1
    assert card["rows"][0]["branchCode"] == "SH"
    assert card["rows"][0]["sales"] == 1000.0


@patch('app.services.ai_service.SAPInvoicesService')
@patch('app.services.ai_service.openai.OpenAI')
def test_analytical_table_empty_results(mock_openai, mock_invoices_service):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_analytical_table"
    mock_tool_call.function.arguments = json.dumps({"metric": "sales", "group_by": "branch", "range": "today"})
    mock_tool_call.id = "call_table_3"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Zero sales today."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    # Empty invoices returned
    mock_invoices_service.return_value.get_invoices_by_date_with_lines.return_value = []

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value=None):
        res = service.process_chat(
            message="Show sales today by branch.",
            branch_id="SH",
            current_user=user
        )

    card = res["structured_data"]
    assert card["type"] == "table"
    assert len(card["rows"]) == 0
    assert "No sales records" in card["summary"]
    assert card["chart"] is None


@patch('app.services.ai_service.openai.OpenAI')
def test_analytical_table_unsupported_group_by(mock_openai):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_analytical_table"
    mock_tool_call.function.arguments = json.dumps({"metric": "sales", "group_by": "unsupported_dim"})
    mock_tool_call.id = "call_table_err"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Unsupported grouping dimension."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value=None):
        res = service.process_chat(
            message="Group by unsupported dimension.",
            branch_id="SH",
            current_user=user
        )

    assert res["answer"] == "Unsupported grouping dimension."
    # Ensure tool message captured error details
    called_messages = mock_llm_instance.chat.completions.create.call_args_list[1][1]['messages']
    tool_msg = next((m for m in called_messages if m.get("role") == "tool"), None)
    assert tool_msg is not None
    content = json.loads(tool_msg["content"])
    assert "error" in content
    assert "Unsupported grouping dimension" in content["error"]


@patch('app.services.ai_service.SAPInvoicesService')
@patch('app.services.ai_service.openai.OpenAI')
def test_analytical_table_past_6_months_monthly_revenue(mock_openai, mock_invoices_service):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_analytical_table"
    mock_tool_call.function.arguments = json.dumps({"metric": "sales", "group_by": "month", "range": "past_6_months"})
    mock_tool_call.id = "call_past_6m"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Here is the monthly revenue for the past 6 months."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    # Return sample invoices across months
    mock_invoices_service.return_value.get_invoices_by_date.return_value = [
        {"DocEntry": 1, "DocDate": "2026-07-04", "DocTotal": 2480.0, "Cancelled": "tNO"},
        {"DocEntry": 2, "DocDate": "2026-10-07", "DocTotal": 2240.0, "Cancelled": "tNO"},
        {"DocEntry": 3, "DocDate": "2026-10-02", "DocTotal": 247.8, "Cancelled": "tNO"},
        {"DocEntry": 4, "DocDate": "2026-08-15", "DocTotal": 1000.0, "Cancelled": "tYES"}, # Cancelled, must exclude
    ]

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value=None):
        res = service.process_chat(
            message="Show me revenue per month for the past 6 months",
            branch_id="SH",
            current_user=user
        )

    card = res["structured_data"]
    assert card["type"] == "table"
    assert card["title"] == "Monthly Revenue (Past 6 Months)"
    assert len(card["rows"]) == 6 # All 6 months represented
    # Verify July 2026 has ₹2,480.00
    jul_row = next(r for r in card["rows"] if "Jul 2026" in r["month"])
    assert jul_row["sales"] == 2480.0
    assert jul_row["invoiceCount"] == 1

    # Verify Oct 2026 has ₹2,487.80 (2 invoices)
    oct_row = next(r for r in card["rows"] if "Oct 2026" in r["month"])
    assert oct_row["sales"] == 2487.8
    assert oct_row["invoiceCount"] == 2

    # Verify chart configuration
    assert card["chart"]["type"] == "bar"
    assert card["chart"]["xKey"] == "month"
    assert card["chart"]["series"] == ["sales"]


@patch('app.services.ai_service.SAPInvoicesService')
@patch('app.services.ai_service.openai.OpenAI')
def test_analytical_table_comparison_this_month_vs_last_month(mock_openai, mock_invoices_service):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_analytical_table"
    mock_tool_call.function.arguments = json.dumps({"metric": "sales", "group_by": "comparison", "range": "compare_last_month"})
    mock_tool_call.id = "call_cmp_month"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Here is the comparison."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    # Return this month vs last month
    def mock_get_inv(d_from, d_to):
        if d_from.month == 10:
            return [{"DocEntry": 1, "DocTotal": 2487.80, "Cancelled": "tNO"}]
        return [{"DocEntry": 2, "DocTotal": 1200.00, "Cancelled": "tNO"}]

    mock_invoices_service.return_value.get_invoices_by_date.side_effect = mock_get_inv

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value=None):
        res = service.process_chat(
            message="Compare this month with last month",
            branch_id="SH",
            current_user=user
        )

    card = res["structured_data"]
    assert card["type"] == "table"
    assert len(card["rows"]) == 3
    assert card["rows"][0]["sales"] == 2487.8
    assert card["rows"][1]["sales"] == 1200.0
    # Variance row
    assert card["rows"][2]["sales"] == 1287.8
    assert "Variance" in card["rows"][2]["period"]


@patch('app.services.ai_service.SAPInvoicesService')
@patch('app.services.ai_service.openai.OpenAI')
def test_analytical_table_customer_wise_sales(mock_openai, mock_invoices_service):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_analytical_table"
    mock_tool_call.function.arguments = json.dumps({"metric": "sales", "group_by": "customer"})
    mock_tool_call.id = "call_cust_sales"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Here are the top customers."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    mock_invoices_service.return_value.get_invoices_by_date_with_lines.return_value = [
        {"DocEntry": 1, "CardCode": "C001", "CardName": "Acme Corp", "DocTotal": 5000.0, "Cancelled": "tNO"},
        {"DocEntry": 2, "CardCode": "C001", "CardName": "Acme Corp", "DocTotal": 3000.0, "Cancelled": "tNO"},
        {"DocEntry": 3, "CardCode": "C002", "CardName": "Beta Ltd", "DocTotal": 2000.0, "Cancelled": "tNO"},
    ]

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value=None):
        res = service.process_chat(
            message="Show customer-wise sales",
            branch_id="SH",
            current_user=user
        )

    card = res["structured_data"]
    assert card["type"] == "table"
    assert len(card["rows"]) == 2
    assert card["rows"][0]["customerName"] == "Acme Corp"
    assert card["rows"][0]["sales"] == 8000.0
    assert card["rows"][0]["invoiceCount"] == 2
    assert card["chart"]["xKey"] == "customerName"


@patch('app.services.ai_service.SAPInvoicesService')
@patch('app.services.ai_service.openai.OpenAI')
def test_analytical_table_sap_connection_error(mock_openai, mock_invoices_service):
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_analytical_table"
    mock_tool_call.function.arguments = json.dumps({"metric": "sales", "group_by": "branch", "range": "week"})
    mock_tool_call.id = "call_sap_err"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Failed to fetch sales data due to SAP connection error."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    from app.services.sap.client import SAPConnectionError
    mock_invoices_service.return_value.get_invoices_by_date_with_lines.side_effect = SAPConnectionError("Connection refused by SAP")

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value=None):
        res = service.process_chat(
            message="Show weekly sales by branch",
            branch_id="SH",
            current_user=user
        )

    # Tool message sent to LLM should reflect the error, not fake zero rows
    called_messages = mock_llm_instance.chat.completions.create.call_args_list[1][1]['messages']
    tool_msg = next((m for m in called_messages if m.get("role") == "tool"), None)
    assert tool_msg is not None
    content = json.loads(tool_msg["content"])
    assert "error" in content
    assert "Failed to connect to SAP Business One" in content["error"]



