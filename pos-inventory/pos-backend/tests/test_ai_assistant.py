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
    
    service = AIAssistantService()
    service.finance_service.get_sales_invoices = MagicMock(return_value=[{"DocEntry": 1, "DocNum": 1, "DocTotal": 100, "DocDate": "2024-01-05", "U_Branch": "WH-01"}])
    user = {"name": "Test User", "role": "Admin", "branch_id": "WH-01"}

    with patch('app.services.ai_service._get_permitted_branch', return_value="WH-01"):
        res = service.process_chat(message="Get sales", branch_id="WH-01", current_user=user)
        
    assert res["answer"] == "Here are the sales."
    assert res["structured_data"]["type"] in ("sales_invoices", "table")

@patch('app.services.ai_service.SAPItemsService')
@patch('app.services.ai_service.SAPInventoryService')
def test_process_chat_inventory_stock(mock_inventory_service, mock_items_service, mock_openai):
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
    
    mock_items_service.return_value.get_item_by_code.return_value = {"ItemCode": "ITM1", "ItemName": "Item 1"}
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


@patch('app.services.ai_service.openai.OpenAI')
def test_chat_greeting_returns_useful_answer(mock_openai):
    """Scenario 1: A greeting returns a useful answer."""
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_choice = MagicMock()
    mock_choice.message.content = "Hello! I am your ATLAS Personal AI Assistant. I can assist you with business performance, stock levels, sales and purchase orders, payments, and production analytics."
    mock_choice.message.tool_calls = None
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_llm_instance.chat.completions.create.return_value = mock_response

    service = AIAssistantService()
    user = {"name": "Admin User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value="SH"):
        res = service.process_chat(
            message="Hi there! What can you help me with?",
            branch_id="SH",
            current_user=user,
            conversation_id="conv-greeting-1"
        )

    assert "ATLAS" in res["answer"]
    assert res["conversation_id"] == "conv-greeting-1"
    assert res["branch_context"] == "SH"


@patch('app.services.ai_service.SAPSalesOrdersService')
@patch('app.services.ai_service.openai.OpenAI')
def test_chat_supported_business_data_question(mock_openai, mock_sales_orders_service):
    """Scenario 2: A supported business-data question returns an authorized, data-grounded answer."""
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_sales_orders"
    mock_tool_call.function.arguments = json.dumps({"status": "pending", "limit": 5})
    mock_tool_call.id = "call_so"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "You have 3 pending Sales Orders totaling ₹45,000."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    mock_sales_orders_service.return_value.get_sales_order_summary.return_value = {
        "total": 10, "pending": 3, "completed": 7, "cancelled": 0
    }
    mock_sales_orders_service.return_value.list_sales_orders.return_value = {
        "value": [{"DocNum": 101, "CardName": "Customer A", "DocTotal": 15000.0}],
        "odata.count": 1
    }

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value="SH"):
        res = service.process_chat(
            message="Show me pending sales orders",
            branch_id="SH",
            current_user=user
        )

    assert "pending Sales Orders" in res["answer"]
    assert res["structured_data"] is not None
    assert res["structured_data"]["type"] == "sales_orders"


@patch('app.services.ai_service.openai.OpenAI')
def test_chat_unsupported_question_controlled_explanation(mock_openai):
    """Scenario 3: An unsupported question receives a controlled explanation."""
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_choice = MagicMock()
    mock_choice.message.content = "I cannot perform database deletion or execute arbitrary SQL. I can only query authorized business records like sales, products, and finance reports."
    mock_choice.message.tool_calls = None
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_llm_instance.chat.completions.create.return_value = mock_response

    service = AIAssistantService()
    user = {"name": "Test User", "role": "user", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value="SH"):
        res = service.process_chat(
            message="Delete all customer tables in the database",
            branch_id="SH",
            current_user=user
        )

    assert "cannot perform" in res["answer"]
    assert res["structured_data"] is None


