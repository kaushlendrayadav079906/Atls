"""API tests – SAP-only mode (no database)"""

from datetime import date
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock

from app.main import app
from app.core.security import get_current_user
from app.services.sap.invoices_service import SAPInvoicesService


@pytest.fixture
def client():
    """Test client with SAP mocked out."""
    with (
        patch("app.services.sap.client.SAPServiceLayerClient.login", return_value=True),
        patch("app.services.sap.items_service.SAPItemsService.get_items", return_value=[]),
    ):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "test"}
        with TestClient(app) as test_client:
            yield test_client

        app.dependency_overrides.clear()


# ─── Health Check ────────────────────────────────────────────────────────────

def test_health_check(client):
    """Health endpoint should always return 200 and include dependency status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "dependencies" in data
    assert "sap" in data["dependencies"]
    assert "database" in data["dependencies"]


# ─── Auth ─────────────────────────────────────────────────────────────────────

def test_login_invalid_credentials(client):
    """Login with bad credentials should return 401."""
    with patch(
        "app.services.user_service.authenticate_user",
        return_value=None,
    ):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "baduser", "password": "badpass"},
        )
        assert response.status_code == 401


def test_login_returns_token(client):
    """Login with valid SAP credentials should return a bearer token."""
    with patch(
        "app.services.user_service.authenticate_user",
        return_value={
            "id": "1",
            "username": "testuser",
            "email": "test@example.com",
            "name": "Test User",
            "role": "user",
            "sap_user_code": None,
        },
    ):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "testpass"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"


def test_register_without_master_password(client):
    """Registration should work without the master password field in the UI."""
    with patch(
        "app.services.user_service.create_user",
        return_value={
            "id": "1",
            "username": "newuser",
            "email": "newuser@example.com",
            "name": "New User",
            "role": "user",
            "sap_user_code": None,
            "branch_id": None,
            "store_name": None,
        },
    ):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "StrongPass123!",
                "name": "New User",
                "role": "user",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["username"] == "newuser"
        assert "access_token" in data


# ─── Products: Image Proxy ─────────────────────────────────────────────────

def test_product_image_proxy_returns_image_bytes(client):
    with patch(
        "app.services.sap.items_service.SAPItemsService.get_item_image_data",
        return_value=(b"\x89PNG\r\n\x1a\n...", "image/png"),
    ):
        response = client.get(
            "/api/v1/products/ITEM-001/image",
        )

        assert response.status_code == 200
        assert response.headers.get("content-type", "").startswith("image/png")
        assert response.content.startswith(b"\x89PNG")


def test_product_image_proxy_404_when_missing(client):
    from app.services.sap.client import SAPValidationError

    with (
        patch(
            "app.services.sap.items_service.SAPItemsService.get_item_image_data",
            side_effect=SAPValidationError("No attachment found for item"),
        ),
        patch(
            "app.services.sap.items_service.SAPItemsService.get_item_by_code",
            return_value={"ItemCode": "ITEM-002", "Picture": None},
        ),
    ):
        response = client.get("/api/v1/products/ITEM-002/image")

        assert response.status_code == 404


def test_products_cache_absolutizes_image_urls(client):
    # Pre-populate cache with a relative image path (as stored by warm/refresh).
    from app.core.cache import cache_set, PRODUCTS_LIST_KEY
    from app.core.config import settings as app_settings

    payload = [
        {
            "id": "ITEM-001",
            "name": "Test Item",
            "price": 10.0,
            "barcode": "123",
            "stock": 1.0,
            "image": "/api/v1/products/ITEM-001/image",
            "category": "1",
            "brand": None,
            "warehouse": "01",
        }
    ]

    # The endpoint builds cache_key with branch suffix (:branch:all for users without branch_id).
    default_wh = app_settings.SAP_DEFAULT_WAREHOUSE or ""
    branch_suffix = f":branch:{default_wh}" if default_wh else ":branch:all"
    cache_key = PRODUCTS_LIST_KEY + branch_suffix

    # Use PUBLIC_BASE_URL so response image should be absolute.
    with patch("app.api.v1.products.settings.PUBLIC_BASE_URL", "https://example.com"):
        import asyncio

        asyncio.run(cache_set(cache_key, payload, ttl=600))
        resp = client.get("/api/v1/products")
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["image"].startswith("https://example.com/")


def test_operator_dashboard_contains_expected_fields(client):
    invoices_service = MagicMock()
    invoices_service.get_invoices_by_date.return_value = [
        {
            "DocEntry": 1001,
            "DocNum": 5001,
            "DocDate": "2026-04-27",
            "DocTotal": 500.0,
            "DiscSum": 0.0,
            "VatSum": 90.0,
            "U_P_Method": "cash",
            "DocumentLines": [
                {
                    "ItemCode": "ITM-001",
                    "ItemDescription": "Test Product",
                    "Quantity": 2,
                    "UnitPrice": 250.0,
                    "LineTotal": 500.0,
                    "WarehouseCode": "01",
                }
            ],
        }
    ]

    items_service = MagicMock()
    items_service.get_items.return_value = [
        {
            "ItemCode": "ITM-001",
            "ItemName": "Test Product",
            "QuantityOnStock": 12,
            "ItemWarehouseInfoCollection": [{"WarehouseCode": "01", "InStock": 12}],
        }
    ]

    with (
        patch("app.api.v1.dashboard.SAPInvoicesService", return_value=invoices_service),
        patch("app.api.v1.dashboard._fetch_credit_notes", return_value=[]),
        patch("app.api.v1.dashboard.cache_get", new=AsyncMock(return_value=None)),
        patch("app.api.v1.dashboard.cache_set", new=AsyncMock()),
    ):
        response = client.get("/api/v1/dashboard/operator")

    assert response.status_code == 200
    data = response.json()
    for key in [
        "todayTotal",
        "billCount",
        "averageBillValue",
        "itemsSoldCount",
        "paymentBreakdown",
        "recentSales",
        "topSellingItems",
        "lowSellingItems",
        "availableStock",
        "lowStockAlerts",
        "outOfStockItems",
        "returnedItems",
        "returnsCount",
        "returnReasons",
        "performance",
        "quickActions",
    ]:
        assert key in data


def test_admin_report_export_accepts_invoice_report_type(client):
    """The admin report endpoint should accept the same child-page report types used by the UI."""
    invoices_service = MagicMock()
    invoices_service.get_invoices_by_date.return_value = [
        {
            "DocEntry": 1001,
            "DocNum": 5001,
            "DocDate": "2026-04-27",
            "DocTotal": 350.0,
            "DiscSum": 0.0,
            "VatSum": 30.0,
            "TotalDiscount": 0.0,
            "U_C_Name": "Jane Smith",
            "U_W_Number": "+91 98765 43210",
            "U_S_Employee": "Emp-01",
            "U_P_Method": "card",
            "DocumentLines": [],
        }
    ]

    app.dependency_overrides[get_current_user] = lambda: {"sub": "admin-1", "role": "admin", "user_id": "admin-1", "branch_id": "WH-001"}
    try:
        with patch("app.api.v1.admin.SAPInvoicesService", return_value=invoices_service):
            response = client.get(
                "/api/v1/admin/reports/export",
                params={"range": "daily", "report_type": "invoice", "format": "csv"},
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.headers["content-disposition"].endswith('.csv"')
    assert "DocNum" in response.text
    assert "Jane Smith" in response.text


def test_dashboard_customer_search_falls_back_to_invoice_udf_data(client):
    """Customer search should fall back to invoice UDF data when SAP BP lookup fails."""
    recent_invoices = [
        {
            "DocEntry": 1001,
            "DocNum": 5001,
            "DocDate": "2026-04-27",
            "DocTotal": 1200.0,
            "U_C_Name": "Jane Smith",
            "U_W_Number": "+91 98765 43210",
            "U_Email": "jane@example.com",
            "U_S_Employee": "Emp-01",
            "U_Address": "Bengaluru",
            "U_P_Method": "card",
            "DocumentLines": [],
        },
        {
            "DocEntry": 1002,
            "DocNum": 5002,
            "DocDate": "2026-04-28",
            "DocTotal": 800.0,
            "U_C_Name": "Jane Smith",
            "U_W_Number": "+91 98765 43210",
            "U_Email": "jane@example.com",
            "U_S_Employee": "Emp-01",
            "U_Address": "Bengaluru",
            "U_P_Method": "upi",
            "DocumentLines": [],
        },
        {
            "DocEntry": 1003,
            "DocNum": 5003,
            "DocDate": "2026-04-29",
            "DocTotal": 640.0,
            "U_C_Name": "Amit Verma",
            "U_W_Number": "+91 91234 56789",
            "U_Email": "amit@example.com",
            "U_S_Employee": "Emp-02",
            "U_Address": "Hyderabad",
            "U_P_Method": "cash",
            "DocumentLines": [],
        },
    ]

    with (
        patch("app.api.v1.dashboard.SAPBusinessPartnersService.search_customers", side_effect=Exception("SAP login error")),
        patch("app.api.v1.dashboard.SAPInvoicesService.get_recent_invoices_with_lines", return_value=recent_invoices),
        patch("app.api.v1.dashboard.cache_get", new=AsyncMock(return_value=None)),
        patch("app.api.v1.dashboard.cache_set", new=AsyncMock()),
    ):
        response = client.get("/api/v1/dashboard/customers?search=Jane")

    assert response.status_code == 502


def test_recent_sales_formats_document_date(client):
    invoices_service = MagicMock()
    from app.core.config import settings
    invoices_service.get_recent_invoices_with_lines.return_value = [{
        "DocEntry": 101,
        "DocNum": 1001,
        "DocDate": "2026-04-27T00:00:00Z",
        "DocTotal": 50,
        "DocumentLines": [{
            "ItemCode": "ITEM-1",
            "ItemDescription": "Widget",
            "Quantity": 1,
            "UnitPrice": 50,
            "LineTotal": 50,
            "WarehouseCode": settings.SAP_DEFAULT_WAREHOUSE,
        }],
    }]

    with patch("app.api.v1.dashboard.SAPInvoicesService", return_value=invoices_service):
        response = client.get("/api/v1/dashboard/recent-sales")

    assert response.status_code == 200
    assert response.json()[0]["docDate"] == "2026-04-27"


def test_operator_dashboard_fails_when_credit_notes_are_unavailable(client):
    invoices_service = MagicMock()
    invoices_service.get_invoices_by_date.return_value = [
        {
            "DocEntry": 1002,
            "DocNum": 5002,
            "DocDate": "2026-04-27",
            "DocTotal": 1000.0,
            "DiscSum": 0.0,
            "VatSum": 180.0,
            "U_P_Method": "upi",
            "DocumentLines": [
                {
                    "ItemCode": "ITM-002",
                    "ItemDescription": "Another Product",
                    "Quantity": 1,
                    "UnitPrice": 1000.0,
                    "LineTotal": 1000.0,
                    "WarehouseCode": "01",
                }
            ],
        }
    ]

    items_service = MagicMock()
    items_service.get_items.return_value = []

    with (
        patch("app.api.v1.dashboard.SAPInvoicesService", return_value=invoices_service),
        patch("app.api.v1.dashboard._fetch_credit_notes", side_effect=Exception("credit note API unavailable")),
        patch("app.api.v1.dashboard.cache_get", new=AsyncMock(return_value=None)),
        patch("app.api.v1.dashboard.cache_set", new=AsyncMock()),
    ):
        response = client.get("/api/v1/dashboard/operator")

    assert response.status_code == 502
    assert response.json()["detail"] == "Could not retrieve return data from SAP"


def test_get_invoices_by_date_does_not_expand_document_lines():
    """Regression: invoice listing must not request invalid DocumentLines expansion."""
    service = SAPInvoicesService()
    fake_client = MagicMock()
    service.client = fake_client

    fake_client.get.side_effect = [
        {"value": [{"DocEntry": 101}]},
        {"DocEntry": 101, "DocumentLines": []},
    ]

    invoices = service.get_invoices_by_date(date(2026, 4, 27))

    assert len(invoices) == 1
    list_call = fake_client.get.call_args_list[0]
    assert list_call.args[0] == "Invoices"
    params = list_call.args[1]
    assert "$expand" not in params


def test_get_invoices_by_date_propagates_sap_errors():
    service = SAPInvoicesService()
    service.client = MagicMock()
    service.client.get.side_effect = RuntimeError("SAP unavailable")

    with pytest.raises(RuntimeError, match="SAP unavailable"):
        service.get_invoices_by_date(date(2026, 4, 27))


def test_get_invoices_by_date_rejects_results_beyond_limit(monkeypatch):
    from app.services.sap import invoices_service

    monkeypatch.setattr(invoices_service, "_MAX_INVOICES_PER_DATE_RANGE", 1)
    service = SAPInvoicesService()
    service.client = MagicMock()
    service.client.get.side_effect = [
        {"value": [{"DocEntry": 1}]},
        {"value": [{"DocEntry": 2}]},
    ]

    with pytest.raises(RuntimeError, match="exceeds the configured limit"):
        service.get_invoices_by_date(date(2026, 4, 27))


def test_get_invoices_by_date_with_lines_logs_incomplete_hydration(caplog):
    service = SAPInvoicesService()
    service.get_invoices_by_date = MagicMock(return_value=[{"DocEntry": 101}])
    service._get_invoice_lines_by_date = MagicMock(return_value=[])

    headers = service.get_invoices_by_date_with_lines(date(2026, 4, 27))
    assert len(headers) == 1
    assert "line hydration was incomplete" in caplog.text


def test_invoice_line_query_rejects_results_beyond_limit():
    service = SAPInvoicesService()
    service.client = MagicMock()
    service.client.post.side_effect = [
        {"value": [{"Invoices": {"DocEntry": 1}, "DocumentLines": {"LineNum": 0}}]},
        {"value": [{"Invoices": {"DocEntry": 2}, "DocumentLines": {"LineNum": 0}}]},
    ]

    with pytest.raises(RuntimeError, match="exceeds the configured limit"):
        service._query_crossjoin_lines("DocDate ge '2026-01-01'", max_rows=1, page_size=1)


def test_fetch_credit_notes_for_day_returns_paginated_notes():
    """Regression: credit note listing must paginate via $skip and return results."""
    from app.api.v1.dashboard import _fetch_credit_notes_for_day

    fake_client = MagicMock()
    # Single page smaller than page_size — terminates after one request
    fake_client.get.side_effect = [
        {"value": [{"DocEntry": 301, "DocDate": "2026-05-06"}]},
        {"DocEntry": 301, "DocDate": "2026-05-06", "Comments": "Return reason: damaged", "CreditNoteLines": [{"WarehouseCode": "01"}]},
    ]

    with patch("app.services.sap.returns_service.get_sap_client", return_value=fake_client):
        notes = _fetch_credit_notes_for_day(None)

    assert len(notes) == 1
    list_call = fake_client.get.call_args_list[0]
    assert list_call.args[0] == "CreditNotes"
    params = list_call.args[1]
    assert "$filter" in params
    assert "$top" in params


def test_returns_by_date_rejects_credit_note_without_single_warehouse():
    from app.services.sap.returns_service import SAPReturnsService

    service = SAPReturnsService.__new__(SAPReturnsService)
    service.client = MagicMock()
    service.client.get.side_effect = [
        {"value": [{"DocEntry": 301}]},
        {
            "DocEntry": 301,
            "CreditNoteLines": [
                {"WarehouseCode": "B1"},
                {"WarehouseCode": "B2"},
            ],
        },
    ]

    with pytest.raises(RuntimeError, match="single attributable warehouse"):
        service.get_returns_by_date(date(2026, 5, 6), date(2026, 5, 6), warehouse="B1")


def test_operator_return_reason_uses_workflow_comment_not_unverified_udf():
    from app.api.v1.dashboard import _build_return_orders

    orders = _build_return_orders([{
        "DocEntry": 301,
        "Comments": "Return reason: damaged | Return type: refund",
        "U_Return_Reason": "unverified reason",
        "CreditNoteLines": [],
    }])

    assert len(orders) == 1
    assert orders[0].reason == "damaged"
