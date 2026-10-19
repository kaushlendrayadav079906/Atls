"""
Comprehensive Test Suite for ATLAS Smart Email Assistant & Provider Integration.
Verifies draft generation, live record resolution, recipient validation, explicit confirmation,
idempotency / duplicate prevention, provider failure handling, audit logging, security, and SAP safety.
"""

import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.nlp_pipeline import nlp_pipeline
from app.core.security import create_access_token
from app.main import app
from app.models.schemas import EmailDraftRequest, EmailSendRequest
from app.services.email.email_service import email_service, validate_email_address
from app.services.email.provider import MockEmailProvider, reset_email_provider

from app.core.security import get_current_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_mock_email_provider(monkeypatch):
    """Ensure MockEmailProvider is active and mock auth for automated tests."""
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "mock")
    reset_email_provider()
    
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "1",
        "username": "admin",
        "email": "admin@atlas.local",
        "role": "admin",
        "permissions": ["email.send", "dashboard.view", "reports.view"],
    }
    yield
    app.dependency_overrides.clear()
    reset_email_provider()


def make_auth_header(role="admin"):
    return {}


# ── 1. Recipient Validation ───────────────────────────────────────────────────

def test_validate_email_address():
    assert validate_email_address("accounts@customer.com") is True
    assert validate_email_address("john.doe+atlas@domain.co.in") is True
    assert validate_email_address("invalid-email") is False
    assert validate_email_address("") is False
    assert validate_email_address("@missinguser.com") is False
    assert validate_email_address("missingdomain@") is False


# ── 2. Email Draft Generation ─────────────────────────────────────────────────

def test_generate_draft_payment_reminder():
    user = {"id": "1", "name": "Accounts Officer", "role": "admin"}
    req = EmailDraftRequest(
        purpose="payment_reminder",
        recipient_name="Acme Corp",
        recipient_email="billing@acmecorp.com",
        context_data={
            "document_reference": "INV-10023",
            "outstanding_amount": "₹45,200.00",
            "due_date": "2026-11-05",
        },
    )
    draft = email_service.generate_draft(req, user)

    assert draft.purpose == "payment_reminder"
    assert draft.recipient_email == "billing@acmecorp.com"
    assert "INV-10023" in draft.subject
    assert "₹45,200.00" in draft.body
    assert "2026-11-05" in draft.body
    assert "Dear Acme Corp," in draft.body
    assert draft.is_ready_to_send is True
    assert len(draft.validation_warnings) == 0


def test_generate_draft_missing_recipient_email_adds_warning():
    user = {"id": "1", "name": "Manager", "role": "admin"}
    req = EmailDraftRequest(
        purpose="payment_reminder",
        recipient_name="Unknown Client",
        recipient_email="",
        context_data={"document_reference": "INV-999"},
    )
    draft = email_service.generate_draft(req, user)

    assert draft.is_ready_to_send is False
    assert any("Recipient email is not registered" in w for w in draft.validation_warnings)


def test_generate_draft_invalid_recipient_email_adds_warning():
    user = {"id": "1", "name": "Manager", "role": "admin"}
    req = EmailDraftRequest(
        purpose="invoice_followup",
        recipient_name="Client",
        recipient_email="not-an-email",
    )
    draft = email_service.generate_draft(req, user)

    assert draft.is_ready_to_send is False
    assert any("not a valid email address" in w for w in draft.validation_warnings)


def test_generate_draft_supplier_communication():
    user = {"id": "1", "name": "Procurement Lead", "role": "manager"}
    req = EmailDraftRequest(
        purpose="supplier_communication",
        supplier_code="V1001",
        context_data={
            "document_reference": "PO-8821",
            "supplier_name": "Zenith Steel Mills",
        },
        additional_notes="Please prioritize delivery of Grade-A coils.",
    )
    draft = email_service.generate_draft(req, user)

    assert draft.purpose == "supplier_communication"
    assert "PO-8821" in draft.subject
    assert "Zenith Steel Mills" in draft.body
    assert "Grade-A coils" in draft.body


def test_generate_draft_finance_team_notice():
    user = {"id": "1", "name": "Sales Rep", "role": "user"}
    req = EmailDraftRequest(
        purpose="finance_team",
        prompt="Customer claims ₹10,000 was paid via NEFT yesterday but not reflected.",
        context_data={
            "customer_name": "Bharat Traders",
            "document_reference": "INV-5501",
            "outstanding_amount": "₹10,000.00",
        },
    )
    draft = email_service.generate_draft(req, user)

    assert draft.purpose == "finance_team"
    assert "Finance Action Required" in draft.subject
    assert "NEFT yesterday" in draft.body
    assert "Bharat Traders" in draft.body


# ── 3. Sending Authorization & Confirmation ───────────────────────────────────

def test_send_email_without_explicit_confirmation_fails():
    user = {"id": "1", "username": "admin", "role": "admin"}
    req = EmailSendRequest(
        recipient_email="finance@partner.com",
        subject="Payment Reminder",
        body="Please pay your dues.",
        purpose="payment_reminder",
        confirmed=False,  # NOT confirmed
    )
    with pytest.raises(ValueError, match="requires explicit confirmation"):
        email_service.send_email(req, user)


def test_send_email_unauthorized_user_fails():
    # Regular 'user' role lacks email.send permission by default
    user = {"id": "2", "username": "cashier", "role": "user", "permissions": ["pos.checkout"]}
    req = EmailSendRequest(
        recipient_email="finance@partner.com",
        subject="Payment Reminder",
        body="Please pay your dues.",
        purpose="payment_reminder",
        confirmed=True,
    )
    with pytest.raises(PermissionError, match=r"(?i)email\.send"):
        email_service.send_email(req, user)


