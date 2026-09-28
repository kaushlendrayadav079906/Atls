"""
Phase 4 – Inventory & Products tests.

All SAP interactions are mocked; no live requests or writes are made.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import get_current_user
from app.services.sap.inventory_service import SAPInventoryService


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

def _user(role="operator", branch_id="BRANCH_A"):
    return {"sub": f"{role}1", "role": role, "branch_id": branch_id}


@pytest.fixture
def client():
    with patch("app.services.sap.client.SAPServiceLayerClient.login", return_value=True):
        with patch("app.services.sap.items_service.SAPItemsService.get_items", return_value=[]):
            with TestClient(app) as c:
                yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /products — authentication
# ---------------------------------------------------------------------------

def test_get_products_requires_auth(client):
    """No token → 403 (HTTPBearer raises 403 when auto_error=True)."""
    app.dependency_overrides.clear()
    resp = client.get("/api/v1/products")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /products — branch-scoped stock
# ---------------------------------------------------------------------------

def test_get_products_branch_user_sees_own_branch_stock(client):
    """Operator gets stock for their branch warehouse only."""
    app.dependency_overrides[get_current_user] = lambda: _user("operator", "WH01")

    sap_item = {
        "ItemCode": "ITM-001",
        "ItemName": "Widget",
        "ItemWarehouseInfoCollection": [
            {"WarehouseCode": "WH01", "InStock": 7.0},
            {"WarehouseCode": "WH02", "InStock": 99.0},
        ],
        "BarCode": "0001",
        "U_Brand": None,
        "U_Size": None,
        "U_Colour": None,
        "U_SUBG": None,
        "ItemsGroupCode": 1,
    }

    with (
        patch("app.core.product_store.product_store.get", new=AsyncMock(return_value=None)),
        patch("app.core.cache.cache_get", new=AsyncMock(return_value=None)),
        patch("app.core.cache.cache_set", new=AsyncMock()),
        patch("app.core.product_store.product_store.set", new=AsyncMock()),
        patch("app.services.sap.items_service.SAPItemsService.get_items", return_value=[sap_item]),
        patch("app.services.sap.items_service.SAPItemsService.extract_price", return_value=10.0),
        patch("app.services.sap.items_service.SAPItemsService.extract_image_url", return_value=None),
    ):
        resp = client.get("/api/v1/products")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["stock"] == 7.0   # Only WH01 stock; not 99 from WH02


# ---------------------------------------------------------------------------
# GET /products/{barcode} — branch-scoped stock
# ---------------------------------------------------------------------------

def test_get_product_by_barcode_branch_scoping(client):
    """Barcode lookup scopes stock to operator's branch."""
    app.dependency_overrides[get_current_user] = lambda: _user("operator", "WH01")

    sap_item = {
        "ItemCode": "ITM-001",
        "ItemName": "Widget",
        "BarCode": "BC001",
        "ItemWarehouseInfoCollection": [
            {"WarehouseCode": "WH01", "InStock": 3.0},
            {"WarehouseCode": "WH02", "InStock": 50.0},
        ],
        "U_Brand": None,
        "U_Size": None,
        "U_Colour": None,
        "U_SUBG": None,
        "ItemsGroupCode": 1,
    }

    with (
        patch("app.services.sap.items_service.SAPItemsService.get_item_by_barcode", return_value=sap_item),
        patch("app.services.sap.items_service.SAPItemsService.extract_price", return_value=10.0),
        patch("app.services.sap.items_service.SAPItemsService.extract_image_url", return_value=None),
    ):
        resp = client.get("/api/v1/products/BC001")

    assert resp.status_code == 200
    assert resp.json()["stock"] == 3.0   # Only WH01


def test_get_product_by_barcode_not_found(client):
    app.dependency_overrides[get_current_user] = lambda: _user()

    with patch("app.services.sap.items_service.SAPItemsService.get_item_by_barcode", return_value=None):
        resp = client.get("/api/v1/products/NO_SUCH_BC")

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /products — search length validation
# ---------------------------------------------------------------------------

def test_get_products_search_too_long_rejected(client):
    """Search strings longer than 100 characters must be rejected (422)."""
    app.dependency_overrides[get_current_user] = lambda: _user()
    too_long = "a" * 101
    resp = client.get(f"/api/v1/products?search={too_long}")
    assert resp.status_code == 422


def test_get_products_search_max_length_accepted(client):
    """Exactly 100-character search must not be rejected for length."""
    app.dependency_overrides[get_current_user] = lambda: _user()
    exact = "a" * 100

    with (
        patch("app.core.product_store.product_store.get", new=AsyncMock(return_value=None)),
        patch("app.core.cache.cache_get", new=AsyncMock(return_value=None)),
        patch("app.core.cache.cache_set", new=AsyncMock()),
        patch("app.core.product_store.product_store.set", new=AsyncMock()),
        patch("app.services.sap.items_service.SAPItemsService.get_items", return_value=[]),
    ):
        resp = client.get(f"/api/v1/products?search={exact}")

    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Write operations — admin-only
