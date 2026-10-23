"""Unit and integration tests for Payment Report endpoints and SAP integration."""

from datetime import date, datetime
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
from app.services.sap.payments_report_service import (
    SAPPaymentsReportService,
    _format_date,
    _to_float,
    clear_payments_report_cache,
)


from app.core.circuit_breaker import sap_breaker, CircuitState


MOCK_ENDPOINT_PAYMENTS = [
    {
        "DocEntry": 11,
        "DocNum": 11,
        "DocDate": "2026-07-04T00:00:00Z",
        "DocTime": "10:30",
        "CardCode": "CUS011",
        "CardName": "AMIK KR",
        "BPLID": 3,
        "BPLName": "GZB",
        "Cancelled": "tNO",
        "DocCurrency": "INR",
        "_TotalAmount": 1200.0,
        "_PaymentMethod": "transfer",
        "_Status": "Success",
        "_InvoiceDocNum": "2",
        "_InvoiceAmount": 1200.0,
        "_LinkedInvoices": [
            {"docEntry": 53, "docNum": 2, "invoiceDate": "2026-07-04", "invoiceTotal": 1200.0, "sumApplied": 1200.0, "invoiceStatus": "bost_Close"}
        ],
    },
    {
        "DocEntry": 12,
        "DocNum": 12,
        "DocDate": "2026-07-05T00:00:00Z",
        "DocTime": "14:15",
        "CardCode": "CUS001",
        "CardName": "Amazon",
        "BPLID": 3,
        "BPLName": "GZB",
        "Cancelled": "tNO",
        "DocCurrency": "INR",
        "_TotalAmount": 150.0,
        "_PaymentMethod": "cash",
        "_Status": "Success",
        "_InvoiceDocNum": "On Account",
        "_InvoiceAmount": 0.0,
        "_LinkedInvoices": [],
    }
]


@pytest.fixture(autouse=True)
def reset_breaker_and_mock_service():
    clear_payments_report_cache()
    with sap_breaker._lock:
        sap_breaker._state = CircuitState.CLOSED
        sap_breaker._failures = 0
        sap_breaker._opened_at = None
    with patch.object(SAPPaymentsReportService, "get_payments", return_value=MOCK_ENDPOINT_PAYMENTS), \
         patch.object(SAPPaymentsReportService, "get_pending_payments", return_value={"total": 0.0, "count": 0, "rule": ""}), \
         patch.object(SAPPaymentsReportService, "get_refunds", return_value={"total": 0.0, "count": 0, "rule": ""}), \
         patch.object(SAPPaymentsReportService, "get_payment_detail", return_value={
             "docEntry": 11,
             "docNum": 11,
             "docDate": "2026-07-04",
             "cardCode": "CUS011",
             "cardName": "AMIK KR",
             "totalAmount": 1200.0,
             "paymentMethod": "transfer",
             "status": "Success",
             "currency": "INR",
             "linkedInvoices": []
         }):
        yield
    clear_payments_report_cache()


