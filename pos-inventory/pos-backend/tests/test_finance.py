"""Tests for Finance Overview API endpoints."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_dependencies():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers():
    token = create_access_token({"sub": "admin", "role": "admin", "branch_id": None})
    return {"Authorization": f"Bearer {token}"}

def test_finance_overview_requires_auth():
    response = client.get("/api/v1/finance/overview")
    assert response.status_code == 401

def test_finance_overview_success(auth_headers):
    mock_overview_data = {
        "period": {
            "range": "monthly",
            "from_date": "2026-10-01",
            "to_date": "2026-10-14",
            "label": "This Month"
        },
        "kpis": {
            "total_sales": {"value": 405180.0, "invoice_count": 25, "growth": 12.5, "is_positive": True},
            "total_purchases": {"value": 218460.0, "invoice_count": 18, "growth": 8.2, "is_positive": True},
            "incoming_payments": {"value": 362400.0, "payment_count": 24, "growth": 15.1, "is_positive": True},
            "outgoing_payments": {"value": 194700.0, "payment_count": 16, "growth": -3.6, "is_positive": False},
            "accounts_receivable": {"value": 123560.0, "subtext": "Outstanding from customers"},
            "accounts_payable": {"value": 86340.0, "subtext": "Outstanding to suppliers"},
            "gross_profit": {"value": 186720.0, "growth": 18.4, "is_positive": True},
            "gross_margin": {"value": 46.1, "growth": 4.8, "is_positive": True}
        },
        "charts": {
            "sales_vs_purchases": [
                {"period": "Nov", "sales": 220000, "purchases": 120000},
                {"period": "Dec", "sales": 290000, "purchases": 170000}
            ],
            "payments_trend": [
                {"period": "Nov", "incoming": 280000, "outgoing": 160000},
                {"period": "Dec", "incoming": 340000, "outgoing": 190000}
            ]
        },
        "tables": {
            "top_customers": [
                {"rank": 1, "customerName": "Rekha limited", "invoices": 8, "netSales": 112450.0, "percentage": 27.8}
            ],
            "top_suppliers": [
                {"rank": 1, "supplierName": "ABC Traders", "invoices": 5, "netPurchases": 86300.0, "percentage": 39.5}
            ],
            "recent_payments": {
                "incoming": [{"refNo": "RCT-101", "date": "2025-04-10", "customer": "Rekha limited", "amount": 50000}],
                "outgoing": [{"refNo": "PAY-001", "date": "2025-04-10", "supplier": "ABC Traders", "amount": 30000}]
            }
        },
        "meta": {"timestamp": "2026-10-14T00:00:00", "branch_id": "all", "is_cached": False}
    }

    with patch("app.api.v1.finance._finance_service.get_finance_overview", return_value=mock_overview_data):
        response = client.get("/api/v1/finance/overview?range=monthly", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "kpis" in data
        assert "charts" in data
        assert "tables" in data
        assert data["kpis"]["total_sales"]["value"] == 405180.0
        assert data["kpis"]["gross_margin"]["value"] == 46.1

def test_record_details_endpoint(auth_headers):
    mock_details = {
        "entity_type": "invoice",
        "record_id": "101",
        "doc_num": "101",
        "status": "Open",
        "can_edit": True,
        "editable_fields": {"Comments": {"label": "Invoice Remarks", "current_value": "Note"}},
        "locked_fields": {"DocTotal": {"reason": "Locked by SAP"}}
    }
    with patch("app.api.v1.finance._finance_service.get_record_details", return_value=mock_details):
        response = client.get("/api/v1/finance/record-details?entity_type=invoice&record_id=101", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["record_id"] == "101"
        assert data["can_edit"] is True
        assert "Comments" in data["editable_fields"]

def test_validate_update_endpoint(auth_headers):
    mock_val = {
        "is_valid": True,
        "errors": [],
        "diff": [{"field": "Comments", "old_value": "Old", "new_value": "New", "permitted": True}],
        "record_id": "101",
        "entity_type": "invoice"
    }
    with patch("app.api.v1.finance._finance_service.validate_record_update", return_value=mock_val):
        response = client.post(
            "/api/v1/finance/validate-update",
            json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["is_valid"] is True

def test_submit_update_blocked_by_safety_policy(auth_headers):
    """Verify that submit-update is strictly blocked by administrative safety policy by default."""
    response = client.post(
        "/api/v1/finance/submit-update",
        json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
        headers=auth_headers
    )
    assert response.status_code == 403
    assert "safety policy" in response.json()["detail"].lower()

def test_submit_update_requires_confirmation(auth_headers):
    with patch("app.api.v1.finance.settings.FINANCE_WRITEBACK_ENABLED", True):
        response = client.post(
            "/api/v1/finance/submit-update",
            json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": False},
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "Explicit user confirmation required" in response.json()["detail"]

def test_submit_update_forbidden_for_read_only_user():
    with patch("app.services.user_service.get_user_by_username", return_value={"id": 99, "username": "user1", "role": "user", "is_active": True, "token_version": 1, "permissions": []}):
        read_only_token = create_access_token({"sub": "user1", "role": "user", "branch_id": None})
        with patch("app.api.v1.finance.settings.FINANCE_WRITEBACK_ENABLED", True):
            response = client.post(
                "/api/v1/finance/submit-update",
                json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
                headers={"Authorization": f"Bearer {read_only_token}"}
            )
            assert response.status_code == 403

def test_submit_update_success(auth_headers):
    mock_result = {
        "success": True,
        "message": "Successfully updated invoice 101 in SAP Business One.",
        "diff": [{"field": "Comments", "old_value": "Old", "new_value": "New"}],
        "updated_record": {"Comments": "New"},
        "audit_id": "AUD-ABC12345",
        "timestamp": "2026-10-14T10:00:00Z"
    }
    with patch("app.api.v1.finance.settings.FINANCE_WRITEBACK_ENABLED", True):
        with patch("app.api.v1.finance._finance_service.submit_record_update", return_value=mock_result):
            response = client.post(
                "/api/v1/finance/submit-update",
                json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
                headers=auth_headers
            )
            assert response.status_code == 200
            assert response.json()["success"] is True
            assert response.json()["audit_id"] == "AUD-ABC12345"

def test_admin_settings_endpoint(auth_headers):
    mock_settings = {
        "assistant_mode": "FINANCE_INTELLIGENT_WORKSPACE",
        "sap_status": "connected",
        "enabled_capabilities": ["sales_revenue_analysis", "admin_controlled_sap_writeback"]
    }
    with patch("app.api.v1.finance._finance_service.get_admin_settings", return_value=mock_settings):
        response = client.get("/api/v1/finance/admin-settings", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["assistant_mode"] == "FINANCE_INTELLIGENT_WORKSPACE"

def test_admin_settings_forbidden_for_non_admin():
    with patch("app.services.user_service.get_user_by_username", return_value={"id": 98, "username": "mgr", "role": "manager", "is_active": True, "token_version": 1, "permissions": []}):
        manager_token = create_access_token({"sub": "mgr", "role": "manager", "branch_id": "SH"})
        response = client.get("/api/v1/finance/admin-settings", headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 403


def test_purchase_invoices_endpoint(auth_headers):
    mock_data = {
        "period": {"range": "all_time", "label": "All Dates (Total)"},
        "kpis": {"total_invoices": 2, "total_purchases": 2100.0, "total_paid": 2050.0, "total_outstanding_balance": 50.0},
        "total_count": 2,
        "page": 1,
        "page_size": 20,
        "total_pages": 1,
        "invoices": [
            {"doc_entry": 1, "doc_num": 1, "doc_date": "2023-10-13", "card_code": "VEN001", "card_name": "Amazon Ven", "doc_total": 1050.0, "paid_to_date": 1050.0, "balance_due": 0.0, "payment_status": "Paid"}
        ]
    }
    with patch("app.api.v1.finance._finance_service.get_purchase_invoices", return_value=mock_data):
        response = client.get("/api/v1/finance/purchase-invoices?range=all_time", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 2
        assert data["kpis"]["total_purchases"] == 2100.0
        assert len(data["invoices"]) == 1


def test_incoming_payments_endpoint(auth_headers):
    mock_data = {
        "period": {"range": "all_time", "label": "All Dates (Total)"},
        "kpis": {"total_incoming_amount": 2100.0, "transactions_count": 1, "average_payment": 2100.0},
        "total_count": 1,
        "page": 1,
        "page_size": 20,
        "total_pages": 1,
        "payments": [
            {"doc_entry": 1, "doc_num": 1, "amount": 2100.0, "method": "Bank Transfer", "customer_name": "Amazon"}
        ]
    }
    with patch("app.api.v1.finance._finance_service.get_incoming_payments", return_value=mock_data):
        response = client.get("/api/v1/finance/incoming-payments?range=all_time", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["kpis"]["total_incoming_amount"] == 2100.0
        assert len(data["payments"]) == 1


def test_outgoing_payments_endpoint(auth_headers):
    mock_data = {
        "period": {"range": "all_time", "label": "All Dates (Total)"},
        "kpis": {"total_outgoing_amount": 1000.0, "transactions_count": 1, "average_disbursement": 1000.0},
        "total_count": 1,
        "page": 1,
        "page_size": 20,
        "total_pages": 1,
        "payments": [
            {"doc_entry": 1, "doc_num": 1, "amount": 1000.0, "method": "Bank Transfer", "supplier_name": "HASAGREEN Ven"}
        ]
    }
    with patch("app.api.v1.finance._finance_service.get_outgoing_payments", return_value=mock_data):
        response = client.get("/api/v1/finance/outgoing-payments?range=all_time", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["kpis"]["total_outgoing_amount"] == 1000.0
        assert len(data["payments"]) == 1


def test_customer_analysis_endpoint(auth_headers):
    mock_data = {
        "period": {"range": "all_time", "label": "All Dates (Total)"},
        "kpis": {"total_customers": 5, "total_sales_revenue": 50000.0, "total_outstanding_receivables": 10000.0},
        "total_count": 5,
        "page": 1,
        "page_size": 20,
        "total_pages": 1,
        "customers": [
            {"customer_code": "CUS001", "customer_name": "Amazon", "sales_revenue": 25000.0, "invoices_count": 3}
        ]
    }
    with patch("app.api.v1.finance._finance_service.get_customer_analysis", return_value=mock_data):
        response = client.get("/api/v1/finance/customer-analysis?range=all_time", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["kpis"]["total_sales_revenue"] == 50000.0
        assert len(data["customers"]) == 1


def test_supplier_analysis_endpoint(auth_headers):
    mock_data = {
        "period": {"range": "all_time", "label": "All Dates (Total)"},
        "kpis": {"total_suppliers": 3, "total_purchase_spend": 30000.0, "total_outstanding_payables": 5000.0},
        "total_count": 3,
        "page": 1,
        "page_size": 20,
        "total_pages": 1,
        "suppliers": [
            {"supplier_code": "VEN001", "supplier_name": "Amazon Ven", "purchase_spend": 15000.0, "invoices_count": 2}
        ]
    }
    with patch("app.api.v1.finance._finance_service.get_supplier_analysis", return_value=mock_data):
        response = client.get("/api/v1/finance/supplier-analysis?range=all_time", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["kpis"]["total_purchase_spend"] == 30000.0
        assert len(data["suppliers"]) == 1


def test_profitability_reports_endpoint(auth_headers):
    mock_data = {
        "period": {"range": "all_time", "label": "All Dates (Total)"},
        "kpis": {
            "total_revenue": 50000.0,
            "cost_of_purchases": 30000.0,
            "gross_profit": 20000.0,
            "gross_margin": 40.0,
        },
        "monthly_breakdown": [
            {"month": "2023-10", "period": "Oct 2023", "sales": 20000.0, "purchases": 12000.0, "gross_profit": 8000.0, "gross_margin": 40.0}
        ],
        "accounting_note": "Accrual basis SAP calculation."
    }
    with patch("app.api.v1.finance._finance_service.get_profitability_report", return_value=mock_data):
        response = client.get("/api/v1/finance/profitability-reports?range=all_time", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["kpis"]["gross_profit"] == 20000.0
        assert data["kpis"]["gross_margin"] == 40.0


def test_export_finance_endpoint(auth_headers):
    mock_csv = "DocEntry,Invoice No,Total\n1,1,1050.0"
    with patch("app.api.v1.finance._finance_service.export_finance_csv", return_value=mock_csv):
        response = client.get("/api/v1/finance/export?module=purchase_invoices&range=all_time", headers=auth_headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        assert "Invoice No" in response.text


# ============================================================================
# REGRESSION TESTS — Dual-Contract Shapes & SAP Error Propagation
# ============================================================================

def test_purchase_invoices_dual_contract_and_kpis(auth_headers):
    """Verify backend returns both summary & kpis, and items & invoices with correct totals."""
    mock_dual_data = {
        "summary": {
            "total_invoices": 10,
            "total_purchases": 54200.0,
            "total_paid": 40000.0,
            "total_outstanding_balance": 14200.0,
            "currency": "INR",
            "status_counts": {"open": 4, "closed": 6, "paid": 6, "partially_paid": 2, "unpaid": 2, "cancelled": 0}
        },
        "kpis": {
            "total_invoices": 10,
            "total_purchases": 54200.0,
            "total_paid": 40000.0,
            "total_outstanding_balance": 14200.0,
            "currency": "INR",
            "status_counts": {"open": 4, "closed": 6, "paid": 6, "partially_paid": 2, "unpaid": 2, "cancelled": 0}
        },
        "items": [
            {
                "doc_entry": 101,
                "doc_num": 101,
                "doc_date": "2026-03-01",
                "doc_due_date": "2026-03-31",
                "card_code": "V100",
                "card_name": "Acme Supplier",
                "doc_total": 5420.0,
                "paid_to_date": 5420.0,
                "balance_due": 0.0,
                "doc_status": "bost_Close",
                "cancelled": "tNO",
                "payment_status": "Paid",
                "currency": "INR",
                "branch_id": 1,
                "comments": "Stock purchase"
            }
        ],
        "invoices": [
            {
                "doc_entry": 101,
                "doc_num": 101,
                "doc_date": "2026-03-01",
                "doc_due_date": "2026-03-31",
                "card_code": "V100",
                "card_name": "Acme Supplier",
                "doc_total": 5420.0,
                "paid_to_date": 5420.0,
                "balance_due": 0.0,
                "doc_status": "bost_Close",
                "cancelled": "tNO",
                "payment_status": "Paid",
                "currency": "INR",
                "branch_id": 1,
                "comments": "Stock purchase"
            }
        ],
        "purchase_invoices": [
            {
                "doc_entry": 101,
                "doc_num": 101,
                "doc_date": "2026-03-01",
                "doc_due_date": "2026-03-31",
                "card_code": "V100",
                "card_name": "Acme Supplier",
                "doc_total": 5420.0,
                "paid_to_date": 5420.0,
                "balance_due": 0.0,
                "doc_status": "bost_Close",
                "cancelled": "tNO",
                "payment_status": "Paid",
                "currency": "INR",
                "branch_id": 1,
                "comments": "Stock purchase"
            }
        ],
        "total_count": 10,
        "page": 1,
        "page_size": 20,
        "has_more": False,
        "filters_applied": {"range": "all_time"}
    }
    with patch("app.api.v1.finance._finance_service.get_purchase_invoices", return_value=mock_dual_data):
        res = client.get("/api/v1/finance/purchase-invoices?range=all_time", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        # Verify root cause fix: BOTH summary and kpis exist with non-zero values
        assert body["summary"]["total_invoices"] == 10
        assert body["summary"]["total_purchases"] == 54200.0
        assert body["summary"]["total_paid"] == 40000.0
        assert body["summary"]["total_outstanding_balance"] == 14200.0
        assert body["kpis"]["total_invoices"] == 10
        # Verify root cause fix: BOTH items and invoices exist with valid rows
        assert len(body["items"]) == 1
        assert len(body["invoices"]) == 1
        assert body["items"][0]["doc_num"] == 101
        assert body["items"][0]["doc_total"] == 5420.0
        assert body["total_count"] == 10


def test_incoming_payments_dual_contract(auth_headers):
    mock_data = {
        "summary": {
            "total_receipts_count": 11,
            "total_received_amount": 85000.0,
            "currency": "INR",
            "method_breakdown": {"bank_transfer": 60000.0, "cash": 25000.0, "other": 0.0}
        },
        "kpis": {
            "total_receipts_count": 11,
            "total_received_amount": 85000.0,
            "total_incoming_amount": 85000.0,
            "transactions_count": 11,
            "currency": "INR",
            "method_breakdown": {"bank_transfer": 60000.0, "cash": 25000.0, "other": 0.0}
        },
        "items": [
            {
                "doc_entry": 201,
                "doc_num": 201,
                "doc_date": "2026-03-05",
                "card_code": "C200",
                "card_name": "Retail Customer",
                "doc_currency": "INR",
                "cash_sum": 0.0,
                "transfer_sum": 15000.0,
                "total_amount": 15000.0,
                "amount": 15000.0,
                "payment_method": "Bank Transfer",
                "method": "Bank Transfer",
                "branch_id": 1,
                "applied_invoices_count": 1,
                "applied_invoices": []
            }
        ],
        "payments": [
            {
                "doc_entry": 201,
                "doc_num": 201,
                "doc_date": "2026-03-05",
                "card_code": "C200",
                "card_name": "Retail Customer",
                "doc_currency": "INR",
                "cash_sum": 0.0,
                "transfer_sum": 15000.0,
                "total_amount": 15000.0,
                "amount": 15000.0,
                "payment_method": "Bank Transfer",
                "method": "Bank Transfer",
                "branch_id": 1,
                "applied_invoices_count": 1,
                "applied_invoices": []
            }
        ],
        "total_count": 11,
        "page": 1,
        "page_size": 20,
        "has_more": False,
        "filters_applied": {"range": "all_time"}
    }
    with patch("app.api.v1.finance._finance_service.get_incoming_payments", return_value=mock_data):
        res = client.get("/api/v1/finance/incoming-payments?range=all_time", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["summary"]["total_receipts_count"] == 11
        assert body["summary"]["total_received_amount"] == 85000.0
        assert body["summary"]["method_breakdown"]["bank_transfer"] == 60000.0
        assert len(body["items"]) == 1
        assert body["items"][0]["total_amount"] == 15000.0
        assert body["total_count"] == 11


def test_outgoing_payments_dual_contract(auth_headers):
    mock_data = {
        "summary": {
            "total_vouchers_count": 7,
            "total_disbursed_amount": 42000.0,
            "currency": "INR",
            "method_breakdown": {"bank_transfer": 32000.0, "cash": 10000.0, "other": 0.0}
        },
        "kpis": {
            "total_vouchers_count": 7,
            "total_disbursed_amount": 42000.0,
            "total_outgoing_amount": 42000.0,
            "transactions_count": 7,
            "currency": "INR",
            "method_breakdown": {"bank_transfer": 32000.0, "cash": 10000.0, "other": 0.0}
        },
        "items": [
            {
                "doc_entry": 301,
                "doc_num": 301,
                "doc_date": "2026-03-08",
                "card_code": "V300",
                "card_name": "Green Mills",
                "doc_currency": "INR",
                "cash_sum": 0.0,
                "transfer_sum": 12000.0,
                "total_amount": 12000.0,
                "payment_method": "Bank Transfer",
                "branch_id": 1,
                "applied_purchase_invoices_count": 1,
                "applied_invoices": []
            }
        ],
        "payments": [
            {
                "doc_entry": 301,
                "doc_num": 301,
                "doc_date": "2026-03-08",
                "card_code": "V300",
                "card_name": "Green Mills",
                "doc_currency": "INR",
                "cash_sum": 0.0,
                "transfer_sum": 12000.0,
                "total_amount": 12000.0,
                "payment_method": "Bank Transfer",
                "branch_id": 1,
                "applied_purchase_invoices_count": 1,
                "applied_invoices": []
            }
        ],
        "total_count": 7,
        "page": 1,
        "page_size": 20,
        "has_more": False,
        "filters_applied": {"range": "all_time"}
    }
    with patch("app.api.v1.finance._finance_service.get_outgoing_payments", return_value=mock_data):
        res = client.get("/api/v1/finance/outgoing-payments?range=all_time", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["summary"]["total_vouchers_count"] == 7
        assert body["summary"]["total_disbursed_amount"] == 42000.0
        assert len(body["items"]) == 1
        assert body["total_count"] == 7


def test_customer_analysis_dual_contract(auth_headers):
    mock_data = {
        "summary": {
            "total_customers_analyzed": 5,
            "total_sales_revenue": 150000.0,
            "total_outstanding_receivables": 25000.0,
            "currency": "INR"
        },
        "kpis": {
            "total_customers_analyzed": 5,
            "total_sales_revenue": 150000.0,
            "total_outstanding_receivables": 25000.0,
            "currency": "INR"
        },
        "items": [
            {
                "card_code": "C1",
                "card_name": "Customer 1",
                "sales_revenue": 60000.0,
                "invoice_count": 3,
                "payments_received": 50000.0,
                "outstanding_receivables": 10000.0,
                "last_transaction_date": "2026-03-10",
                "sales_share_pct": 40.0,
                "currency": "INR"
            }
        ],
        "customers": [
            {
                "card_code": "C1",
                "card_name": "Customer 1",
                "sales_revenue": 60000.0,
                "invoice_count": 3,
                "payments_received": 50000.0,
                "outstanding_receivables": 10000.0,
                "last_transaction_date": "2026-03-10",
                "sales_share_pct": 40.0,
                "currency": "INR"
            }
        ],
        "total_count": 5,
        "page": 1,
        "page_size": 20,
        "has_more": False,
        "filters_applied": {"range": "all_time"}
    }
    with patch("app.api.v1.finance._finance_service.get_customer_analysis", return_value=mock_data):
        res = client.get("/api/v1/finance/customer-analysis?range=all_time", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["summary"]["total_customers_analyzed"] == 5
        assert body["summary"]["total_sales_revenue"] == 150000.0
        assert len(body["items"]) == 1
        assert body["items"][0]["card_code"] == "C1"


def test_supplier_analysis_dual_contract(auth_headers):
    mock_data = {
        "summary": {
            "total_suppliers_analyzed": 4,
            "total_purchase_spend": 80000.0,
            "total_outstanding_payables": 15000.0,
            "currency": "INR"
        },
        "kpis": {
            "total_suppliers_analyzed": 4,
            "total_purchase_spend": 80000.0,
            "total_outstanding_payables": 15000.0,
            "currency": "INR"
        },
        "items": [
            {
                "card_code": "S1",
                "card_name": "Supplier 1",
                "purchase_spend": 40000.0,
                "invoice_count": 2,
                "disbursements": 30000.0,
                "outstanding_payables": 10000.0,
                "last_purchase_date": "2026-03-12",
                "spend_share_pct": 50.0,
                "currency": "INR"
            }
        ],
        "suppliers": [
            {
                "card_code": "S1",
                "card_name": "Supplier 1",
                "purchase_spend": 40000.0,
                "invoice_count": 2,
                "disbursements": 30000.0,
                "outstanding_payables": 10000.0,
                "last_purchase_date": "2026-03-12",
                "spend_share_pct": 50.0,
                "currency": "INR"
            }
        ],
        "total_count": 4,
        "page": 1,
        "page_size": 20,
        "has_more": False,
        "filters_applied": {"range": "all_time"}
    }
    with patch("app.api.v1.finance._finance_service.get_supplier_analysis", return_value=mock_data):
        res = client.get("/api/v1/finance/supplier-analysis?range=all_time", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["summary"]["total_suppliers_analyzed"] == 4
        assert body["summary"]["total_purchase_spend"] == 80000.0
        assert len(body["items"]) == 1
        assert body["items"][0]["card_code"] == "S1"


def test_profitability_reports_dual_contract(auth_headers):
    mock_data = {
        "summary": {
            "net_sales_revenue": 150000.0,
            "procurement_cogs_basis": 80000.0,
            "gross_profit": 70000.0,
            "gross_margin_pct": 46.67,
            "sales_invoice_count": 10,
            "purchase_invoice_count": 6,
            "currency": "INR",
            "accounting_note": "Accrual basis SAP calculation."
        },
        "kpis": {
            "net_sales_revenue": 150000.0,
            "procurement_cogs_basis": 80000.0,
            "gross_profit": 70000.0,
            "gross_margin_pct": 46.67,
            "total_revenue": 150000.0,
            "cost_of_purchases": 80000.0,
            "gross_margin": 46.67,
            "sales_invoice_count": 10,
            "purchase_invoice_count": 6,
            "currency": "INR",
            "accounting_note": "Accrual basis SAP calculation."
        },
        "monthly_breakdown": [
            {
                "period": "2026-03",
                "month": "2026-03",
                "revenue": 150000.0,
                "sales": 150000.0,
                "cost": 80000.0,
                "purchases": 80000.0,
                "gross_profit": 70000.0,
                "margin_pct": 46.67,
                "gross_margin": 46.67
            }
        ],
        "breakdown": [
            {
                "period": "2026-03",
                "month": "2026-03",
                "revenue": 150000.0,
                "sales": 150000.0,
                "cost": 80000.0,
                "purchases": 80000.0,
                "gross_profit": 70000.0,
                "margin_pct": 46.67,
                "gross_margin": 46.67
            }
        ],
        "date_scope": {"range": "all_time", "from_date": "", "to_date": ""},
        "filters_applied": {"range": "all_time"}
    }
    with patch("app.api.v1.finance._finance_service.get_profitability_report", return_value=mock_data):
        res = client.get("/api/v1/finance/profitability-reports?range=all_time", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["summary"]["net_sales_revenue"] == 150000.0
        assert body["summary"]["gross_profit"] == 70000.0
        assert len(body["monthly_breakdown"]) == 1
        assert body["monthly_breakdown"][0]["revenue"] == 150000.0


def test_sap_connection_error_returns_502(auth_headers):
    """Ensure SAP connection failure returns HTTP 502 with diagnostic detail, NOT silently masking to 0."""
    from app.services.sap.client import SAPConnectionError
    with patch("app.api.v1.finance._finance_service.get_purchase_invoices", side_effect=SAPConnectionError("Connection timed out")):
        res = client.get("/api/v1/finance/purchase-invoices?range=all_time", headers=auth_headers)
        assert res.status_code == 502
        assert "Service Layer connection failed" in res.json()["detail"]


def test_sap_validation_error_returns_400(auth_headers):
    """Ensure SAP validation failure returns HTTP 400 with diagnostic detail."""
    from app.services.sap.client import SAPValidationError
    with patch("app.api.v1.finance._finance_service.get_purchase_invoices", side_effect=SAPValidationError("Invalid OData query")):
        res = client.get("/api/v1/finance/purchase-invoices?range=all_time", headers=auth_headers)
        assert res.status_code == 400
        assert "Service Layer query validation failed" in res.json()["detail"]


# ============================================================================
# REGRESSION TESTS — SAPFinanceService Calculation & Filter Logic
# ============================================================================

def test_finance_service_purchase_invoices_aggregation():
    from app.services.sap.finance_service import SAPFinanceService
    service = SAPFinanceService()

    raw_sap_invoices = [
        {
            "DocEntry": 1,
            "DocNum": 1001,
            "DocDate": "2026-03-01",
            "DocDueDate": "2026-03-31",
            "CardCode": "V001",
            "CardName": "Acme Tools",
            "DocTotal": 10000.0,
            "PaidToDate": 10000.0,
            "DocStatus": "bost_Close",
            "Cancelled": "tNO",
            "DocCurrency": "INR",
            "BPL_IDAssignedToInvoice": 1,
            "Comments": "Tools delivery"
        },
        {
            "DocEntry": 2,
            "DocNum": 1002,
            "DocDate": "2026-03-02",
            "DocDueDate": "2026-04-01",
            "CardCode": "V002",
            "CardName": "Beta Hardware",
            "DocTotal": 5000.0,
            "PaidToDate": 2000.0,
            "DocStatus": "bost_Open",
            "Cancelled": "tNO",
            "DocCurrency": "INR",
            "BPL_IDAssignedToInvoice": 2,
            "Comments": "Paints delivery"
        },
        {
            "DocEntry": 3,
            "DocNum": 1003,
            "DocDate": "2026-03-03",
            "DocDueDate": "2026-04-02",
            "CardCode": "V003",
            "CardName": "Gamma Supplies",
            "DocTotal": 3000.0,
            "PaidToDate": 0.0,
            "DocStatus": "bost_Open",
            "Cancelled": "tYES",
            "DocCurrency": "INR",
            "BPL_IDAssignedToInvoice": 1,
            "Comments": "Cancelled invoice"
        }
    ]

    with patch.object(service, "_fetch_all_sap_records", return_value=raw_sap_invoices):
        result = service.get_purchase_invoices(range_str="all_time", page=1, page_size=10)

        # Total non-cancelled invoices = 2 (1001 and 1002). 1003 is Cancelled and filtered out.
        assert result["total_count"] == 2
        assert result["summary"]["total_purchases"] == 15000.0  # 10000 + 5000 (excludes cancelled)
        assert result["summary"]["total_paid"] == 12000.0  # 10000 + 2000
        assert result["summary"]["total_outstanding_balance"] == 3000.0  # 5000 - 2000
        assert result["summary"]["status_counts"]["paid"] == 1
        assert result["summary"]["status_counts"]["partially_paid"] == 1

        # Check dual-contract output
        assert "items" in result
        assert "invoices" in result
        assert "summary" in result
        assert "kpis" in result
        assert len(result["items"]) == 2

        # Test branch filter
        branch_1_result = service.get_purchase_invoices(range_str="all_time", branch_id="1")
        assert branch_1_result["total_count"] == 1  # entry 1 has BPL=1 (entry 3 cancelled)
        assert branch_1_result["summary"]["total_purchases"] == 10000.0

        # Test status filter
        paid_result = service.get_purchase_invoices(range_str="all_time", status="Paid")
        assert paid_result["total_count"] == 1
        assert paid_result["items"][0]["doc_num"] == 1001


def test_finance_service_incoming_payments_aggregation():
    from app.services.sap.finance_service import SAPFinanceService
    service = SAPFinanceService()

    raw_payments = [
        {
            "DocEntry": 10,
            "DocNum": 5001,
            "DocDate": "2026-03-01",
            "CardCode": "C001",
            "CardName": "Customer A",
            "DocCurrency": "INR",
            "CashSum": 5000.0,
            "TransferSum": 0.0,
            "BPLID": 1,
            "Cancelled": "tNO",
            "PaymentInvoices": [{"DocEntry": 100, "SumApplied": 5000.0, "InvoiceType": "it_Invoice"}]
        },
        {
            "DocEntry": 11,
            "DocNum": 5002,
            "DocDate": "2026-03-02",
            "CardCode": "C002",
            "CardName": "Customer B",
            "DocCurrency": "INR",
            "CashSum": 0.0,
            "TransferSum": 15000.0,
            "BPLID": 1,
            "Cancelled": "tNO",
            "PaymentInvoices": []
        }
    ]

    with patch.object(service, "_fetch_all_sap_records", return_value=raw_payments):
        result = service.get_incoming_payments(range_str="all_time")
        assert result["total_count"] == 2
        assert result["summary"]["total_receipts_count"] == 2
        assert result["summary"]["total_received_amount"] == 20000.0
        assert result["summary"]["method_breakdown"]["cash"] == 5000.0
        assert result["summary"]["method_breakdown"]["bank_transfer"] == 15000.0
        item_a = next(i for i in result["items"] if i["doc_entry"] == 10)
        assert item_a["applied_invoices_count"] == 1


def test_finance_service_sales_metrics_excludes_cancelled():
    from app.services.sap.finance_service import SAPFinanceService
    from datetime import date
    service = SAPFinanceService()

    raw_invoices = [
        {"DocEntry": 1, "DocNum": 101, "DocTotal": 81798.88, "Cancelled": "tNO"},
        {"DocEntry": 21, "DocNum": 8, "DocTotal": 10.50, "Cancelled": "tYES"},
    ]

    with patch.object(service.invoices_service, "get_invoices_by_date", return_value=raw_invoices):
        metrics = service._get_sales_metrics(
            d_from=date(2026, 1, 1),
            d_to=date(2026, 12, 31),
            prev_from=date(2025, 1, 1),
            prev_to=date(2025, 12, 31),
            branch_id=None,
            is_all_time=True,
        )
        # Cancelled invoice (10.50) MUST be excluded from revenue and count
        assert metrics["total_sales"] == 81798.88
        assert metrics["invoice_count"] == 1


def test_finance_service_purchase_invoices_cancelled_filter():
    from app.services.sap.finance_service import SAPFinanceService
    service = SAPFinanceService()

    raw_pinvs = [
        {
            "DocEntry": 101,
            "DocNum": 101,
            "DocDate": "2026-03-01",
            "DocDueDate": "2026-03-15",
            "CardCode": "S001",
            "CardName": "Active Supplier",
            "DocTotal": 5000.0,
            "PaidToDate": 0.0,
            "DocumentStatus": "bost_Open",
            "DocCurrency": "INR",
            "Cancelled": "tNO",
            "BPL_IDAssignedToInvoice": 1,
            "BPLName": "Main Branch",
        },
        {
            "DocEntry": 102,
            "DocNum": 102,
            "DocDate": "2026-03-02",
            "DocDueDate": "2026-03-16",
            "CardCode": "S002",
            "CardName": "Void Supplier",
            "DocTotal": 2000.0,
            "PaidToDate": 0.0,
            "DocumentStatus": "bost_Close",
            "DocCurrency": "INR",
            "Cancelled": "tYES",
            "BPL_IDAssignedToInvoice": 1,
            "BPLName": "Main Branch",
        },
    ]

    with patch.object(service, "_fetch_all_sap_records", return_value=raw_pinvs):
        # Default view excludes cancelled
        res_default = service.get_purchase_invoices(range_str="all_time")
        assert res_default["total_count"] == 1
        assert res_default["items"][0]["doc_entry"] == 101
        assert res_default["summary"]["total_purchases"] == 5000.0

        # Status filter for cancelled returns the cancelled invoices
        res_cancelled = service.get_purchase_invoices(range_str="all_time", status="Cancelled")
        assert res_cancelled["total_count"] == 1
        assert res_cancelled["items"][0]["doc_entry"] == 102
        assert res_cancelled["items"][0]["payment_status"] == "Cancelled"


def test_purchase_invoices_pagination_ten_per_page():
    from app.services.sap.finance_service import SAPFinanceService
    service = SAPFinanceService()

    # Generate 47 mock invoices to test the exact scenario described in requirements
    raw_invoices = [
        {
            "DocEntry": i,
            "DocNum": 1000 + i,
            "DocDate": f"2026-03-{(i % 28) + 1:02d}",
            "DocDueDate": "2026-04-15",
            "CardCode": f"V{i:03d}",
            "CardName": f"Supplier {i}",
            "DocTotal": 100.0 * i,
            "PaidToDate": 50.0 * i,
            "DocumentStatus": "bost_Open",
            "DocCurrency": "INR",
            "Cancelled": "tNO",
            "BPL_IDAssignedToInvoice": 1,
            "BPLName": "Main Branch",
        }
        for i in range(1, 48)
    ]

    with patch.object(service, "_fetch_all_sap_records", return_value=raw_invoices):
        # Page 1: Default page_size should be 10
        p1 = service.get_purchase_invoices(range_str="all_time", page=1)
        assert p1["page_size"] == 10
        assert p1["page"] == 1
        assert p1["total_count"] == 47
        assert p1["total_pages"] == 5
        assert p1["has_more"] is True
        assert len(p1["items"]) == 10

        # Page 2: Next 10 items
        p2 = service.get_purchase_invoices(range_str="all_time", page=2)
        assert p2["page"] == 2
        assert p2["page_size"] == 10
        assert len(p2["items"]) == 10
        assert p2["has_more"] is True

        # Page 5: Last page should contain remaining 7 items
        p5 = service.get_purchase_invoices(range_str="all_time", page=5)
        assert p5["page"] == 5
        assert len(p5["items"]) == 7
        assert p5["has_more"] is False

        # Summary KPIs reflect entire 47 invoices, not just single page
        expected_total_purchases = sum(inv["DocTotal"] for inv in raw_invoices)
        assert p1["summary"]["total_purchases"] == round(expected_total_purchases, 2)
        assert p2["summary"]["total_purchases"] == round(expected_total_purchases, 2)


def test_fetch_all_sap_records_follows_next_link():
    from app.services.sap.finance_service import SAPFinanceService
    service = SAPFinanceService()

    page1_response = {
        "value": [{"DocEntry": 1}, {"DocEntry": 2}],
        "@odata.nextLink": "PurchaseInvoices?$skip=2&$top=2",
    }
    page2_response = {
        "value": [{"DocEntry": 3}],
        "@odata.nextLink": None,
    }

    with patch.object(service.client, "get", side_effect=[page1_response, page2_response]):
        records = service._fetch_all_sap_records("PurchaseInvoices", {})
        assert len(records) == 3
        assert [r["DocEntry"] for r in records] == [1, 2, 3]


def test_incoming_payments_pagination_ten_per_page():
    from app.services.sap.finance_service import SAPFinanceService
    service = SAPFinanceService()

    raw_payments = [
        {
            "DocEntry": i,
            "DocNum": 1000 + i,
            "DocDate": f"2026-03-{(i % 28) + 1:02d}",
            "CardCode": f"C{i:03d}",
            "CardName": f"Customer {i}",
            "CashSum": 100.0,
            "TransferSum": 400.0,
            "Cancelled": "tNO",
            "PaymentInvoices": [],
        }
        for i in range(1, 26)
    ]

    with patch.object(service, "_fetch_all_sap_records", return_value=raw_payments):
        p1 = service.get_incoming_payments(range_str="all_time", page=1, page_size=10)
        assert p1["total_count"] == 25
        assert p1["total_pages"] == 3
        assert p1["page"] == 1
        assert p1["page_size"] == 10
        assert len(p1["items"]) == 10
        assert p1["has_more"] is True

        p3 = service.get_incoming_payments(range_str="all_time", page=3, page_size=10)
        assert len(p3["items"]) == 5
        assert p3["has_more"] is False
        assert p3["summary"]["total_receipts_count"] == 25


def test_outgoing_payments_pagination_ten_per_page():
    from app.services.sap.finance_service import SAPFinanceService
    service = SAPFinanceService()

    raw_payments = [
        {
            "DocEntry": i,
            "DocNum": 2000 + i,
            "DocDate": f"2026-03-{(i % 28) + 1:02d}",
            "CardCode": f"V{i:03d}",
            "CardName": f"Vendor {i}",
            "CashSum": 200.0,
            "TransferSum": 800.0,
            "Cancelled": "tNO",
            "PaymentInvoices": [],
        }
        for i in range(1, 22)
    ]

    with patch.object(service, "_fetch_all_sap_records", return_value=raw_payments):
        p1 = service.get_outgoing_payments(range_str="all_time", page=1, page_size=10)
        assert p1["total_count"] == 21
        assert p1["total_pages"] == 3
        assert p1["page"] == 1
        assert p1["page_size"] == 10
        assert len(p1["items"]) == 10
        assert p1["has_more"] is True

        p3 = service.get_outgoing_payments(range_str="all_time", page=3, page_size=10)
        assert len(p3["items"]) == 1
        assert p3["has_more"] is False
        assert p3["summary"]["total_vouchers_count"] == 21