@patch('app.services.ai_service.SAPInventoryService')
@patch('app.services.ai_service.openai.OpenAI')
def test_chat_sap_offline_produces_clear_status(mock_openai, mock_inventory_service):
    """Scenario 4: SAP disconnection produces clear error state with type 'sap_offline'."""
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_inventory_stock"
    mock_tool_call.function.arguments = json.dumps({"warehouse": "SH", "low_stock_only": True})
    mock_tool_call.id = "call_inv_err"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "SAP Service Layer is currently disconnected. Please check connection."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    from app.services.sap.client import SAPConnectionError
    mock_inventory_service.return_value.get_warehouse_stock.side_effect = SAPConnectionError("SAP unreachable")

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value="SH"):
        res = service.process_chat(
            message="Check low stock items",
            branch_id="SH",
            current_user=user
        )

    assert res["structured_data"] is not None
    assert res["structured_data"]["type"] == "sap_offline"
    msg = res["structured_data"]["message"].lower()
    assert any(term in msg for term in ("unreachable", "disconnected", "offline"))


@patch('app.services.ai_service.SAPInventoryService')
@patch('app.services.ai_service.SAPItemsService')
@patch('app.services.ai_service.openai.OpenAI')
def test_chat_product_sku_resolution_and_navigation(mock_openai, mock_items_service, mock_inventory_service):
    """Scenario 5 & 6: Asking for product by SKU resolves real product and returns navigation action."""
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_inventory_stock"
    mock_tool_call.function.arguments = json.dumps({"item_code": "AMIT000121"})
    mock_tool_call.id = "call_sku"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Product AMIT000121 has 42 units in stock. You can open its details below."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    mock_items_service.return_value.get_item_by_code.return_value = {
        "ItemCode": "AMIT000121",
        "ItemName": "Sample Amit Product"
    }
    mock_inventory_service.return_value.get_item_stock.return_value = 42.0

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value="SH"):
        res = service.process_chat(
            message="Open product AMIT000121",
            branch_id="SH",
            current_user=user
        )

    assert res["structured_data"] is not None
    assert res["structured_data"]["navigation"] is not None
    nav = res["structured_data"]["navigation"]
    assert nav["label"] == "Open Product Details"
    assert nav["route"] == "/products"
    assert nav["params"]["search"] == "AMIT000121"
    assert nav["params"]["openDetails"] == "true"


@patch('app.services.ai_service.SAPInventoryService')
@patch('app.services.ai_service.SAPItemsService')
@patch('app.services.ai_service.openai.OpenAI')
def test_chat_product_nonexistent_handled_safely(mock_openai, mock_items_service, mock_inventory_service):
    """Scenario 11: Nonexistent product handled safely without fake data or arbitrary route."""
    settings.OPENAI_API_KEY = "test_key"
    mock_llm_instance = mock_openai.return_value

    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_inventory_stock"
    mock_tool_call.function.arguments = json.dumps({"item_code": "NONEXISTENT_999"})
    mock_tool_call.id = "call_missing"

    mock_choice1 = MagicMock()
    mock_choice1.message.content = None
    mock_choice1.message.tool_calls = [mock_tool_call]
    mock_response1 = MagicMock()
    mock_response1.choices = [mock_choice1]

    mock_choice2 = MagicMock()
    mock_choice2.message.content = "Product NONEXISTENT_999 was not found in SAP inventory records."
    mock_choice2.message.tool_calls = None
    mock_response2 = MagicMock()
    mock_response2.choices = [mock_choice2]

    mock_llm_instance.chat.completions.create.side_effect = [mock_response1, mock_response2]

    mock_items_service.return_value.get_item_by_code.return_value = None
    mock_items_service.return_value.get_items.return_value = []

    service = AIAssistantService()
    user = {"name": "Test User", "role": "admin", "branch_id": "SH"}

    with patch('app.services.ai_service._get_permitted_branch', return_value="SH"):
        res = service.process_chat(
            message="Check stock for NONEXISTENT_999",
            branch_id="SH",
            current_user=user
        )

    # Tool returned found: False, no navigation to fake page
    called_messages = mock_llm_instance.chat.completions.create.call_args_list[1][1]['messages']
    tool_msg = next((m for m in called_messages if m.get("role") == "tool"), None)
    assert tool_msg is not None
    content = json.loads(tool_msg["content"])
    assert content.get("found") is False


def test_navigate_to_module_safety():
    """Scenario 11: Navigation only allows registered internal routes and rejects arbitrary destinations."""
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.openai.OpenAI'):
        service = AIAssistantService()

        # Valid registered target
        resp, card, nav = service._execute_tool(
            "navigate_to_module",
            {"target_module": "finance_overview"},
            "SH",
            {"name": "Admin", "role": "admin"}
        )
        assert nav is not None
        assert nav["route"] == "/finance"

        # Invalid arbitrary target
        resp_bad, card_bad, nav_bad = service._execute_tool(
            "navigate_to_module",
            {"target_module": "http://malicious-site.com/exploit"},
            "SH",
            {"name": "Admin", "role": "admin"}
        )
        assert nav_bad is None
        assert "Unknown" in resp_bad["error"]


