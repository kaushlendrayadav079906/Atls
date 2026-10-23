"""Unit and integration tests for Invoice Report endpoints and SAP integration."""

from datetime import date, datetime
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
from app.services.sap.invoices_report_service import (
    SAPInvoicesReportService,
    _format_date,
    _to_float,
)
from app.core.circuit_breaker import sap_breaker, CircuitState


@pytest.fixture(autouse=True)
def reset_breaker():
    with sap_breaker._lock:
        sap_breaker._state = CircuitState.CLOSED
        sap_breaker._failures = 0
        sap_breaker._opened_at = None
    yield


@pytest.fixture
def auth_headers():
    token = create_access_token({"sub": "admin", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def manager_headers():
    token = create_access_token({"sub": "manager", "role": "manager", "branch_id": "3"})
    return {"Authorization": f"Bearer {token}"}


def test_invoices_date_formatting():
    assert _format_date(None) is None
    assert _format_date("None") is None
    assert _format_date("") is None
    assert _format_date(date(2026, 10, 7)) == "2026-10-07"
    assert _format_date(datetime(2026, 10, 7, 11, 17, 0)) == "2026-10-07"
    assert _format_date("2026-10-07T00:00:00Z") == "2026-10-07"


def test_invoices_to_float():
    assert _to_float(None) == 0.0
    assert _to_float(2240) == 2240.0
    assert _to_float("2240.50") == 2240.50
    assert _to_float("invalid") == 0.0


def test_invoices_branch_matching():
    service = SAPInvoicesReportService()
    assert service._match_branch(3, "GZB", None) is True
    assert service._match_branch(3, "GZB", "") is True
    assert service._match_branch(3, "GZB", "ALL") is True
    assert service._match_branch(3, "GZB", "3") is True
    assert service._match_branch(1, "Amit", "3") is False
    assert service._match_branch(3, "GZB", "GZB") is True
    assert service._match_branch(3, "GZB", "DEL") is False


@patch("app.services.sap.invoices_report_service.get_sap_client")
def test_get_invoices_enrichment(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client

    # Mock raw SAP Invoices response
    mock_client.get.return_value = {
        "value": [
            {
                "DocEntry": 56,
                "DocNum": 5,
                "DocDate": "2026-10-07T00:00:00Z",
                "DocTime": "1117",
                "DocTotal": 2240.0,
                "PaidToDate": 2240.0,
                "DocumentStatus": "bost_Close",
                "Cancelled": "tNO",
                "CardCode": "CUS018",
                "CardName": "amit",
                "BPL_IDAssignedToInvoice": 3,
                "BPLName": "GZB",
                "DocCurrency": "INR",
                "PaymentMethod": "Cash",
                "U_P_Method": "Cash",
            },
            {
                "DocEntry": 55,
                "DocNum": 4,
                "DocDate": "2026-10-06T00:00:00Z",
                "DocTime": "1000",
                "DocTotal": 5000.0,
                "PaidToDate": 2000.0,
                "DocumentStatus": "bost_Open",
                "Cancelled": "tNO",
                "CardCode": "CUS002",
                "CardName": "John Doe",
                "BPL_IDAssignedToInvoice": 3,
                "BPLName": "GZB",
                "DocCurrency": "INR",
                "PaymentMethod": "Card",
                "U_P_Method": "Card",
            },
            {
                "DocEntry": 54,
                "DocNum": 3,
                "DocDate": "2026-10-05T00:00:00Z",
                "DocTime": "0930",
                "DocTotal": 1500.0,
                "PaidToDate": 0.0,
                "DocumentStatus": "bost_Open",
                "Cancelled": "tNO",
                "CardCode": "CUS003",
                "CardName": "Jane Smith",
                "BPL_IDAssignedToInvoice": 3,
                "BPLName": "GZB",
                "DocCurrency": "INR",
                "PaymentMethod": "UPI",
                "U_P_Method": "UPI",
            },
            {
                "DocEntry": 53,
                "DocNum": 2,
                "DocDate": "2026-10-04T00:00:00Z",
                "DocTime": "0900",
                "DocTotal": 800.0,
                "PaidToDate": 0.0,
                "DocumentStatus": "bost_Open",
                "Cancelled": "tYES",
                "CardCode": "CUS004",
                "CardName": "Cancelled User",
                "BPL_IDAssignedToInvoice": 3,
                "BPLName": "GZB",
                "DocCurrency": "INR",
                "PaymentMethod": "Cash",
                "U_P_Method": "Cash",
            },
        ]
    }

    service = SAPInvoicesReportService()
    invoices = service.get_invoices(force_refresh=True)

    assert len(invoices) == 4

    # Check invoice 1 (Fully paid)
    inv1 = invoices[0]
    assert inv1["invoiceNo"] == "INV-5"
    assert inv1["invoiceStatus"] == "Closed"
    assert inv1["paymentStatus"] == "Paid"
    assert inv1["balanceDue"] == 0.0
    assert inv1["paymentMethod"] == "Cash"

    # Check invoice 2 (Partially paid)
    inv2 = invoices[1]
    assert inv2["invoiceNo"] == "INV-4"
    assert inv2["invoiceStatus"] == "Open"
    assert inv2["paymentStatus"] == "Partially Paid"
    assert inv2["balanceDue"] == 3000.0
    assert inv2["paymentMethod"] == "Card"

    # Check invoice 3 (Unpaid)
    inv3 = invoices[2]
    assert inv3["invoiceNo"] == "INV-3"
    assert inv3["invoiceStatus"] == "Open"
    assert inv3["paymentStatus"] == "Unpaid"
    assert inv3["balanceDue"] == 1500.0
    assert inv3["paymentMethod"] == "UPI"

    # Check invoice 4 (Cancelled)
    inv4 = invoices[3]
    assert inv4["invoiceStatus"] == "Cancelled"
    assert inv4["paymentStatus"] == "Cancelled"
    assert inv4["cancelled"] is True


def test_invoices_overview_endpoint(auth_headers):
    client = TestClient(app)
    with patch.object(SAPInvoicesReportService, "get_invoices") as mock_get_invoices:
        mock_get_invoices.return_value = [
            {
                "docEntry": 1,
                "docNum": 1,
                "docTotal": 1000.0,
                "paidToDate": 1000.0,
                "balanceDue": 0.0,
                "cancelled": False,
                "paymentStatus": "Paid",
                "invoiceStatus": "Closed",
            },
            {
                "docEntry": 2,
                "docNum": 2,
                "docTotal": 2000.0,
                "paidToDate": 500.0,
                "balanceDue": 1500.0,
                "cancelled": False,
                "paymentStatus": "Partially Paid",
                "invoiceStatus": "Open",
            },
            {
                "docEntry": 3,
                "docNum": 3,
                "docTotal": 500.0,
                "paidToDate": 0.0,
                "balanceDue": 500.0,
                "cancelled": True,
                "paymentStatus": "Cancelled",
                "invoiceStatus": "Cancelled",
            },
        ]

        res = client.get("/api/v1/reports/invoices/overview?range=all_time", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()

        # Cancelled excluded from active KPI totals
        assert data["totalInvoices"] == 2
        assert data["totalSales"] == 3000.0
        assert data["totalPaid"] == 1500.0
        assert data["totalDue"] == 1500.0
        assert data["avgInvoiceValue"] == 1500.0
        assert data["paidPercentage"] == 50.0
        assert data["duePercentage"] == 50.0
        assert data["counts"]["paid"] == 1
        assert data["counts"]["partiallyPaid"] == 1
        assert data["counts"]["cancelled"] == 1


def test_invoices_list_endpoint(auth_headers):
    client = TestClient(app)
    with patch.object(SAPInvoicesReportService, "get_invoices") as mock_get_invoices:
        mock_get_invoices.return_value = [
            {
                "docEntry": 10,
                "docNum": 100,
                "invoiceNo": "INV-100",
                "docDate": "2026-10-07",
                "docTime": "11:00",
                "dateTime": "2026-10-07 11:00",
                "cardCode": "C001",
                "cardName": "Acme Corp",
                "docTotal": 2500.0,
                "paidToDate": 2500.0,
                "balanceDue": 0.0,
                "paymentMethod": "Cash",
                "invoiceStatus": "Closed",
                "paymentStatus": "Paid",
                "currency": "INR",
                "branchName": "GZB",
            },
            {
                "docEntry": 9,
                "docNum": 99,
                "invoiceNo": "INV-99",
                "docDate": "2026-10-06",
                "docTime": "10:00",
                "dateTime": "2026-10-06 10:00",
                "cardCode": "C002",
                "cardName": "Beta Ltd",
                "docTotal": 1200.0,
                "paidToDate": 0.0,
                "balanceDue": 1200.0,
                "paymentMethod": "Card",
                "invoiceStatus": "Open",
                "paymentStatus": "Unpaid",
                "currency": "INR",
                "branchName": "GZB",
            },
        ]

        # 1. Test basic fetch
        res = client.get("/api/v1/reports/invoices/list?range=all_time&limit=10&offset=0", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2
        assert data["items"][0]["invoiceNo"] == "INV-100"

        # 2. Test search
        res_search = client.get("/api/v1/reports/invoices/list?range=all_time&search=Beta", headers=auth_headers)
        assert res_search.status_code == 200
        data_search = res_search.json()
        assert data_search["total"] == 1
        assert data_search["items"][0]["cardName"] == "Beta Ltd"


def test_invoices_analytics_endpoint(auth_headers):
    client = TestClient(app)
    with patch.object(SAPInvoicesReportService, "get_invoices") as mock_get_invoices:
        mock_get_invoices.return_value = [
            {
                "docEntry": 1,
                "docDate": "2026-10-07",
                "docTotal": 3000.0,
                "paidToDate": 3000.0,
                "balanceDue": 0.0,
                "cancelled": False,
                "cardCode": "C001",
                "cardName": "Customer A",
                "paymentStatus": "Paid",
                "invoiceStatus": "Closed",
            },
            {
                "docEntry": 2,
                "docDate": "2026-10-07",
                "docTotal": 2000.0,
                "paidToDate": 0.0,
                "balanceDue": 2000.0,
                "cancelled": False,
                "cardCode": "C002",
                "cardName": "Customer B",
                "paymentStatus": "Unpaid",
                "invoiceStatus": "Open",
            },
        ]

        res = client.get("/api/v1/reports/invoices/analytics?range=all_time", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "trend" in data
        assert "paymentStatusBreakdown" in data
        assert "invoiceStatusBreakdown" in data
        assert "topCustomers" in data

        assert len(data["trend"]) == 1
        assert data["trend"][0]["totalSales"] == 5000.0
        assert data["trend"][0]["invoicesCount"] == 2

        assert len(data["topCustomers"]) == 2
        assert data["topCustomers"][0]["cardName"] == "Customer A"
        assert data["topCustomers"][0]["totalSales"] == 3000.0


def test_invoices_detail_endpoint(auth_headers):
    client = TestClient(app)
    with patch.object(SAPInvoicesReportService, "get_invoice_detail") as mock_detail:
        mock_detail.return_value = {
            "docEntry": 56,
            "docNum": 5,
            "invoiceNo": "INV-5",
            "docDate": "2026-10-07",
            "cardCode": "CUS018",
            "cardName": "amit",
            "docTotal": 2240.0,
            "paidToDate": 2240.0,
            "balanceDue": 0.0,
            "currency": "INR",
            "invoiceStatus": "Closed",
            "paymentStatus": "Paid",
            "paymentMethod": "Cash",
            "branchName": "GZB",
            "cancelled": False,
            "lines": [
                {
                    "lineNum": 0,
                    "itemCode": "FG0001",
                    "itemDescription": "Bajaj alliance",
                    "quantity": 10.0,
                    "unitPrice": 200.0,
                    "lineTotal": 2000.0,
                    "warehouseCode": "SH",
                    "taxCode": "IGST12",
                }
            ],
        }

        res = client.get("/api/v1/reports/invoices/detail/56", headers=auth_headers)
        assert res.status_code == 200
        detail = res.json()
        assert detail["docEntry"] == 56
        assert len(detail["lines"]) == 1
        assert detail["lines"][0]["itemCode"] == "FG0001"


def test_invoices_export_csv_endpoint(auth_headers):
    client = TestClient(app)
    with patch.object(SAPInvoicesReportService, "get_invoices") as mock_get_invoices:
        mock_get_invoices.return_value = [
            {
                "docEntry": 1,
                "docNum": 1,
                "invoiceNo": "INV-1",
                "docDate": "2026-10-07",
                "docTime": "12:00",
                "cardCode": "C001",
                "cardName": "Customer A",
                "docTotal": 1000.0,
                "paidToDate": 1000.0,
                "balanceDue": 0.0,
                "paymentMethod": "Cash",
                "invoiceStatus": "Closed",
                "paymentStatus": "Paid",
                "branchName": "GZB",
            }
        ]

        res = client.get("/api/v1/reports/invoices/export?format=csv", headers=auth_headers)
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        content = res.content.decode("utf-8")
        assert "INV-1" in content
        assert "Customer A" in content
