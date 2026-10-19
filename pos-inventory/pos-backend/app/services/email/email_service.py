"""
ATLAS Smart Email Service
Handles natural-language email draft generation, business record context resolution,
recipient validation, idempotency controls, and security audit logging.
"""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.models.schemas import (
    EmailAuditLogItem,
    EmailDraftRequest,
    EmailDraftResponse,
    EmailSendRequest,
    EmailSendResponse,
)
from app.services.email.provider import EmailProviderError, get_email_provider
from app.services.sap.business_partners_service import SAPBusinessPartnersService
from app.services.sap.finance_service import SAPFinanceService
from app.services.sap.invoices_service import SAPInvoicesService
from app.services.sap.purchase_orders_service import SAPPurchaseOrdersService
from app.services.sap.sales_orders_service import SAPSalesOrdersService
from app.services.user_service import _get_connection, log_security_event

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
)

# In-memory recent idempotency cache: {idempotency_key: (timestamp, result_dict)}
_IDEMPOTENCY_CACHE: Dict[str, Tuple[datetime, Dict[str, Any]]] = {}
_IDEMPOTENCY_TTL_SECONDS = 120.0


def validate_email_address(email_str: str) -> bool:
    """Validate email address format strictly."""
    if not email_str or not isinstance(email_str, str):
        return False
    return bool(EMAIL_REGEX.match(email_str.strip()))