def test_no_sap_write_operations_in_tools_schema():
    """Scenario 12: No SAP write operations are introduced in tools schema."""
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.openai.OpenAI'):
        service = AIAssistantService()
        tools = service._get_tools_schema()
        tool_names = [t["function"]["name"] for t in tools]

        # Verify all tools are strictly read-only or navigational
        forbidden_keywords = ["create", "update", "delete", "insert", "drop", "write", "modify", "patch", "post"]
        for name in tool_names:
            if name in ("propose_record_update", "submit_approved_record_update"):
                # submit_approved_record_update should NOT be in tools schema when writeback is disabled
                assert name != "submit_approved_record_update", f"Forbidden tool {name} exposed in schema!"
            for kw in ["create", "delete", "drop", "insert"]:
                assert kw not in name.lower(), f"Tool {name} contains forbidden write verb '{kw}'"


def test_nlp_pipeline_intent_recognition():
    """Verify that the NLP intelligence pipeline accurately recognizes business intents and extracts parameters."""
    from app.core import nlp_pipeline

    admin_user = {"username": "admin", "role": "admin", "permissions": ["users.manage", "dashboard.view", "products.view"]}

    # 1. "Show me today's sales."
    r1 = nlp_pipeline.analyze_query("Show me today's sales.", admin_user)
    assert r1.intent_id == "dashboard.kpis"
    assert r1.entities.range == "today"
    assert r1.suggested_tool == "get_dashboard_summary"
    assert r1.suggested_tool_args.get("range") == "today"

    # 2. "Which products are running low on stock?"
    r2 = nlp_pipeline.analyze_query("Which products are running low on stock?", admin_user)
    assert r2.intent_id == "inventory.low_stock"
    assert r2.entities.low_stock is True
    assert r2.suggested_tool == "get_inventory_stock"
    assert r2.suggested_tool_args.get("low_stock_only") is True

    # 3. "Show pending production orders."
    r3 = nlp_pipeline.analyze_query("Show pending production orders.", admin_user)
    assert r3.intent_id == "production.orders"
    assert r3.suggested_tool == "get_production_orders"
    assert r3.suggested_tool_args.get("status") in ("pending", "open", "released", "Planned", "planned")

    # 4. "Compare this month's sales with last month."
    r4 = nlp_pipeline.analyze_query("Compare this month's sales with last month.", admin_user)
    assert r4.intent_id == "dashboard.sales_trend"
    assert r4.entities.range == "compare_last_month"
    assert r4.suggested_tool == "get_analytical_table"

    # 5. "Which customers have outstanding balances?"
    r5 = nlp_pipeline.analyze_query("Which customers have outstanding balances?", admin_user)
    assert r5.intent_id == "customers.receivables"
    assert r5.suggested_tool == "get_accounts_receivable"

    # 6. "Show purchase invoices for this supplier."
    r6 = nlp_pipeline.analyze_query("Show purchase invoices for this supplier.", admin_user)
    assert r6.intent_id == "finance.purchase_invoices"
    assert r6.suggested_tool == "get_purchase_invoices"

    # 7. "Create a report showing production rejection by item."
    r7 = nlp_pipeline.analyze_query("Create a report showing production rejection by item.", admin_user)
    assert r7.intent_id == "production.rejection"
    assert r7.suggested_tool in ("get_analytical_table", "get_production_rejection")

    # 8. "Find the customer with the highest sales."
    r8 = nlp_pipeline.analyze_query("Find the customer with the highest sales.", admin_user)
    assert r8.intent_id == "customers.ranking"
    assert r8.suggested_tool == "get_customer_sales_ranking"

    # 9. "Which employees can edit products?"
    r9 = nlp_pipeline.analyze_query("Which employees can edit products?", admin_user)
    assert r9.intent_id == "settings.user_lookup"
    assert r9.suggested_tool == "get_admin_user_info"
    assert r9.suggested_tool_args.get("feature_permission") == "products.edit"

    # 10. "What can I access with my current permissions?"
    r10 = nlp_pipeline.analyze_query("What can I access with my current permissions?", admin_user)
    assert r10.intent_id == "settings.my_permissions"
    assert r10.suggested_tool == "get_my_permissions"

    # 11. "Show me all available reports."
    r11 = nlp_pipeline.analyze_query("Show me all available reports.", admin_user)
    assert r11.intent_id == "reports.catalog"
    assert r11.suggested_tool == "get_available_reports"

    # 12. "Open the inventory report."
    r12 = nlp_pipeline.analyze_query("Open the inventory report.", admin_user)
    assert r12.intent_id == "navigation.goto"
    assert r12.suggested_tool == "navigate_to_module"


