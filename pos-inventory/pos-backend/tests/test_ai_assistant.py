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
    assert res["structured_data"]["type"] == "sales_invoices"

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
    
    mock_invoices_service.return_value.get_recent_invoices.return_value = [{"DocEntry": i, "U_Branch": "WH-01"} for i in range(101)]
    
    service = AIAssistantService()
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