class EmailService:
    """Intelligent email generation, validation, and delivery service."""

    def __init__(self):
        self.finance_service = SAPFinanceService()
        self.bp_service = SAPBusinessPartnersService()
        self.invoices_service = SAPInvoicesService()
        self.sales_orders_service = SAPSalesOrdersService()
        self.purchase_orders_service = SAPPurchaseOrdersService()

    def generate_draft(
        self,
        request: EmailDraftRequest,
        current_user: Dict[str, Any],
    ) -> EmailDraftResponse:
        """
        Generate a context-aware, verified email draft based on natural-language purpose
        and live SAP / PostgreSQL business records.
        """
        purpose = (request.purpose or "payment_reminder").lower().strip()
        warnings: List[str] = []

        # 1. Resolve business record context
        b_context, resolved_contact = self._resolve_business_context(request)

        # 2. Resolve recipient email and name
        recipient_email = (request.recipient_email or resolved_contact.get("email") or "").strip()
        recipient_name = (request.recipient_name or resolved_contact.get("name") or "Valued Partner").strip()

        if recipient_email and not validate_email_address(recipient_email):
            warnings.append(f"Recipient email '{recipient_email}' is not a valid email address.")
            is_ready = False
        elif not recipient_email:
            warnings.append("Recipient email is not registered in SAP. Please enter the recipient email before sending.")
            is_ready = False
        else:
            is_ready = True

        # 3. Derive subject and body according to purpose and verified data
        subject, body = self._build_email_content(
            purpose=purpose,
            recipient_name=recipient_name,
            b_context=b_context,
            prompt=request.prompt,
            additional_notes=request.additional_notes,
            current_user=current_user,
        )

        company_signature = getattr(
            settings,
            "COMPANY_SIGNATURE",
            "ATLAS Operations & Accounts Team\nATLAS Retail & Manufacturing",
        )

        draft_id = f"draft_{uuid.uuid4().hex[:12]}"

        return EmailDraftResponse(
            draft_id=draft_id,
            purpose=purpose,
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            cc=[],
            bcc=[],
            subject=subject,
            body=body,
            business_context=b_context,
            is_ready_to_send=is_ready,
            validation_warnings=warnings,
            company_signature=company_signature,
        )

    def send_email(
        self,
        request: EmailSendRequest,
        current_user: Dict[str, Any],
    ) -> EmailSendResponse:
        """
        Send an email message after explicit user confirmation.
        Enforces RBAC permissions, recipient format, duplicate prevention, and writes audit records.
        """
        # 1. Authorization Check: must have email.send permission or be admin/manager
        user_role = str(current_user.get("role") or "user").lower()
        user_perms = set(current_user.get("permissions") or [])
        if user_role not in ("admin", "manager") and "email.send" not in user_perms:
            logger.warning(
                "Email send rejected: User %s (role=%s) lacks email.send permission",
                current_user.get("username"),
                user_role,
            )
            raise PermissionError("You do not have permission to send emails. Requires 'email.send' permission or Manager/Admin role.")

        # 2. Explicit Confirmation Check: MUST be True
        if not request.confirmed:
            raise ValueError("Email sending requires explicit confirmation (confirmed=True).")

        # 3. Required Fields & Recipient Validation
        recipient = (request.recipient_email or "").strip()
        if not recipient:
            raise ValueError("Recipient email is required.")
        if not validate_email_address(recipient):
            raise ValueError(f"Invalid recipient email format: '{recipient}'.")

        subject = (request.subject or "").strip()
        if not subject:
            raise ValueError("Email subject cannot be empty.")

        body = (request.body or "").strip()
        if not body:
            raise ValueError("Email body cannot be empty.")

        # Validate CC / BCC addresses
        clean_cc = [c.strip() for c in (request.cc or []) if c and c.strip()]
        for c in clean_cc:
            if not validate_email_address(c):
                raise ValueError(f"Invalid CC email address format: '{c}'.")

        clean_bcc = [b.strip() for b in (request.bcc or []) if b and b.strip()]
        for b in clean_bcc:
            if not validate_email_address(b):
                raise ValueError(f"Invalid BCC email address format: '{b}'.")

        # 4. Idempotency Check & Duplicate Send Prevention
        idempotency_key = request.idempotency_key
        if not idempotency_key:
            # Deterministic fingerprint from recipient + subject + body + record_id
            fp_src = f"{recipient}|{subject}|{body}|{request.record_id or ''}"
            idempotency_key = hashlib.sha256(fp_src.encode("utf-8")).hexdigest()

        now = datetime.utcnow()
        if idempotency_key in _IDEMPOTENCY_CACHE:
            cached_time, cached_resp = _IDEMPOTENCY_CACHE[idempotency_key]
            if (now - cached_time).total_seconds() < _IDEMPOTENCY_TTL_SECONDS:
                logger.warning("Duplicate email send suppressed by idempotency control (key=%s)", idempotency_key[:12])
                return EmailSendResponse(**cached_resp)

        # Also check database for idempotency within last 60 seconds
        if self._check_db_idempotency(idempotency_key):
            logger.warning("Duplicate email send suppressed by DB idempotency check (key=%s)", idempotency_key[:12])
            raise ValueError("Duplicate email detected. This message was already submitted within the last 60 seconds.")

        # 5. Dispatch via Provider Adapter
        provider = get_email_provider()
        audit_id = str(uuid.uuid4())
        user_id = str(current_user.get("id") or "")
        username = str(current_user.get("username") or "user")

        try:
            send_result = provider.send(
                to_email=recipient,
                subject=subject,
                body=body,
                cc=clean_cc,
                bcc=clean_bcc,
                from_address=getattr(settings, "EMAIL_FROM_ADDRESS", "noreply@atlas.local"),
                from_name=getattr(settings, "EMAIL_FROM_NAME", "ATLAS Business Operations"),
            )

            provider_message_id = send_result.get("provider_message_id", "")
            provider_status = send_result.get("status", "accepted_by_provider")
            provider_name = send_result.get("provider", "provider")

            # 6. Record Audit Trail in PostgreSQL
            self._write_audit_log(
                audit_id=audit_id,
                user_id=user_id,
                username=username,
                recipient_email=recipient,
                recipient_name=request.recipient_name,
                subject=subject,
                purpose=request.purpose,
                record_type=request.record_type,
                record_id=request.record_id,
                status=provider_status,
                provider=provider_name,
                provider_message_id=provider_message_id,
                error_message=None,
                idempotency_key=idempotency_key,
            )

            # Security Audit Event
            log_security_event(
                action="EMAIL_SENT_SUCCESS",
                user_id=user_id,
                username=username,
                resource_type=request.record_type or "email",
                resource_id=request.record_id or audit_id,
                details={
                    "recipient": recipient,
                    "purpose": request.purpose,
                    "provider": provider_name,
                    "provider_message_id": provider_message_id,
                },
            )

            response = EmailSendResponse(
                success=True,
                status=provider_status,
                provider=provider_name,
                message_id=provider_message_id,
                recipient_email=recipient,
                subject=subject,
                sent_at=now.isoformat(),
                audit_id=audit_id,
                details=send_result.get("details"),
            )

            # Cache idempotency
            _IDEMPOTENCY_CACHE[idempotency_key] = (now, response.model_dump())
            return response

        except EmailProviderError as prov_err:
            error_str = str(prov_err)
            logger.error("Email send failed via provider: %s", error_str)

            # Record failed audit log
            self._write_audit_log(
                audit_id=audit_id,
                user_id=user_id,
                username=username,
                recipient_email=recipient,
                recipient_name=request.recipient_name,
                subject=subject,
                purpose=request.purpose,
                record_type=request.record_type,
                record_id=request.record_id,
                status="failed",
                provider=getattr(settings, "EMAIL_PROVIDER", "unknown"),
                provider_message_id=None,
                error_message=error_str,
                idempotency_key=idempotency_key,
            )

            log_security_event(
                action="EMAIL_SEND_FAILED",
                user_id=user_id,
                username=username,
                resource_type=request.record_type or "email",
                resource_id=request.record_id or audit_id,
                details={"recipient": recipient, "error": error_str},
            )
            raise ValueError(f"Failed to send email: {error_str}")

        except Exception as exc:
            error_str = str(exc)
            logger.error("Unexpected error sending email: %s", error_str, exc_info=True)

            self._write_audit_log(
                audit_id=audit_id,
                user_id=user_id,
                username=username,
                recipient_email=recipient,
                recipient_name=request.recipient_name,
                subject=subject,
                purpose=request.purpose,
                record_type=request.record_type,
                record_id=request.record_id,
                status="failed",
                provider="internal_error",
                provider_message_id=None,
                error_message=error_str,
                idempotency_key=idempotency_key,
            )
            raise ValueError(f"Email delivery error: {error_str}")

    def get_audit_logs(
        self,
        limit: int = 50,
        offset: int = 0,
        recipient: Optional[str] = None,
        record_id: Optional[str] = None,
    ) -> List[EmailAuditLogItem]:
        """Fetch email transmission audit records with filters."""
        with _get_connection() as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT id, user_id, username, recipient_email, recipient_name,
                           subject, purpose, record_type, record_id, status,
                           provider, provider_message_id, error_message, created_at
                    FROM email_audit_logs
                    WHERE 1=1
                """
                params: List[Any] = []
                if recipient:
                    query += " AND recipient_email ILIKE %s"
                    params.append(f"%{recipient}%")
                if record_id:
                    query += " AND record_id = %s"
                    params.append(record_id)

                query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])

                cur.execute(query, tuple(params))
                rows = cur.fetchall()

                items = []
                for r in rows:
                    dt = r[13]
                    items.append(
                        EmailAuditLogItem(
                            id=r[0],
                            user_id=r[1],
                            username=r[2],
                            recipient_email=r[3],
                            recipient_name=r[4],
                            subject=r[5],
                            purpose=r[6],
                            record_type=r[7],
                            record_id=r[8],
                            status=r[9],
                            provider=r[10],
                            provider_message_id=r[11],
                            error_message=r[12],
                            created_at=dt.isoformat() if isinstance(dt, datetime) else str(dt),
                        )
                    )
                return items

    def _resolve_business_context(
        self,
        request: EmailDraftRequest,
    ) -> Tuple[Dict[str, Any], Dict[str, str]]:
        """
        Query SAP / PostgreSQL to retrieve verified record figures, dates, and contacts.
        Never invents or hallucinates financial data.
        """
        b_context: Dict[str, Any] = {}
        contact: Dict[str, str] = {}

        # Merge any pre-supplied context data
        if request.context_data:
            for k, v in request.context_data.items():
                if v is not None:
                    b_context[k] = v

        # 1. Invoice lookup
        rec_type = (request.record_type or "").lower().strip()
        rec_id = (request.record_id or "").strip()

        if rec_type in ("invoice", "sales_invoice", "sales") or (rec_id and not rec_type):
            try:
                # Remove prefixes like INV-
                clean_id = rec_id
                if clean_id.upper().startswith("INV-"):
                    clean_id = clean_id[4:]

                details = self.finance_service.get_record_details("invoice", clean_id, "admin")
                doc_num = details.get("doc_num") or clean_id
                editable = details.get("editable_fields", {})
                locked = details.get("locked_fields", {})

                card_code = locked.get("CardCode", {}).get("current_value")
                card_name = locked.get("CardName", {}).get("current_value")
                doc_total = locked.get("DocTotal", {}).get("current_value")
                doc_due_date = locked.get("DocDueDate", {}).get("current_value")
                doc_date = locked.get("DocDate", {}).get("current_value")

                b_context["record_type"] = "Invoice"
                b_context["document_reference"] = f"INV-{doc_num}"
                b_context["invoice_number"] = doc_num
                if card_code: b_context["customer_code"] = card_code
                if card_name: b_context["customer_name"] = card_name
                if doc_total is not None:
                    try:
                        b_context["total_amount"] = f"₹{float(doc_total):,.2f}"
                        b_context["outstanding_amount"] = f"₹{float(doc_total):,.2f}"
                    except (ValueError, TypeError):
                        b_context["total_amount"] = str(doc_total)
                if doc_due_date: b_context["due_date"] = str(doc_due_date).split("T")[0]
                if doc_date: b_context["invoice_date"] = str(doc_date).split("T")[0]

                # Fetch customer BP for email if not found
                if card_code:
                    bp = self._lookup_bp(card_code)
                    if bp:
                        if bp.get("EmailAddress"):
                            contact["email"] = bp["EmailAddress"]
                        if bp.get("CardName"):
                            contact["name"] = bp["CardName"]

            except Exception as e:
                logger.debug("Invoice lookup skipped or failed for '%s': %s", rec_id, e)

        # 2. Customer lookup
        cust_code = request.customer_code or b_context.get("customer_code")
        if cust_code:
            bp = self._lookup_bp(cust_code)
            if bp:
                b_context["customer_code"] = bp.get("CardCode", cust_code)
                b_context["customer_name"] = bp.get("CardName", b_context.get("customer_name", "Valued Customer"))
                if bp.get("EmailAddress"):
                    contact["email"] = bp["EmailAddress"]
                if bp.get("CardName"):
                    contact["name"] = bp["CardName"]
                if bp.get("CurrentAccountBalance") is not None:
                    try:
                        bal = float(bp["CurrentAccountBalance"])
                        b_context["current_balance"] = f"₹{bal:,.2f}"
                    except Exception:
                        pass

        # 3. Supplier lookup
        supp_code = request.supplier_code or b_context.get("supplier_code")
        if supp_code:
            bp = self._lookup_bp(supp_code)
            if bp:
                b_context["supplier_code"] = bp.get("CardCode", supp_code)
                b_context["supplier_name"] = bp.get("CardName", b_context.get("supplier_name", "Supplier"))
                if bp.get("EmailAddress"):
                    contact["email"] = bp["EmailAddress"]
                if bp.get("CardName"):
                    contact["name"] = bp["CardName"]

        # 4. Sales Order lookup
        if rec_type in ("sales_order", "order") or request.record_type == "sales_order":
            try:
                orders = self.sales_orders_service.list_sales_orders(top=1, filters=[f"DocNum eq {rec_id}"])
                val = orders.get("value", [])
                if val:
                    so = val[0]
                    b_context["record_type"] = "Sales Order"
                    b_context["document_reference"] = f"SO-{so.get('DocNum')}"
                    b_context["order_number"] = so.get("DocNum")
                    if so.get("CardName"): b_context["customer_name"] = so.get("CardName")
                    if so.get("DocTotal") is not None:
                        b_context["total_amount"] = f"₹{float(so['DocTotal']):,.2f}"
                    if so.get("DocDueDate"):
                        b_context["delivery_date"] = str(so["DocDueDate"]).split("T")[0]
            except Exception as e:
                logger.debug("Sales order lookup skipped for '%s': %s", rec_id, e)

        # 5. Purchase Order lookup
        if rec_type in ("purchase_order", "po") or request.record_type == "purchase_order":
            try:
                po_list = self.purchase_orders_service.get_purchase_orders(limit=1, search=rec_id)
                if po_list:
                    po = po_list[0]
                    b_context["record_type"] = "Purchase Order"
                    b_context["document_reference"] = f"PO-{po.get('DocNum')}"
                    b_context["po_number"] = po.get("DocNum")
                    if po.get("CardName"): b_context["supplier_name"] = po.get("CardName")
                    if po.get("DocTotal") is not None:
                        b_context["total_amount"] = f"₹{float(po['DocTotal']):,.2f}"
            except Exception as e:
                logger.debug("Purchase order lookup skipped for '%s': %s", rec_id, e)

        return b_context, contact

    def _lookup_bp(self, card_code: str) -> Optional[Dict[str, Any]]:
        """Safely fetch Business Partner from SAP."""
        try:
            return self.bp_service.get_customer(card_code)
        except Exception:
            return None

    def _build_email_content(
        self,
        purpose: str,
        recipient_name: str,
        b_context: Dict[str, Any],
        prompt: Optional[str],
        additional_notes: Optional[str],
        current_user: Dict[str, Any],
    ) -> Tuple[str, str]:
        """Generate verified, professional subject line and body."""
        company_sig = getattr(
            settings,
            "COMPANY_SIGNATURE",
            "ATLAS Operations & Accounts Team\nATLAS Retail & Manufacturing",
        )
        sender_name = current_user.get("name") or "System Administrator"

        doc_ref = b_context.get("document_reference") or b_context.get("invoice_number") or ""
        total_amt = b_context.get("outstanding_amount") or b_context.get("total_amount") or ""
        due_date = b_context.get("due_date") or "as per terms"
        notes_clause = f"\n\nNote: {additional_notes.strip()}" if additional_notes and additional_notes.strip() else ""

        # ── 1. Payment Reminder / Overdue Payment ───────────────────────────────
        if purpose in ("payment_reminder", "overdue_payment"):
            is_overdue = purpose == "overdue_payment"
            tone_subj = "Urgent: Overdue Payment Notice" if is_overdue else "Payment Reminder"
            subject = f"{tone_subj} — Invoice {doc_ref}" if doc_ref else f"{tone_subj} — Statement of Account"

            body = (
                f"Dear {recipient_name},\n\n"
                f"I hope this message finds you well.\n\n"
            )

            if doc_ref and total_amt:
                body += (
                    f"This is a courteous reminder regarding Invoice {doc_ref}, which has an "
                    f"outstanding balance of {total_amt}, with a payment due date of {due_date}.\n\n"
                )
            elif doc_ref:
                body += (
                    f"This is a reminder regarding Invoice {doc_ref}, due on {due_date}. "
                    f"Kindly arrange for the clearance of the pending amount.\n\n"
                )
            else:
                body += (
                    f"We are writing to follow up on your account balance with our accounts team. "
                    f"Kindly review the attached statement and confirm the expected payment schedule.\n\n"
                )

            body += (
                f"Could you please confirm the expected payment date? If the payment has already been "
                f"processed, kindly share the bank transfer reference or receipt so we can update our records promptly.{notes_clause}\n\n"
                f"Thank you for your ongoing partnership and prompt cooperation.\n\n"
                f"Warm regards,\n\n"
                f"{sender_name}\n"
                f"{company_sig}"
            )

        # ── 2. Invoice Follow-up ────────────────────────────────────────────────
        elif purpose == "invoice_followup":
            subject = f"Invoice Details & Follow-up — {doc_ref}" if doc_ref else "Invoice Inquiry & Details"
            body = (
                f"Dear {recipient_name},\n\n"
                f"Please find the details regarding Invoice {doc_ref or 'your recent invoice'}.\n\n"
                f"- Document Reference: {doc_ref or 'Not specified'}\n"
                f"- Total Billed Amount: {total_amt or 'As per invoice'}\n"
                f"- Due Date: {due_date}\n\n"
                f"Should you require any itemized clarifications, tax invoice copies, or ledger reconciliation, "
                f"please feel free to reply directly to this email.{notes_clause}\n\n"
                f"Thank you for your business.\n\n"
                f"Best regards,\n\n"
                f"{sender_name}\n"
                f"{company_sig}"
            )

        # ── 3. Sales Order Update ───────────────────────────────────────────────
        elif purpose == "sales_order_update":
            subject = f"Order Status Update — {doc_ref}" if doc_ref else "Sales Order Update"
            body = (
                f"Dear {recipient_name},\n\n"
                f"We are writing to provide you with an update regarding your Sales Order {doc_ref or ''}.\n\n"
                f"- Order Reference: {doc_ref or 'Pending'}\n"
                f"- Total Value: {total_amt or 'Verified in system'}\n"
                f"- Scheduled Delivery: {b_context.get('delivery_date') or 'In progress'}\n\n"
                f"Our warehouse and logistics team is processing your order. You will receive notification "
                f"once the consignment has been dispatched.{notes_clause}\n\n"
                f"Thank you for choosing ATLAS.\n\n"
                f"Best regards,\n\n"
                f"{sender_name}\n"
                f"{company_sig}"
            )

        # ── 4. Purchase Order / Supplier Communication ─────────────────────────
        elif purpose in ("purchase_order", "supplier_communication"):
            supp_name = b_context.get("supplier_name") or recipient_name
            subject = f"Purchase Order Inquiry — {doc_ref}" if doc_ref else f"Operational Inquiry — {supp_name}"
            body = (
                f"Dear {supp_name},\n\n"
                f"We are following up regarding Purchase Order {doc_ref or 'our pending procurement order'}.\n\n"
                f"Could you please confirm the current fulfillment status, expected delivery schedule, "
                f"and dispatch tracking details for this order?{notes_clause}\n\n"
                f"Kindly ensure that all accompanying delivery challans and tax invoices reference our PO number.\n\n"
                f"Thank you for your prompt support.\n\n"
                f"Sincerely,\n\n"
                f"{sender_name}\n"
                f"{company_sig}"
            )

        # ── 5. Internal Finance Team Notice ─────────────────────────────────────
        elif purpose == "finance_team":
            subject = f"Finance Action Required: Payment Reconciliation — {doc_ref or 'Account Review'}"
            body = (
                f"Dear Finance & Accounts Team,\n\n"
                f"Please review the following account records requiring reconciliation:\n\n"
                f"- Account / Customer: {b_context.get('customer_name') or 'Not specified'} ({b_context.get('customer_code') or 'N/A'})\n"
                f"- Document Reference: {doc_ref or 'N/A'}\n"
                f"- Outstanding Balance: {total_amt or 'N/A'}\n"
                f"- Due Date: {due_date}\n\n"
                f"Issue Summary:\n"
                f"{additional_notes or prompt or 'Payment verification or invoice discrepancy requires investigation.'}\n\n"
                f"Please verify bank credits and advise on the appropriate adjustment or receipt entry.\n\n"
                f"Regards,\n\n"
                f"{sender_name}\n"
                f"ATLAS Operations"
            )

        # ── 6. Customer Support / General ───────────────────────────────────────
        else:
            subject = f"Business Communication — {doc_ref or 'ATLAS Operations'}"
            body = (
                f"Dear {recipient_name},\n\n"
                f"I hope you are having a productive day.\n\n"
                f"{additional_notes or prompt or 'We are reaching out with an operational update regarding your account.'}\n\n"
                f"Please do not hesitate to contact us if you have any questions or require additional support.\n\n"
                f"Best regards,\n\n"
                f"{sender_name}\n"
                f"{company_sig}"
            )

        return subject, body

    def _write_audit_log(
        self,
        audit_id: str,
        user_id: str,
        username: str,
        recipient_email: str,
        recipient_name: Optional[str],
        subject: str,
        purpose: str,
        record_type: Optional[str],
        record_id: Optional[str],
        status: str,
        provider: str,
        provider_message_id: Optional[str],
        error_message: Optional[str],
        idempotency_key: Optional[str],
    ) -> None:
        """Transactionally write an email audit log record to PostgreSQL."""
        try:
            with _get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO email_audit_logs (
                            id, user_id, username, recipient_email, recipient_name,
                            subject, purpose, record_type, record_id, status,
                            provider, provider_message_id, error_message, idempotency_key, created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            audit_id,
                            user_id,
                            username,
                            recipient_email,
                            recipient_name,
                            subject,
                            purpose,
                            record_type,
                            record_id,
                            status,
                            provider,
                            provider_message_id,
                            error_message,
                            idempotency_key,
                            datetime.utcnow(),
                        ),
                    )
        except Exception as exc:
            logger.error("Failed to write email audit log: %s", exc)

    def _check_db_idempotency(self, idempotency_key: str) -> bool:
        """Check if an email with this idempotency key was successfully sent in the past 60 seconds."""
        try:
            with _get_connection() as conn:
                with conn.cursor() as cur:
                    cutoff = datetime.utcnow() - timedelta(seconds=60)
                    cur.execute(
                        """
                        SELECT 1 FROM email_audit_logs
                        WHERE idempotency_key = %s
                          AND status IN ('accepted_by_provider', 'sent')
                          AND created_at >= %s
                        LIMIT 1
                        """,
                        (idempotency_key, cutoff),
                    )
                    return cur.fetchone() is not None
        except Exception as e:
            logger.debug("DB idempotency check skipped: %s", e)
            return False


# Global email service instance
email_service = EmailService()