def test_nlp_pipeline_contextual_follow_ups():
    """Verify conversational context preservation across follow-up queries."""
    from app.core import nlp_pipeline

    user = {"username": "manager", "role": "manager", "permissions": ["dashboard.view"]}
    context = {
        "last_metric": "sales",
        "last_range": "month",
        "last_branch": "SH",
        "last_tool": "get_analytical_table",
        "last_module": "Dashboard"
    }

    # Follow-up: "Compare with last month"
    res1 = nlp_pipeline.analyze_query("Compare with last month", user, context)
    assert res1.is_follow_up is True
    assert res1.entities.range == "compare_last_month"
    assert res1.entities.metric == "sales"

    # Follow-up: "Show the top five"
    res2 = nlp_pipeline.analyze_query("Show the top five", user, context)
    assert res2.is_follow_up is True
    assert res2.entities.limit == 5

    # Follow-up: "Only for this branch"
    res3 = nlp_pipeline.analyze_query("Only for this branch", user, context)
    assert res3.is_follow_up is True
    assert res3.entities.branch == "SH"


def test_capability_registry_integrity_and_rbac():
    """Verify capability registry integrity, path validity, and RBAC filtering."""
    from app.core.capability_registry import get_all_capabilities, get_capabilities_for_role

    all_caps = get_all_capabilities()
    assert len(all_caps) >= 12

    for cap in all_caps:
        assert cap.related_route.startswith("/")
        assert cap.authorized_backend_tool
        assert cap.is_read_only is True

    # Admin gets all capabilities
    admin_caps = get_capabilities_for_role("admin", [])
    assert len(admin_caps) == len(all_caps)

    # Regular employee without users.manage should NOT have settings.user_lookup
    user_caps = get_capabilities_for_role("user", ["products.view", "dashboard.view"])
    user_cap_ids = [c.capability_id for c in user_caps]
    assert "settings.user_lookup" not in user_cap_ids
    assert "settings.my_permissions" in user_cap_ids
    assert "inventory.stock_levels" in user_cap_ids


def test_admin_user_info_authorization_and_data():
    """Verify get_admin_user_info RBAC: Admin authorized, non-admin forbidden, confidential fields masked."""
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.openai.OpenAI'):
        service = AIAssistantService()

        # Admin user: authorized
        admin_user = {"username": "admin", "role": "admin", "permissions": ["users.manage"]}
        resp_adm, card_adm, nav_adm = service._execute_tool(
            "get_admin_user_info",
            {"feature_permission": "products.edit"},
            "SH",
            admin_user
        )
        assert "error" not in resp_adm
        assert card_adm is not None
        assert card_adm["type"] == "admin_users_info"
        assert nav_adm["route"] == "/settings"
        # Ensure password hashes are never exposed
        for u in resp_adm.get("users", []):
            assert "password" not in u
            assert "hashed_password" not in u

        # Non-admin user without users.manage: forbidden
        regular_user = {"username": "john", "role": "user", "permissions": ["products.view"]}
        resp_reg, card_reg, nav_reg = service._execute_tool(
            "get_admin_user_info",
            {},
            "SH",
            regular_user
        )
        assert "Forbidden" in resp_reg.get("error", "")
        assert card_reg is None


def test_my_permissions_self_service():
    """Verify get_my_permissions returns effective role, modules, and permissions for any authenticated employee."""
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.openai.OpenAI'):
        service = AIAssistantService()

        user = {
            "id": "usr-123",
            "name": "Alex Operator",
            "role": "user",
            "branch_id": "SH",
            "permissions": ["products.view", "dashboard.view"]
        }
        resp, card, nav = service._execute_tool("get_my_permissions", {}, "SH", user)
        assert resp["user_name"] == "Alex Operator"
        assert resp["role"] == "user"
        assert card is not None
        assert card["type"] == "my_permissions"
        assert "Products" in card["modules_accessible"] or "Dashboard" in card["modules_accessible"]