@pytest.fixture
def auth_headers():
    token = create_access_token({"sub": "admin", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def manager_headers():
    token = create_access_token({"sub": "manager", "role": "manager", "branch_id": "3"})
    return {"Authorization": f"Bearer {token}"}


def test_date_formatting():
    assert _format_date(None) is None
    assert _format_date("None") is None
    assert _format_date("") is None
    assert _format_date(date(2026, 7, 4)) == "2026-07-04"
    assert _format_date(datetime(2026, 7, 4, 15, 30, 0)) == "2026-07-04"
    assert _format_date("2026-07-04T00:00:00Z") == "2026-07-04"


def test_to_float():
    assert _to_float(None) == 0.0
    assert _to_float(1200) == 1200.0
    assert _to_float("1200.50") == 1200.50
    assert _to_float("invalid") == 0.0


def test_branch_matching():
    service = SAPPaymentsReportService()
    # "All" branches
    assert service._match_branch(3, "GZB", None) is True
    assert service._match_branch(3, "GZB", "") is True
    assert service._match_branch(3, "GZB", "ALL") is True

    # Numeric BPLID match
    assert service._match_branch(3, "GZB", "3") is True
    assert service._match_branch(1, "Amit", "3") is False

    # Name match
    assert service._match_branch(3, "GZB", "GZB") is True
    assert service._match_branch(3, "GZB", "DEL") is False

    # Warehouse code mapping
    assert service._match_branch(3, "GZB", "SH") is True
    assert service._match_branch(4, "DEL", "DEL") is True


@patch("app.services.sap.payments_report_service.get_sap_client")
def test_get_payments_enrichment(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client

    # Mock IncomingPayments
    mock_client.get.side_effect = [
        # IncomingPayments response
        {
            "value": [
                {
                    "DocEntry": 101,
                    "DocNum": 11,
                    "DocDate": "2026-07-04T00:00:00Z",
                    "CardCode": "CUS011",
                    "CardName": "AMIK KR",
                    "CashSum": 0.0,
                    "TransferSum": 1200.0,
                    "PaymentCreditCards": [],
                    "PaymentChecks": [],
                    "PaymentInvoices": [
                        {
                            "DocEntry": 53,
                            "DocNum": 2,
                            "SumApplied": 1200.0,
                        }
                    ],
                    "BPLID": 3,
                    "BPLName": "GZB",
                    "Cancelled": "tNO",
                    "DocCurrency": "INR",
                },
                {
                    "DocEntry": 102,
                    "DocNum": 12,
                    "DocDate": "2026-07-05T00:00:00Z",
                    "CardCode": "CUS001",
                    "CardName": "Amazon",
                    "CashSum": 150.0,
                    "TransferSum": 0.0,
                    "PaymentCreditCards": [],
                    "PaymentChecks": [],
                    "PaymentInvoices": [],
                    "BPLID": 3,
                    "BPLName": "GZB",
                    "Cancelled": "tNO",
                    "DocCurrency": "INR",
                },
            ]
        },
        # Invoices response
        {
            "value": [
                {
                    "DocEntry": 53,
                    "DocNum": 2,
                    "DocDate": "2026-07-04T00:00:00Z",
                    "DocTotal": 1200.0,
                    "PaidToDate": 1200.0,
                    "DocumentStatus": "bost_Close",
                }
            ]
        },
    ]

    service = SAPPaymentsReportService()
    payments = service.get_payments("2026-07-01", "2026-07-31")

    assert len(payments) == 2
    # Check first payment
    p1 = payments[0]
    assert p1["_TotalAmount"] == 1200.0
    assert p1["_PaymentMethod"] == "transfer"
    assert p1["_Status"] == "Success"
    assert p1["_InvoiceDocNum"] == "2"
    assert p1["_InvoiceAmount"] == 1200.0

    # Check second payment (on account)
    p2 = payments[1]
    assert p2["_TotalAmount"] == 150.0
    assert p2["_PaymentMethod"] == "cash"
    assert p2["_InvoiceDocNum"] == "On Account"


def test_api_overview_endpoint(auth_headers):
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/overview?range=all_time", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "totalPayments" in data
    assert "paidInvoices" in data
    assert "pendingPayments" in data
    assert "refundsIssued" in data
    assert "averagePaymentValue" in data
    assert data["currency"] == "INR"
    assert isinstance(data["rules"], dict)


def test_api_distribution_endpoint(auth_headers):
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/distribution?range=all_time", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        item = data[0]
        assert "method" in item
        assert "total" in item
        assert "count" in item
        assert "percentage" in item


def test_api_trend_endpoint(auth_headers):
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/trend?range=all_time&granularity=daily", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        pt = data[0]
        assert "label" in pt
        assert "amount" in pt
        assert "count" in pt


def test_api_transactions_endpoint(auth_headers):
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/transactions?range=all_time&limit=5", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    if data["items"]:
        item = data["items"][0]
        assert "docEntry" in item
        assert "docNum" in item
        assert "totalAmount" in item
        assert "paymentMethod" in item
        assert "status" in item


def test_api_customers_endpoint(auth_headers):
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/customers?range=all_time", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        c = data[0]
        assert "customerCode" in c
        assert "customerName" in c
        assert "totalAmount" in c
        assert "paymentCount" in c


def test_api_methods_endpoint(auth_headers):
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/methods?range=all_time", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        m = data[0]
        assert "method" in m
        assert "displayName" in m
        assert "totalAmount" in m
        assert "transactionCount" in m
        assert "percentage" in m


def test_api_export_endpoint(auth_headers):
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/export?range=all_time&format=csv", headers=auth_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "Transaction ID,SAP DocNum" in res.text


def test_api_payment_detail_endpoint(auth_headers):
    client = TestClient(app)
    # Check detail for a known DocEntry, e.g. 11
    res = client.get("/api/v1/reports/payments/detail/11", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["docEntry"] == 11
    assert "cardCode" in data
    assert "totalAmount" in data
    assert "linkedInvoices" in data


def test_api_defaults_to_all_time(auth_headers):
    """Verifies that omitting the range query parameter defaults to all_time."""
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/overview", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["period"]["range"] == "all_time"
    # When range is all_time, startDate and endDate should be None (no restriction)
    assert data["period"]["startDate"] is None
    assert data["period"]["endDate"] is None


def test_trend_chronological_order_no_fabricated_zero_filler(auth_headers):
    """Verifies that all_time daily trend returns chronologically sorted items without filler 0-buckets."""
    client = TestClient(app)
    res = client.get("/api/v1/reports/payments/trend?range=all_time&granularity=daily", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    # Check chronological ordering
    labels = [d["label"] for d in data]
    assert labels == sorted(labels)
    # Should not generate 365+ filler days
    assert len(data) <= 50
    # Every returned bucket should have actual transaction activity or non-zero count
    for pt in data:
        assert pt["count"] > 0
        assert pt["amount"] > 0


def test_paid_invoices_paid_in_full_criteria():
    """Verifies that paidInvoices counts only distinct invoices that satisfy paid-in-full criteria."""
    from app.api.v1.payments_report import get_payments_overview
    from unittest.mock import AsyncMock

    mock_payments = [
        {
            "_Status": "Success",
            "_TotalAmount": 500.0,
            "_LinkedInvoices": [
                {"docEntry": 101, "invoiceStatus": "bost_Close", "invoiceTotal": 500.0, "sumApplied": 500.0},
                {"docEntry": 102, "invoiceStatus": "bost_Open", "invoiceTotal": 1000.0, "sumApplied": 200.0},
            ],
        },
        {
            "_Status": "Success",
            "_TotalAmount": 200.0,
            "_LinkedInvoices": [
                # Invoice 101 is referenced again in another payment (should be deduplicated)
                {"docEntry": 101, "invoiceStatus": "bost_Close", "invoiceTotal": 500.0, "sumApplied": 500.0},
            ],
        },
    ]

    with patch("app.api.v1.payments_report.service.get_payments", return_value=mock_payments), \
         patch("app.api.v1.payments_report.service.get_pending_payments", return_value={"total": 0.0, "count": 0, "rule": ""}), \
         patch("app.api.v1.payments_report.service.get_refunds", return_value={"total": 0.0, "count": 0, "rule": ""}):
        import asyncio
        overview = asyncio.run(get_payments_overview(
            range="all_time",
            from_date=None,
            to_date=None,
            branch=None,
            customer=None,
            payment_method=None,
            payment_status=None,
            current_user={"role": "admin"},
        ))
        # Total payments: 700.0
        assert overview["totalPayments"] == 700.0
        # Distinct paid invoices: only docEntry 101 satisfies bost_Close; docEntry 102 is bost_Open
        assert overview["paidInvoices"] == 1