# ---------------------------------------------------------------------------

def test_create_product_forbidden_for_operator(client):
    app.dependency_overrides[get_current_user] = lambda: _user("operator")
    resp = client.post("/api/v1/products", json={
        "name": "Test", "price": 10.0, "barcode": "B001", "stock": 5.0
    })
    assert resp.status_code == 403


def test_update_product_forbidden_for_manager(client):
    app.dependency_overrides[get_current_user] = lambda: _user("manager")
    resp = client.put("/api/v1/products/ITM-001", json={"price": 20.0})
    assert resp.status_code == 403


def test_delete_product_forbidden_for_operator(client):
    app.dependency_overrides[get_current_user] = lambda: _user("operator")
    resp = client.delete("/api/v1/products/ITM-001")
    assert resp.status_code == 403


def test_create_product_sap_error_does_not_leak_detail(client):
    """Internal SAP error must return 502 with a generic message, not raw exception."""
    app.dependency_overrides[get_current_user] = lambda: _user("admin")

    with patch(
        "app.services.sap.items_service.SAPItemsService.create_item",
        side_effect=Exception("SAP_SECRET_DETAIL: password=abc"),
    ):
        resp = client.post("/api/v1/products", json={
            "name": "Test", "price": 10.0, "barcode": "B001", "stock": 5.0
        })

    assert resp.status_code == 502
    body = resp.json()["detail"]
    # Must not leak the internal exception text
    assert "SAP_SECRET_DETAIL" not in body
    assert "password" not in body


# ---------------------------------------------------------------------------
# POST /refresh-cache — manager/admin only
# ---------------------------------------------------------------------------

def test_refresh_cache_forbidden_for_operator(client):
    app.dependency_overrides[get_current_user] = lambda: _user("operator")
    resp = client.post("/api/v1/products/refresh-cache")
    assert resp.status_code == 403


def test_refresh_cache_allowed_for_manager(client):
    app.dependency_overrides[get_current_user] = lambda: _user("manager")
    with patch("app.api.v1.products._refresh_cache_background", return_value=None):
        resp = client.post("/api/v1/products/refresh-cache")
    assert resp.status_code == 202


# ---------------------------------------------------------------------------
# SAPInventoryService.get_warehouse_stock — pagination
# ---------------------------------------------------------------------------

def test_get_warehouse_stock_paginates():
    """Service must page through results and return combined list."""
    service = SAPInventoryService.__new__(SAPInventoryService)
    fake_client = MagicMock()

    PAGE = 500
    page1 = [{"ItemCode": f"I{i}"} for i in range(PAGE)]
    page2 = [{"ItemCode": f"J{i}"} for i in range(10)]   # smaller than PAGE → last page

    fake_client.get.side_effect = [
        {"value": page1},
        {"value": page2},
    ]
    service.client = fake_client

    result = service.get_warehouse_stock("WH01")

    assert fake_client.get.call_count == 2
    assert len(result) == PAGE + 10
    # No truncation sentinel
    assert not any(item.get("_truncated") for item in result)


def test_get_warehouse_stock_signals_truncation():
    """If SAP keeps returning full pages beyond MAX_PAGES, sentinel is appended."""
    service = SAPInventoryService.__new__(SAPInventoryService)
    fake_client = MagicMock()

    PAGE = 500
    MAX_PAGES = 20
    full_page = [{"ItemCode": f"I{i}"} for i in range(PAGE)]
    # Always return a full page → never-ending
    fake_client.get.return_value = {"value": full_page}
    service.client = fake_client

    result = service.get_warehouse_stock("WH01")

    assert fake_client.get.call_count == MAX_PAGES
    assert result[-1] == {"_truncated": True}
    # Real items must still be present (not wiped)
    real_items = [r for r in result if not r.get("_truncated")]
    assert len(real_items) == MAX_PAGES * PAGE


def test_get_warehouse_stock_sap_error_propagates():
    """A mid-pagination SAP error must not look like a complete snapshot."""
    service = SAPInventoryService.__new__(SAPInventoryService)
    fake_client = MagicMock()

    PAGE = 500
    page1 = [{"ItemCode": f"I{i}"} for i in range(PAGE)]
    fake_client.get.side_effect = [
        {"value": page1},
        Exception("SAP timeout"),
    ]
    service.client = fake_client

    with pytest.raises(Exception, match="SAP timeout"):
        service.get_warehouse_stock("WH01")