def test_get_available_reports_catalog():
    """Verify get_available_reports returns all 11 reports with proper routes and permissions."""
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.openai.OpenAI'):
        service = AIAssistantService()

        admin_user = {"username": "admin", "role": "admin"}
        resp, card, nav = service._execute_tool("get_available_reports", {}, "SH", admin_user)

        assert resp["total_available"] == 11
        assert card is not None
        assert card["type"] == "report_catalog"
        routes = [r["route"] for r in resp["reports"]]
        assert "/reports/sales" in routes
        assert "/reports/inventory" in routes
        assert "/production/rejection" in routes
        assert "/finance/profitability-reports" in routes
        assert "/reports/ai" in routes
        assert nav["route"] == "/reports"


@patch('app.services.ai_service.SAPProductionService')
def test_analytical_table_production_rejection(mock_prod_service):
    """Verify get_analytical_table supports production_rejection metric with deterministic scrap counts and bar chart."""
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.openai.OpenAI'):
        service = AIAssistantService()

        mock_prod_service.return_value.get_rejection_summary.return_value = {
            "total_rejection": 45,
            "rejection_percentage": 4.5,
            "items": [
                {"item_code": "ITM-001", "item_name": "Bearing Assembly", "produced_qty": 500, "rejected_qty": 30, "rejection_percentage": 6.0},
                {"item_code": "ITM-002", "item_name": "Gear Housing", "produced_qty": 500, "rejected_qty": 15, "rejection_percentage": 3.0}
            ]
        }

        admin_user = {"username": "admin", "role": "admin", "permissions": ["production.view"]}
        resp, card, nav = service._execute_tool(
            "get_analytical_table",
            {"metric": "production_rejection", "group_by": "item", "range": "month"},
            "SH",
            admin_user
        )

        assert card is not None
        assert card["type"] == "table"
        assert "Production Rejection" in card["title"]
        assert len(card["rows"]) == 2
        assert card["rows"][0]["itemCode"] == "ITM-001"
        assert card["rows"][0]["rejectedQty"] == 30
        assert card["chart"]["type"] == "bar"
        assert any(s in card["chart"]["series"] for s in ("rejectionRate", "rejectedQty"))
        assert nav["route"] == "/production/rejection"


def test_analytical_table_comparison_zero_previous_period():
    """Verify that when previous period sales is zero, comparison handles it safely without division by zero or fake percentage."""
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.openai.OpenAI'):
        service = AIAssistantService()

        # Invoices only for current period, empty for previous period
        service.invoices_service.get_invoices_by_date = MagicMock(side_effect=[
            [{"DocTotal": "50000.00", "DocDate": "2026-10-10", "U_BCode": "SH"}],  # Current
            []  # Previous (zero sales)
        ])

        admin_user = {"username": "admin", "role": "admin"}
        resp, card, nav = service._execute_tool(
            "get_analytical_table",
            {"metric": "sales", "group_by": "comparison", "range": "compare_last_month"},
            "SH",
            admin_user
        )

        assert card is not None
        assert "Period Comparison" in card["title"]
        assert "zero sales" in card["summary"]
        assert "reliably" in card["summary"]
        # Third row is variance row
        var_row = card["rows"][2]
        assert "N/A" in var_row["period"]
        assert card["filters"]["additional"]["Net Growth"] == "N/A"


