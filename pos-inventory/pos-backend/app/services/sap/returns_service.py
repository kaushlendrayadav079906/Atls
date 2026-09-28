"""SAP Returns service – A/R Return and Credit Note document management"""

from typing import Dict, Any, List, Optional
from datetime import datetime, date
import logging

from app.services.sap.client import get_sap_client, SAPValidationError, SAPConnectionError, SAPDocumentClosedError
from app.core.config import settings


logger = logging.getLogger(__name__)

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
        card_code = str(data.get("cardCode") or "").strip()
        if not card_code:
            raise SAPValidationError("cardCode must come from the original invoice")

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
            "CardCode": card_code,
            "DocumentLines": document_lines,
            "Comments": " | ".join(comments_parts),
        }

        logger.info(
            "Creating SAP Credit Note from invoice: original_doc_entry=%s reason=%r type=%s",
            original_doc_entry, reason, return_type,
        )
        try:
            result = self.client.post("CreditNotes", payload)
        except SAPDocumentClosedError:
            logger.warning(
                "Invoice DocEntry=%s is already closed in SAP; refusing to create an unlinked credit note.",
                original_doc_entry,
            )
            raise
        if not isinstance(result, dict) or not result.get("DocEntry"):
            raise SAPConnectionError("SAP returned no credit-note document reference")
        logger.info("SAP Credit Note created: DocEntry=%s DocNum=%s", result.get("DocEntry"), result.get("DocNum"))
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

    def get_returns_by_date(
        self,
        start_date: date,
        end_date: date,
        warehouse: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        page_size = 100
        max_documents = 500
        headers: List[Dict[str, Any]] = []
        skip = 0
        while len(headers) < max_documents:
            top = min(page_size, max_documents - len(headers))
            params = {
                "$filter": f"DocDate ge '{start_str}' and DocDate le '{end_str}'",
                "$orderby": "DocEntry desc",
                "$top": top,
                "$skip": skip,
            }
            response = self.client.get("CreditNotes", params)
            page = response.get("value")
            if not isinstance(page, list):
                raise RuntimeError("SAP returned an invalid credit-note page")
            if not page:
                break
            headers.extend(page)
            if len(page) < top:
                break
            skip += len(page)

        if len(headers) >= max_documents:
            probe = self.client.get("CreditNotes", {
                "$filter": f"DocDate ge '{start_str}' and DocDate le '{end_str}'",
                "$orderby": "DocEntry desc",
                "$top": 1,
                "$skip": max_documents,
            })
            if probe.get("value"):
                raise RuntimeError(f"Credit-note query exceeds the configured limit of {max_documents} documents")

        results: List[Dict[str, Any]] = []
        for header in headers:
            doc_entry = header.get("DocEntry")
            if doc_entry is None:
                raise RuntimeError("SAP credit-note header is missing DocEntry")
            full_doc = self.client.get(f"CreditNotes({doc_entry})")
            if not isinstance(full_doc, dict):
                raise RuntimeError("SAP returned an invalid credit-note document")
            lines = full_doc.get("CreditNoteLines")
            if not isinstance(lines, list) or not lines:
                raise RuntimeError("SAP credit note is missing warehouse-attributed lines")

            if warehouse:
                line_warehouses = {
                    str(line.get("WarehouseCode") or "").strip().upper()
                    for line in lines
                }
                if "" in line_warehouses or len(line_warehouses) != 1:
                    raise RuntimeError("SAP credit note does not have a single attributable warehouse")
                if warehouse.strip().upper() not in line_warehouses:
                    continue
            results.append(full_doc)
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
