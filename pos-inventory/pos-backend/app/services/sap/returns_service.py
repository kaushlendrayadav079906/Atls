"""SAP Returns service – A/R Return and Credit Note document management"""

from typing import Dict, Any, List, Optional
from datetime import datetime, date
import logging

from app.services.sap.client import get_sap_client, SAPValidationError, SAPDocumentClosedError
from app.core.config import settings


logger = logging.getLogger(__name__)

DEFAULT_CUSTOMER_CODE = "C0001"


class SAPReturnsService:
    """Service for SAP A/R Return and Credit Note operations"""

    def __init__(self):
        self.client = get_sap_client()
        self.default_warehouse = settings.SAP_DEFAULT_WAREHOUSE

    def create_credit_note_from_invoice(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create an A/R Credit Note directly linked to an A/R Invoice (BaseType 13).

        This is the correct single-step flow when invoices are posted without
        delivery notes, maintaining the full document chain in SAP.
        """
        today = date.today().strftime("%Y-%m-%d")
        try:
            original_doc_entry = int(data["originalDocEntry"])
        except (TypeError, ValueError, KeyError):
            raise SAPValidationError("originalDocEntry must be a valid invoice DocEntry")
        if original_doc_entry <= 0:
            raise SAPValidationError("originalDocEntry must be a positive invoice DocEntry")
        reason = str(data.get("reason") or "").strip()
        return_type = str(data.get("returnType") or "refund").lower()

        document_lines = []
        for item in data["items"]:
            warehouse = str(item.get("warehouse") or data.get("warehouse") or self.default_warehouse)
            base_line = item.get("baseLine")
            if base_line is None:
                raise SAPValidationError(
                    f"Missing baseLine for item {item.get('itemCode') or ''}; cannot link to invoice lines"
                )
            line: Dict[str, Any] = {
                "ItemCode": item["itemCode"],
                "Quantity": item["quantity"],
                "UnitPrice": float(item.get("unitPrice") or 0),
                "WarehouseCode": warehouse,
                "BaseType": 13,          # A/R Invoice
                "BaseEntry": original_doc_entry,
                "BaseLine": int(base_line),
            }
            document_lines.append(line)

        comments_parts = [f"Return reason: {reason}"] if reason else []
        comments_parts.append(f"Return type: {return_type}")
        comments_parts.append(f"Ref original invoice DocEntry: {original_doc_entry}")
        if data.get("originalDocNum"):
            comments_parts.append(f"Original DocNum: {data['originalDocNum']}")

        payload: Dict[str, Any] = {
            "DocDate": today,
            "DocDueDate": today,
            "CardCode": str(data.get("cardCode") or DEFAULT_CUSTOMER_CODE),
            "DocumentLines": document_lines,
            "Comments": " | ".join(comments_parts),
        }

        if reason:
            payload["U_Return_Reason"] = reason[:50]

        logger.info(
            "Creating SAP Credit Note from invoice: original_doc_entry=%s reason=%r type=%s",
            original_doc_entry, reason, return_type,
        )
        try:
            result = self.client.post("CreditNotes", payload)
        except SAPDocumentClosedError:
            logger.warning(
                "Invoice DocEntry=%s is already closed in SAP; "
                "falling back to standalone credit note without base-document link.",
                original_doc_entry,
            )
            result = self._create_independent_credit_note(data)
        logger.info("SAP Credit Note created: DocEntry=%s DocNum=%s", result.get("DocEntry"), result.get("DocNum"))
        return result

    def _fetch_invoice_ref(self, doc_entry: int) -> Dict[str, Any]:
        """Fetch the DocNum and DocDate of an invoice by DocEntry.

        Returns a dict with keys 'DocNum' and 'DocDate' (YYYY-MM-DD string),
        or empty dict on failure.
        """
        try:
            inv = self.client.get(
                f"Invoices({doc_entry})",
                {"$select": "DocNum,DocDate"},
            )
            doc_date = str(inv.get("DocDate") or "")[:10]
            return {"DocNum": inv.get("DocNum"), "DocDate": doc_date}
        except Exception as exc:
            logger.debug("Could not fetch invoice ref for DocEntry=%s: %s", doc_entry, exc)
            return {}

    def _create_independent_credit_note(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a standalone A/R Credit Note NOT linked to any base document.

        Used as fallback when the original invoice is already closed in SAP.
        SAP company settings may require every credit note to reference the
        original invoice number and date (error -10).  We satisfy this by:
          - Setting NumAtCard to the original invoice DocNum (customer ref field)
          - Setting Ref1 / Ref2 to the invoice DocNum and DocDate
        """
        today = date.today().strftime("%Y-%m-%d")
        original_doc_entry = data.get("originalDocEntry")
        reason = str(data.get("reason") or "").strip()
        return_type = str(data.get("returnType") or "refund").lower()

        # Fetch original invoice reference data so SAP's "reference required"
        # validation passes (error -10).
        inv_ref: Dict[str, Any] = {}
        if original_doc_entry:
            inv_ref = self._fetch_invoice_ref(int(original_doc_entry))

        original_doc_num = data.get("originalDocNum") or inv_ref.get("DocNum")
        original_doc_date = inv_ref.get("DocDate") or today

        document_lines = []
        for item in data["items"]:
            warehouse = str(item.get("warehouse") or data.get("warehouse") or self.default_warehouse)
            document_lines.append({
                "ItemCode": item["itemCode"],
                "Quantity": item["quantity"],
                "UnitPrice": float(item.get("unitPrice") or 0),
                "WarehouseCode": warehouse,
                # No BaseType/BaseEntry/BaseLine — standalone note
            })

        comments_parts = [f"Return reason: {reason}"] if reason else []
        comments_parts.append(f"Return type: {return_type}")
        if original_doc_entry:
            comments_parts.append(f"Ref original invoice DocEntry: {original_doc_entry}")
        if original_doc_num:
            comments_parts.append(f"Original DocNum: {original_doc_num}")
        comments_parts.append("Note: Standalone CN – original invoice already closed")

        payload: Dict[str, Any] = {
            "DocDate": today,
            "DocDueDate": today,
            "TaxDate": original_doc_date,       # original invoice date (reference)
            "CardCode": str(data.get("cardCode") or DEFAULT_CUSTOMER_CODE),
            "DocumentLines": document_lines,
            "Comments": " | ".join(comments_parts),
        }

        # Satisfy SAP's "Please reference the original invoice no. and date"
        # requirement (error -10) using every available reference field:
        #   OriginalRefNo / OriginalRefDate  — India GST localization fields
        #   NumAtCard / Ref1 / Ref2          — generic reference fields
        if original_doc_num is not None:
            payload["NumAtCard"] = str(original_doc_num)
            payload["Ref1"] = str(original_doc_num)
            payload["OriginalRefNo"] = str(original_doc_num)
        payload["Ref2"] = original_doc_date
        payload["OriginalRefDate"] = original_doc_date

        if reason:
            payload["U_Return_Reason"] = reason[:50]

        result = self.client.post("CreditNotes", payload)
        logger.info(
            "Standalone SAP Credit Note created: DocEntry=%s DocNum=%s",
            result.get("DocEntry"), result.get("DocNum"),
        )
        return result

    def check_invoice_has_return(self, doc_num: int) -> bool:
        """Check if any credit note references this invoice via BaseRef (SAP sets this automatically).

        Returns True if at least one A/R Credit Note is linked to the invoice.
        """
        try:
            params = {
                "$filter": f"BaseRef eq '{doc_num}'",
                "$top": 1,
                "$select": "DocEntry",
            }
            response = self.client.get("CreditNotes", params)
            return len(response.get("value", [])) > 0
        except Exception as exc:
            logger.debug("Could not check credit notes for invoice DocNum=%s: %s", doc_num, exc)
            return False

    def get_return(self, doc_entry: int) -> Optional[Dict[str, Any]]:
        """Fetch a Credit Note by DocEntry (Option A: all returns are Credit Notes)."""
        try:
            return self.client.get(f"CreditNotes({doc_entry})")
        except Exception as exc:
            logger.warning("Could not fetch Credit Note %s: %s", doc_entry, exc)
            return None

    def get_returns_by_date(self, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        params = {
            "$filter": f"DocDate ge '{start_str}' and DocDate le '{end_str}'",
            "$orderby": "DocEntry desc",
            "$top": 500,
        }
        try:
            response = self.client.get("CreditNotes", params)
            headers = response.get("value", [])
        except Exception as exc:
            logger.warning("Could not fetch Credit Notes by date: %s", exc)
            return []

        results: List[Dict[str, Any]] = []
        for header in headers:
            doc_entry = header.get("DocEntry")
            if doc_entry is None:
                results.append(header)
                continue
            try:
                full_doc = self.client.get(f"CreditNotes({doc_entry})")
                results.append(full_doc or header)
            except Exception:
                results.append(header)
        return results

    def get_recent_returns(self, limit: int = 50) -> List[Dict[str, Any]]:
        params = {
            "$orderby": "DocEntry desc",
            "$top": limit,
        }
        try:
            response = self.client.get("CreditNotes", params)
            headers = response.get("value", [])
        except Exception as exc:
            logger.warning("Could not fetch recent Credit Notes: %s", exc)
            return []

        results: List[Dict[str, Any]] = []
        for header in headers:
            doc_entry = header.get("DocEntry")
            if doc_entry is None:
                results.append(header)
                continue
            try:
                full_doc = self.client.get(f"CreditNotes({doc_entry})")
                results.append(full_doc or header)
            except Exception:
                results.append(header)
        return results