def test_nlp_top_products_ranking_follow_up():
    """Verify multi-turn conversation flow: top 5 products -> compare their quantity -> only this month."""
    from app.core.nlp_pipeline import analyze_query

    user = {"username": "manager", "role": "manager", "permissions": ["products.view", "dashboard.view"]}

    # Turn 1: Top 5 products by sales
    q1 = analyze_query("Show me the top five products by sales", user)
    assert q1.intent_id == "inventory.top_products"
    assert q1.entities.limit == 5
    assert q1.entities.metric == "sales"
    assert q1.suggested_tool == "get_products"
    assert q1.suggested_tool_args["ranking_by"] == "sales"

    # Turn 2: Compare their quantity sold
    ctx1 = {
        "last_tool": "get_products",
        "last_intent": "inventory.top_products",
        "last_limit": 5,
        "last_metric": "sales",
        "last_range": "month"
    }
    q2 = analyze_query("Compare their quantity sold", user, context=ctx1)
    assert q2.is_follow_up is True
    assert q2.intent_id == "inventory.top_products"
    assert q2.entities.limit == 5
    assert q2.entities.metric == "quantity"
    assert q2.suggested_tool_args["ranking_by"] == "quantity"

    # Turn 3: Only this month
    ctx2 = {
        "last_tool": "get_products",
        "last_intent": "inventory.top_products",
        "last_limit": 5,
        "last_metric": "quantity",
        "last_range": "past_6_months"
    }
    q3 = analyze_query("Only this month", user, context=ctx2)
    assert q3.is_follow_up is True
    assert q3.intent_id == "inventory.top_products"
    assert q3.entities.range == "month"
    assert q3.entities.metric == "quantity"
    assert q3.suggested_tool_args["range"] == "month"


def test_get_products_quantity_vs_sales_ranking():
    """Verify get_products sorts correctly by quantity vs salesAmount and returns metadata."""
    settings.OPENAI_API_KEY = "test_key"
    with patch('app.services.ai_service.openai.OpenAI'):
        service = AIAssistantService()

        # Item A has high revenue but low qty; Item B has high qty but low revenue
        mock_invoices = [
            {
                "DocEntry": 1,
                "DocDate": "2026-10-15",
                "U_BCode": "SH",
                "DocumentLines": [
                    {"ItemCode": "ITEM-A", "ItemDescription": "Luxury Part A", "Quantity": 2.0, "LineTotal": 20000.0},
                    {"ItemCode": "ITEM-B", "ItemDescription": "Common Part B", "Quantity": 100.0, "LineTotal": 5000.0}
                ]
            }
        ]
        service.invoices_service.get_recent_invoices_with_lines = MagicMock(return_value=mock_invoices)

        admin_user = {"username": "admin", "role": "admin"}

        # 1. Rank by sales amount (default)
        resp_sales, card_sales, _ = service._execute_tool(
            "get_products",
            {"top_selling_only": True, "ranking_by": "sales_amount", "limit": 5},
            "SH",
            admin_user
        )
        assert resp_sales["top_products"][0]["itemCode"] == "ITEM-A"
        assert card_sales["meta"]["ranking_by"] == "sales_amount"

        # 2. Rank by quantity sold
        resp_qty, card_qty, _ = service._execute_tool(
            "get_products",
            {"top_selling_only": True, "ranking_by": "quantity", "limit": 5},
            "SH",
            admin_user
        )
        assert resp_qty["top_products"][0]["itemCode"] == "ITEM-B"
        assert card_qty["meta"]["ranking_by"] == "quantity"
        assert "Quantity" in card_qty["meta"]["ranking_label"]


def test_get_workflow_flowchart_tool_and_modules():
    """Verify get_workflow_flowchart returns validated structured flowchart for all 11 ATLAS modules."""
    from app.services.ai_service import AIAssistantService
    from app.core.workflow_flows import SUPPORTED_WORKFLOW_MODULES

    service = AIAssistantService()
    user = {"username": "manager", "role": "manager", "permissions": ["dashboard.view"]}

    for mod in SUPPORTED_WORKFLOW_MODULES:
        tool_resp, card, nav = service._execute_tool(
            "get_workflow_flowchart",
            {"module": mod},
            "SH",
            user
        )
        assert card is not None
        assert card["type"] == "flowchart"
        flow = card["flowchart"]
        assert "nodes" in flow
        assert len(flow["nodes"]) >= 3
        assert len(flow["edges"]) >= 2
        for node in flow["nodes"]:
            assert "id" in node
            assert "stepNumber" in node
            assert "title" in node
            assert "type" in node
            assert node["type"] in ("start", "process", "decision", "end")
        for edge in flow["edges"]:
            assert "from" in edge
            assert "to" in edge
        assert nav is not None
        assert "route" in nav


