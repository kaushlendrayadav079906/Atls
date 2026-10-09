import json
import logging
import uuid
from typing import Any, Dict, List, Optional
import openai
from app.core.config import settings
from app.services.sap.production_service import SAPProductionService
from app.services.sap.invoices_service import SAPInvoicesService
from app.services.sap.inventory_service import SAPInventoryService
from app.services.sap.business_partners_service import SAPBusinessPartnersService
from app.services.sap.returns_service import SAPReturnsService
from app.api.v1.atlas import _get_permitted_branch
from app.api.v1.sales import _extract_branch_from_invoice, _normalize_branch
from datetime import datetime

logger = logging.getLogger(__name__)

class AIAssistantService:
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured on the server")
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
        self.production_service = SAPProductionService()
        self.invoices_service = SAPInvoicesService()
        self.inventory_service = SAPInventoryService()
        self.business_partners_service = SAPBusinessPartnersService()
        self.returns_service = SAPReturnsService()

    def process_chat(
        self,
        message: str,
        branch_id: str,
        current_user: Dict[str, Any],
        conversation_id: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        # Validate authorization
        permitted_warehouse = _get_permitted_branch(current_user, branch_id)

        # Prepare messages
        messages = [
            {
                "role": "system",
                "content": (
                    f"You are the Atls AI Business Assistant. You help users analyze their POS, Inventory, and Production data from SAP Business One.\n"
                    f"The authenticated user is {current_user.get('name', 'User')} ({current_user.get('role', 'user')}).\n"
                    f"The selected warehouse context is '{permitted_warehouse}'.\n"
                    "Use tools to fetch authorized data. Answer concisely using the data provided. "
                    "If a tool returns no data, explain that there are no records matching the criteria."
                )
            }
        ]

        if history:
            messages.extend(history)

        messages.append({"role": "user", "content": message})

        # Define tools
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_production_orders",
                    "description": "Fetch production orders with optional date filtering",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)"}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_sales_invoices",
                    "description": "Fetch sales invoices for the authorized branch with optional date filtering",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)"}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_inventory_stock",
                    "description": "Fetch current stock and inventory for the authorized warehouse. Optionally filter by item_code.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "item_code": {"type": "string", "description": "Specific item code to look up (optional)."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_customers",
                    "description": "Search for customers available to the authorized branch by mobile number or name.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search_term": {"type": "string", "description": "Mobile number or name fragment to search."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_sales_returns",
                    "description": "Fetch sales returns (credit memos) for the authorized branch by date range.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                            "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)"}
                        }
                    }
                }
            }
        ]

        try:
            iteration = 0
            max_iterations = 3
            structured_data = None
            final_text = None

            while iteration < max_iterations:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto"
                )
                
                response_message = response.choices[0].message
                tool_calls = response_message.tool_calls
                
                if not tool_calls:
                    final_text = response_message.content
                    break
                    
                messages.append(response_message)
                
                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    try:
                        function_args = json.loads(tool_call.function.arguments)
                    except json.JSONDecodeError:
                        messages.append({
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": function_name,
                            "content": json.dumps({"error": "Malformed arguments"})
                        })
                        continue
                        
                    if function_name == "get_production_orders":
                        date_from = function_args.get("date_from")
                        date_to = function_args.get("date_to")
                        
                        # Validate dates (basic string validation, ideally use datetime)
                        if date_from and date_to and date_from > date_to:
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps({"error": "date_from cannot be later than date_to"})
                            })
                            continue
                            
                        try:
                            # 1. Fetch raw orders
                            orders, total = self.production_service.get_production_orders(
                                skip=0, top=100, warehouse=permitted_warehouse,
                                date_from=date_from, date_to=date_to
                            )
                            # 2. Fetch summary metrics
                            summary = self.production_service.get_production_summary(
                                warehouse=permitted_warehouse, date_from=date_from, date_to=date_to
                            )
                            
                            tool_result = {
                                "summary": summary,
                                "total_records": total,
                                "sample_orders": orders[:20]  # Send subset to LLM context
                            }
                            
                            structured_data = {
                                "type": "production_orders",
                                "summary": summary,
                                "orders": orders
                            }
                            
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps(tool_result)
                            })
                            
                        except Exception as e:
                            logger.error(f"Tool error ({function_name}): {e}")
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps({"error": "SAP Service Error: Unable to fetch data"})
                            })
                            
                    elif function_name == "get_sales_invoices":
                        date_from = function_args.get("date_from")
                        date_to = function_args.get("date_to")
                        
                        if date_from and date_to and date_from > date_to:
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps({"error": "date_from cannot be later than date_to"})
                            })
                            continue
                            
                        try:
                            if date_from:
                                try:
                                    dt_from = datetime.strptime(date_from, "%Y-%m-%d").date()
                                    dt_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else dt_from
                                    raw_invoices = self.invoices_service.get_invoices_by_date(dt_from, dt_to)
                                except ValueError:
                                    messages.append({
                                        "tool_call_id": tool_call.id,
                                        "role": "tool",
                                        "name": function_name,
                                        "content": json.dumps({"error": "Invalid date format. Use YYYY-MM-DD."})
                                    })
                                    continue
                            else:
                                raw_invoices = self.invoices_service.get_recent_invoices(limit=100)
                                
                            filtered = []
                            for inv in raw_invoices:
                                inv_branch = _normalize_branch(_extract_branch_from_invoice(inv))
                                if current_user.get("role") == "admin" or inv_branch == permitted_warehouse:
                                    filtered.append(inv)
                                    
                            structured_data = {
                                "type": "sales_invoices",
                                "orders": filtered
                            }
                            
                            tool_result = {
                                "meta": {
                                    "branch_scope": permitted_warehouse,
                                    "date_range": f"{date_from} to {date_to}" if date_from else "Recent 100",
                                    "is_partial": len(filtered) >= 100,
                                    "disclaimer": "Do NOT calculate monthly or yearly totals from a partial/truncated list of invoices. Return counts only."
                                },
                                "total_invoices_found_in_scope": len(filtered),
                                "sample_invoices": filtered[:20]
                            }
                            
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps(tool_result)
                            })
                            
                        except Exception as e:
                            logger.error(f"Tool error ({function_name}): {e}")
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps({"error": "SAP Service Error: Unable to fetch sales"})
                            })

                    elif function_name == "get_inventory_stock":
                        item_code = function_args.get("item_code")
                        try:
                            if item_code:
                                stock = self.inventory_service.get_item_stock(item_code, permitted_warehouse)
                                tool_result = {
                                    "meta": {"warehouse": permitted_warehouse, "quantity_semantics": "Stock quantity represents physical On-Hand stock only. No low-stock thresholds are configured."},
                                    "item_code": item_code,
                                    "stock_quantity": stock
                                }
                                structured_data = {"type": "inventory_stock", "item_code": item_code, "stock": stock}
                            else:
                                all_items = self.inventory_service.get_warehouse_stock(permitted_warehouse)
                                items_only = [item for item in all_items if not item.get("_truncated")]
                                is_truncated = any(item.get("_truncated") for item in all_items)
                                tool_result = {
                                    "meta": {"warehouse": permitted_warehouse, "is_partial": is_truncated, "quantity_semantics": "Stock quantity represents physical On-Hand stock only. No low-stock thresholds are configured."},
                                    "total_items_in_warehouse_returned": len(items_only),
                                    "sample_items": items_only[:50]
                                }
                                structured_data = {"type": "inventory_list", "items": items_only}
                                
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps(tool_result)
                            })
                        except Exception as e:
                            logger.error(f"Tool error ({function_name}): {e}")
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps({"error": "SAP Service Error: Unable to fetch inventory"})
                            })
                            
                    elif function_name == "search_customers":
                        search_term = function_args.get("search_term")
                        try:
                            if search_term and search_term.isdigit() and len(search_term) >= 4:
                                customers = self.invoices_service.search_by_mobile(search_term, top=50)
                            else:
                                customers = self.business_partners_service.search_customers(search_term, top=50)
                                
                            tool_result = {"total_customers_found": len(customers), "customers": customers}
                            structured_data = {"type": "customers", "customers": customers}
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps(tool_result)
                            })
                        except Exception as e:
                            logger.error(f"Tool error ({function_name}): {e}")
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps({"error": "SAP Service Error: Unable to fetch customers"})
                            })
                            
                    elif function_name == "get_sales_returns":
                        date_from = function_args.get("date_from")
                        date_to = function_args.get("date_to")
                        
                        if date_from and date_to and date_from > date_to:
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps({"error": "date_from cannot be later than date_to"})
                            })
                            continue
                            
                        try:
                            if not date_from:
                                # Default to today
                                date_from = datetime.utcnow().strftime("%Y-%m-%d")
                            dt_from = datetime.strptime(date_from, "%Y-%m-%d").date()
                            dt_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else dt_from
                            
                            raw_returns = self.returns_service.get_returns_by_date(dt_from, dt_to)
                            
                            filtered_returns = []
                            for ret in raw_returns:
                                # We need to ensure branch scope matches. 
                                # Since returns_service returns AR Credit Notes, we look at the same UDF fields or lines
                                ret_branch = _normalize_branch(_extract_branch_from_invoice(ret))
                                if current_user.get("role") == "admin" or ret_branch == permitted_warehouse:
                                    filtered_returns.append(ret)
                            
                            structured_data = {
                                "type": "sales_returns",
                                "returns": filtered_returns
                            }
                            
                            tool_result = {
                                "meta": {
                                    "branch_scope": permitted_warehouse,
                                    "date_range": f"{date_from} to {date_to if date_to else date_from}",
                                    "is_partial": len(filtered_returns) >= 500, # Max returns limit
                                },
                                "total_returns_found": len(filtered_returns),
                                "sample_returns": filtered_returns[:20]
                            }
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps(tool_result)
                            })
                        except Exception as e:
                            logger.error(f"Tool error ({function_name}): {e}")
                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": json.dumps({"error": "SAP Service Error: Unable to fetch returns"})
                            })
                    else:
                        messages.append({
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": function_name,
                            "content": json.dumps({"error": "Unknown tool"})
                        })
                        
                iteration += 1

            if final_text is None:
                final_text = "I need more time to process that request."

            return {
                "answer": final_text,
                "conversation_id": conversation_id or str(uuid.uuid4()),
                "branch_context": permitted_warehouse,
                "structured_data": structured_data
            }

        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise Exception("Failed to communicate with AI provider due to an API error.")
        except Exception as e:
            logger.error(f"Unexpected error in AI service: {e}")
            raise Exception("An unexpected error occurred while processing the chat.")