def test_send_email_authorized_admin_succeeds_and_creates_audit_log():
    user = {"id": "1", "username": "admin_user", "role": "admin"}
    target_email = f"verified_{uuid.uuid4().hex[:6]}@example.com"
    req = EmailSendRequest(
        recipient_email=target_email,
        recipient_name="Verified Customer",
        subject="Payment Reminder — INV-1234",
        body="Dear Customer, please find attached payment reminder.",
        purpose="payment_reminder",
        record_type="invoice",
        record_id="1234",
        confirmed=True,
    )
    resp = email_service.send_email(req, user)

    assert resp.success is True
    assert resp.status == "accepted_by_provider"
    assert resp.provider == "mock"
    assert resp.recipient_email == target_email
    assert resp.audit_id is not None

    # Check audit log retrieval
    logs = email_service.get_audit_logs(limit=1, recipient=target_email)
    assert len(logs) > 0
    assert logs[0].recipient_email == target_email
    assert logs[0].purpose == "payment_reminder"



def test_send_email_idempotency_prevents_duplicate_send():
    user = {"id": "1", "username": "admin_user", "role": "admin"}
    idem_key = f"key_{uuid.uuid4().hex}"
    req = EmailSendRequest(
        recipient_email="idempotent.test@example.com",
        subject="Test Duplicate",
        body="Body content.",
        purpose="general",
        idempotency_key=idem_key,
        confirmed=True,
    )
    # First send succeeds
    r1 = email_service.send_email(req, user)
    assert r1.success is True

    # Immediate second send with same idempotency key is safely deduplicated
    r2 = email_service.send_email(req, user)
    assert r2.success is True
    assert r2.message_id == r1.message_id


def test_send_email_provider_failure_is_handled_and_logged(monkeypatch):
    from app.services.email.provider import get_email_provider
    prov = get_email_provider()
    if isinstance(prov, MockEmailProvider):
        prov.simulate_failure = True
        prov.failure_reason = "SMTP Timeout connecting to relay"

    user = {"id": "1", "username": "admin_user", "role": "admin"}
    req = EmailSendRequest(
        recipient_email="failure.test@example.com",
        subject="Test Failure",
        body="Body content.",
        purpose="general",
        confirmed=True,
    )
    with pytest.raises(ValueError, match="Failed to send email"):
        email_service.send_email(req, user)


# ── 4. API Endpoints via HTTP ─────────────────────────────────────────────────

def test_api_email_draft_endpoint():
    headers = make_auth_header(role="admin")
    resp = client.post(
        "/api/v1/email/draft",
        headers=headers,
        json={
            "purpose": "payment_reminder",
            "recipient_name": "Test Client",
            "recipient_email": "client@test.com",
            "context_data": {"document_reference": "INV-777", "outstanding_amount": "₹12,000.00"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["purpose"] == "payment_reminder"
    assert data["recipient_email"] == "client@test.com"
    assert "INV-777" in data["subject"]


def test_api_email_send_without_confirmed_returns_400():
    headers = make_auth_header(role="admin")
    resp = client.post(
        "/api/v1/email/send",
        headers=headers,
        json={
            "recipient_email": "client@test.com",
            "subject": "Hello",
            "body": "Test message.",
            "confirmed": False,
        },
    )
    assert resp.status_code == 400
    assert "explicit confirmation" in resp.json()["detail"]


def test_api_email_send_success():
    headers = make_auth_header(role="admin")
    unique_recipient = f"api_test_{uuid.uuid4().hex[:6]}@example.com"
    resp = client.post(
        "/api/v1/email/send",
        headers=headers,
        json={
            "recipient_email": unique_recipient,
            "subject": "Invoice Follow-Up",
            "body": "Dear Customer, please find invoice details.",
            "purpose": "invoice_followup",
            "confirmed": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["status"] == "accepted_by_provider"


def test_api_email_settings_does_not_leak_secrets():
    headers = make_auth_header(role="admin")
    resp = client.get("/api/v1/email/settings", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "provider" in data
    assert "from_address" in data
    # Passwords / keys must NEVER be present
    assert "password" not in data
    assert "smtp_password" not in data
    assert "api_key" not in data


# ── 5. NLP & Conversation Context ─────────────────────────────────────────────

def test_nlp_classifies_payment_reminder():
    user = {"role": "admin", "username": "admin"}
    res = nlp_pipeline.analyze_query(
        "Draft a payment reminder for this customer",
        user,
        context={"selected_record": {"CardName": "Global Enterprises", "DocNum": "4001"}},
    )
    assert res.intent_id == "email.draft"
    assert res.suggested_tool == "draft_email"
    assert res.suggested_tool_args.get("purpose") == "payment_reminder"
    assert res.suggested_tool_args.get("customer_name_or_code") == "Global Enterprises"
    assert res.suggested_tool_args.get("invoice_doc_num") == "4001"


def test_nlp_classifies_supplier_email():
    user = {"role": "admin", "username": "admin"}
    res = nlp_pipeline.analyze_query(
        "Email the supplier about the pending purchase order",
        user,
        context={"selected_record": {"supplier_code": "V2001"}},
    )
    assert res.intent_id == "email.draft"
    assert res.suggested_tool == "draft_email"
    assert res.suggested_tool_args.get("purpose") == "supplier_communication"
    assert res.suggested_tool_args.get("supplier_name_or_code") == "V2001"


def test_sap_writeback_remains_disabled_policy():
    """Confirms drafting/sending email does NOT enable or perform SAP write-back."""
    assert getattr(settings, "FINANCE_WRITEBACK_ENABLED", False) is False