def test_flowchart_nlp_intent_and_follow_up():
    """Verify NLP recognizes process questions and contextual 'show me the process flowchart' follow-ups."""
    from app.core.nlp_pipeline import nlp_pipeline

    user = {"role": "admin"}

    # Standalone process question
    res1 = nlp_pipeline.analyze_query("How does a sale work in ATLAS?", user)
    assert res1.intent_id == "workflow.flowchart"
    assert res1.suggested_tool == "get_workflow_flowchart"
    assert res1.suggested_tool_args["module"] in ("sales", "sales_pos")

    # Contextual follow-up
    prev_ctx = {"last_module": "production", "last_tool": "get_production_orders"}
    res2 = nlp_pipeline.analyze_query("Show me the process flowchart", user, context=prev_ctx)
    assert res2.intent_id == "workflow.flowchart"
    assert res2.suggested_tool == "get_workflow_flowchart"
    assert res2.suggested_tool_args["module"] in ("production", "production_orders")
    assert res2.is_follow_up is True


def test_automatic_flowchart_attachment_to_tool_cards():
    """Verify tools automatically attach verified workflow flowcharts to their cards."""
    from app.services.ai_service import AIAssistantService

    service = AIAssistantService()
    user = {"username": "admin", "role": "admin"}

    # Mock sales orders
    service.sales_orders_service.get_sales_order_summary = MagicMock(return_value={"total": 5})
    service.sales_orders_service.list_sales_orders = MagicMock(return_value={"value": [{"DocNum": 1}], "odata.count": 1})

    _, card_so, _ = service._execute_tool("get_sales_orders", {"limit": 5}, "SH", user)
    assert card_so is not None
    assert "flowchart" in card_so
    assert "Sales" in card_so["flowchart"]["module"]

    # Mock inventory stock
    service.inventory_service.get_warehouse_stock = MagicMock(return_value=[{"ItemCode": "ITEM-1", "QuantityOnStock": 5.0}])
    _, card_inv, _ = service._execute_tool("get_inventory_stock", {"warehouse": "SH"}, "SH", user)
    assert card_inv is not None
    assert "flowchart" in card_inv
    assert "Product" in card_inv["flowchart"]["module"] or "Inventory" in card_inv["flowchart"]["module"]


def test_analytical_tool_charts_and_kpis():
    """Verify backend tools return validated chart configs, KPIs, and data structures for chat rendering."""
    from app.services.ai_service import AIAssistantService

    service = AIAssistantService()
    user = {"username": "admin", "role": "admin", "permissions": ["dashboard.view", "products.view", "production.view"]}

    # 1. Low stock inventory chart
    service.inventory_service.get_warehouse_stock = MagicMock(return_value=[
        {"ItemCode": "ITEM-1", "ItemName": "Widget A", "QuantityOnStock": 2.0, "ItemWarehouseInfoCollection": [{"WarehouseCode": "SH", "MinimalStock": 10.0}]}
    ])
    _, card_risk, _ = service._execute_tool("get_inventory_stock", {"low_stock_only": True, "warehouse": "SH"}, "SH", user)
    assert card_risk["type"] == "inventory_risk"
    assert card_risk["chart"] is not None
    assert card_risk["chart"]["type"] == "bar"
    assert card_risk["chart"]["defaultView"] == "both"
    assert "QuantityOnStock" in card_risk["chart"]["series"]

    # 2. Production orders chart
    service.production_service.get_production_orders = MagicMock(return_value=([
        {"production_order_no": "PO-1", "item_name": "Assembly X", "planned_qty": 100, "produced_qty": 40}
    ], 1))
    service.production_service.get_production_summary = MagicMock(return_value={"planned_orders": 1})
    _, card_prod, _ = service._execute_tool("get_production_orders", {"warehouse": "SH"}, "SH", user)
    assert card_prod["type"] == "production_orders"
    assert card_prod["chart"] is not None
    assert card_prod["chart"]["type"] == "bar"
    assert card_prod["chart"]["defaultView"] == "both"
    assert "planned_qty" in card_prod["chart"]["series"]

    # 3. Top products chart
    service.invoices_service.get_recent_invoices_with_lines = MagicMock(return_value=[
        {"DocumentLines": [{"ItemCode": "P1", "ItemDescription": "Prod 1", "Quantity": 10, "LineTotal": 5000}]}
    ])
    _, card_top, _ = service._execute_tool("get_products", {"top_selling_only": True, "limit": 5}, "SH", user)
    assert card_top["type"] == "top_products"
    assert card_top["chart"] is not None
    assert card_top["chart"]["type"] == "horizontal_bar"
    assert card_top["chart"]["defaultView"] == "both"








