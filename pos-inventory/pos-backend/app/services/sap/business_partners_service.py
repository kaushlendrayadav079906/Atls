"""SAP Business Partners service - Customer management"""

from typing import Dict, Any, Optional, List
import logging
import re

from app.services.sap.client import get_sap_client, SAPValidationError
from app.core.config import settings


logger = logging.getLogger(__name__)


class SAPBusinessPartnersService:
    """Service for SAP Business Partners (Customers) operations"""

    _MAX_CARD_CODE_LENGTH = 15
    
    def __init__(self):
        self.client = get_sap_client()
        self.default_card_type = settings.SAP_DEFAULT_CARD_TYPE

    def _build_customer_payload(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """Build standard SAP Business Partner fields from checkout customer data.

        UDF fields (U_C_Name, U_W_Number, U_P_Method, U_S_Employee) belong on
        A/R Invoices, NOT on Business Partners. Only standard BP fields are set here.
        """
        payload: Dict[str, Any] = {}

        if customer_data.get("phone"):
            payload["Phone1"] = customer_data["phone"]

        if customer_data.get("email"):
            payload["EmailAddress"] = customer_data["email"]

        # Cellular = WhatsApp / mobile number using the standard SAP field
        if customer_data.get("whatsapp_number"):
            payload["Cellular"] = customer_data["whatsapp_number"]
        elif customer_data.get("phone"):
            payload["Cellular"] = customer_data["phone"]

        return payload
    
    def get_customer(self, card_code: str) -> Optional[Dict[str, Any]]:
        """
        Get customer by CardCode
        
        Args:
            card_code: SAP CardCode
            
        Returns:
            Business Partner or None
        """
        try:
            endpoint = f"BusinessPartners('{card_code}')"
            bp = self.client.get(endpoint)
            return bp
            
        except SAPValidationError:
            return None
        except Exception as e:
            logger.error(f"Error fetching customer {card_code}: {str(e)}")
            raise
    
    def search_customers(self, search_term: Optional[str] = None, top: int = 100) -> List[Dict[str, Any]]:
        """
        Search for customers
        
        Args:
            search_term: Search in CardCode or CardName
            top: Maximum results
            
        Returns:
            List of Business Partners
        """
        try:
            params = {
                "$top": top,
                "$filter": f"CardType eq '{self.default_card_type}'",
            }
            
            if search_term:
                search_filter = f"(contains(CardCode, '{search_term}') or contains(CardName, '{search_term}'))"
                params["$filter"] += f" and {search_filter}"
            
            response = self.client.get("BusinessPartners", params)
            return response.get("value", [])
            
        except Exception as e:
            logger.error(f"Error searching customers: {str(e)}")
            raise

    def create_customer(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new customer in SAP
        
        Args:
            customer_data: Customer details (name, phone, email, whatsapp_number, payment_method, sales_employee)
            
        Returns:
            Created Business Partner
        """
        try:
            # Generate CardCode from name or use provided
            card_code = customer_data.get("card_code")
            if not card_code:
                card_code = self._generate_card_code(customer_data["name"])
            
            payload = {
                "CardCode": card_code,
                "CardName": customer_data["name"],
                "CardType": self.default_card_type,
            }

            payload.update(self._build_customer_payload(customer_data))

            logger.info(
                f"[CUSTOMER CREATE] BEFORE -> payload: {payload}"
            )
            result = self.client.post("BusinessPartners", payload)
            logger.info(
                f"[CUSTOMER CREATE] AFTER  -> CardCode={result.get('CardCode')}, "
                f"CardName={result.get('CardName')}, Phone1={result.get('Phone1')}, "
                f"Cellular={result.get('Cellular')}, EmailAddress={result.get('EmailAddress')}"
            )

            return result
            
        except Exception as e:
            logger.error(f"Error creating customer in SAP: {str(e)}")
            raise

    def _generate_card_code(self, customer_name: str) -> str:
        """Generate a SAP-safe CardCode within the Business Partner length limit."""
        normalized_name = re.sub(r"[^A-Z0-9]", "", customer_name.upper())
        if not normalized_name:
            normalized_name = "CUSTOMER"

        available_name_length = self._MAX_CARD_CODE_LENGTH - 1
        return f"C{normalized_name[:available_name_length]}"
    
    def update_customer(self, card_code: str, update_data: Dict[str, Any]) -> bool:
        """
        Update existing customer
        
        Args:
            card_code: SAP CardCode
            update_data: Fields to update
            
        Returns:
            True if successful
        """
        try:
            payload = self._build_customer_payload(update_data)

            if "name" in update_data:
                payload["CardName"] = update_data["name"]

            if not payload:
                return True
            
            endpoint = f"BusinessPartners('{card_code}')"
            logger.info(
                f"[CUSTOMER UPDATE] BEFORE -> CardCode={card_code}, payload: {payload}"
            )
            self.client.patch(endpoint, payload)
            logger.info(
                f"[CUSTOMER UPDATE] AFTER  -> CardCode={card_code} updated successfully"
            )
            return True
            
        except Exception as e:
            logger.error(f"Error updating customer {card_code}: {str(e)}")
            raise
    
    def get_or_create_customer(self, customer_data: Dict[str, Any]) -> str:
        """
        Get existing customer or create new one
        
        Args:
            customer_data: Customer details
            
        Returns:
            CardCode (existing or newly created)
        """
        try:
            # Try to find existing customer by name
            search_results = self.search_customers(customer_data["name"], top=5)
            
            # Check for exact match
            for bp in search_results:
                if bp.get("CardName", "").lower() == customer_data["name"].lower():
                    self.update_customer(bp["CardCode"], customer_data)
                    return bp["CardCode"]
            
            # Create new customer if not found
            result = self.create_customer(customer_data)
            return result["CardCode"]
            
        except Exception as e:
            logger.error(f"Error in get_or_create_customer: {str(e)}")
            raise

    def get_total_customers_count(self) -> int:
        """
        Get the total number of customers
        """
        try:
            params = {
                "$filter": f"CardType eq '{self.default_card_type}'",
                "$top": 1,
                "$inlinecount": "allpages"
            }
            response = self.client.get("BusinessPartners", params)
            return response.get("odata.count", response.get("@odata.count", 0))
        except Exception as e:
            logger.error(f"Error getting total customers count: {str(e)}")
            return 0
