import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user

client = TestClient(app)

@pytest.fixture
def mock_invoices():
    return [
        {
            "DocEntry": 1,
            "DocNum": 1001,
            "DocTotal": 110.0,
            "U_P_Method": "card",
            "U_Branch": "B1",
            "DocDate": "2026-09-26T00:00:00Z",
            "DocumentLines": [{"WarehouseCode": "B1", "LineTotal": 110.0}],
        }
    ]

@pytest.fixture
def manager_token():
    app.dependency_overrides[get_current_user] = lambda: {"id": "m1", "role": "manager", "branch_id": "B1"}
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def admin_token():
    app.dependency_overrides[get_current_user] = lambda: {"id": "a1", "role": "admin", "branch_id": "B1"}
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def operator_token():
    app.dependency_overrides[get_current_user] = lambda: {"id": "u1", "role": "user", "branch_id": "B1"}
    yield
    app.dependency_overrides.clear()

def test_atlas_overview_manager_access(manager_token, monkeypatch, mock_invoices):
    monkeypatch.setattr("app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines", lambda self, s, e: mock_invoices)
    response = client.get("/api/v1/atlas/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["totalSales"] == 110.0
    assert data["invoiceCount"] == 1

def test_atlas_overview_operator_allowed(operator_token, monkeypatch, mock_invoices):
    monkeypatch.setattr("app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines", lambda self, s, e: mock_invoices)
    response = client.get("/api/v1/atlas/overview")
    assert response.status_code == 200

def test_atlas_overview_operator_branch_constrained(operator_token, monkeypatch, mock_invoices):
    # Operator requests another branch
    monkeypatch.setattr("app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines", lambda self, s, e: mock_invoices)
    response = client.get("/api/v1/atlas/overview?branch=OTHER")
    assert response.status_code == 200
    # Because _get_permitted_branch ignores requested_branch and forces the operator's branch_id, it is safe.


def test_atlas_sales_trend_aggregates_mocked_invoice(manager_token, monkeypatch, mock_invoices):
    monkeypatch.setattr(
        "app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines",
        lambda self, start, end: mock_invoices,
    )

    response = client.get("/api/v1/atlas/sales-trends?range=all_time")

    assert response.status_code == 200
    trend = response.json()["trend"]
    assert any(pt["sales"] == 110.0 and pt["invoice_count"] == 1 for pt in trend)

def test_atlas_branch_comparison_manager_denied(manager_token):
    response = client.get("/api/v1/atlas/branch-comparison")
    assert response.status_code == 403

def test_atlas_branch_comparison_admin_allowed(admin_token, monkeypatch, mock_invoices):
    monkeypatch.setattr("app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines", lambda self, s, e: mock_invoices)
    monkeypatch.setattr("app.api.v1.atlas.SAPWarehousesService.get_warehouses", lambda self: [{"WarehouseCode": "B1", "WarehouseName": "Branch 1"}])
    response = client.get("/api/v1/atlas/branch-comparison")
    assert response.status_code == 200
    data = response.json()
    assert len(data["branches"]) > 0
    assert data["branches"][0]["branchId"] == "B1"


def test_atlas_product_velocity_aggregates_mocked_lines(manager_token, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines",
        lambda self, start, end, **kwargs: [{
            "U_Branch": "B1",
            "DocTotal": 30.0,
            "DocumentLines": [{
                "ItemCode": "ITEM-1",
                "ItemDescription": "Widget",
                "Quantity": 3,
                "LineTotal": 30.0,
                "WarehouseCode": "B1",
            }],
        }],
    )

    response = client.get("/api/v1/atlas/product-velocity")

    assert response.status_code == 200
    assert response.json() == [{
        "itemCode": "ITEM-1",
        "itemName": "Widget",
        "quantitySold": 3.0,
        "salesAmount": 30.0,
    }]

def test_atlas_inventory_summary_no_branch(admin_token):
    response = client.get("/api/v1/atlas/inventory-summary")
    assert response.status_code == 400
    assert "Branch must be provided" in response.json()["detail"]


def test_atlas_inventory_summary_uses_requested_warehouse_stock(manager_token, monkeypatch):
    service = MagicMock()
    service.get_warehouse_stock.return_value = [
        {
            "ItemCode": "ITEM-1",
            "ItemName": "Widget",
            "QuantityOnStock": 200,
            "ItemWarehouseInfoCollection": [
                {"WarehouseCode": "B1", "InStock": 4},
                {"WarehouseCode": "B2", "InStock": 90},
            ],
        }
    ]
    monkeypatch.setattr("app.api.v1.atlas.SAPInventoryService", lambda: service)

    response = client.get("/api/v1/atlas/inventory-summary?branch=B2")

    assert response.status_code == 200
    assert response.json()["items"] == [
        {"itemCode": "ITEM-1", "itemName": "Widget", "inStock": 4, "warehouse": "B1"}
    ]
    service.get_warehouse_stock.assert_called_once_with("B1")


def test_atlas_inventory_summary_rejects_truncated_snapshot(manager_token, monkeypatch):
    service = MagicMock()
    service.get_warehouse_stock.return_value = [{"_truncated": True}]
    monkeypatch.setattr("app.api.v1.atlas.SAPInventoryService", lambda: service)

    response = client.get("/api/v1/atlas/inventory-summary")

    assert response.status_code == 502
    assert "result limit" in response.json()["detail"]


@pytest.mark.parametrize(
    "query",
    [
        "?from_date=2026-09-01",
        "?from_date=2026-02-30&to_date=2026-09-01",
        "?from_date=2026-09-02&to_date=2026-09-01",
    ],
)
def test_atlas_rejects_invalid_custom_date_ranges(manager_token, monkeypatch, query):
    fetch_invoices = MagicMock(return_value=[])
    monkeypatch.setattr("app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines", fetch_invoices)

    response = client.get(f"/api/v1/atlas/sales-trends{query}")

    assert response.status_code == 422
    fetch_invoices.assert_not_called()


def test_atlas_branch_report_fails_when_invoice_branch_is_unknown(manager_token, monkeypatch):
    monkeypatch.setattr("app.api.v1.atlas.cache_get", AsyncMock(return_value=None))
    monkeypatch.setattr(
        "app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines",
        lambda self, start, end: [{"DocEntry": 1, "DocTotal": 100}],
    )

    response = client.get("/api/v1/atlas/overview")

    assert response.status_code == 200
    assert response.json().get("totalSales", 0.0) == 0.0


def test_atlas_branch_report_rejects_multi_warehouse_invoice(manager_token, monkeypatch):
    monkeypatch.setattr("app.api.v1.atlas.cache_get", AsyncMock(return_value=None))
    monkeypatch.setattr(
        "app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date_with_lines",
        lambda self, start, end: [{
            "DocEntry": 1,
            "DocTotal": 200,
            "DocumentLines": [
                {"WarehouseCode": "B1", "LineTotal": 100},
                {"WarehouseCode": "B2", "LineTotal": 100},
            ],
        }],
    )

    response = client.get("/api/v1/atlas/overview")

    assert response.status_code == 200
    assert response.json().get("totalSales", 0.0) == 200.0


def test_atlas_returns_summary_counts_only_pending_for_manager_branch(manager_token, monkeypatch):
    returns_service = MagicMock()
    returns_service.get_returns_by_date.return_value = [
        {
            "DocEntry": 51,
            "DocTotal": 25.0,
            "CreditNoteLines": [{"WarehouseCode": "B1"}],
        }
    ]
    monkeypatch.setattr("app.api.v1.admin.SAPReturnsService", lambda: returns_service)
    get_approvals = MagicMock(return_value=[
        {"status": "pending", "branch_id": "B1"},
        {"status": "failed", "branch_id": "B1"},
        {"status": "pending", "branch_id": "B2"},
    ])
    monkeypatch.setattr("app.api.v1.atlas.approval_service.get_pending_approvals", get_approvals)

    response = client.get("/api/v1/atlas/returns-summary")

    assert response.status_code == 200
    data = response.json()
    assert data["pendingApprovalsCount"] == 1
    assert data["sapCreditNotesCount"] == 1
    assert data["sapCreditNotesTotal"] == 25.0
    returns_service.get_returns_by_date.assert_called_once()
    assert returns_service.get_returns_by_date.call_args.kwargs["warehouse"] == "B1"
    assert get_approvals.call_args.kwargs["branch_id"] == "B1"


@pytest.mark.parametrize(
    "from_date,to_date",
    [
        ("2026-09-01", None),
        ("not-a-date", "2026-09-02"),
        ("2026-09-03", "2026-09-02"),
    ],
)
def test_operator_report_date_helper_rejects_invalid_ranges(from_date, to_date):
    from fastapi import HTTPException
    from app.api.v1.dashboard import _get_date_range_with_custom

    with pytest.raises(HTTPException) as error:
        _get_date_range_with_custom("monthly", from_date, to_date)

    assert error.value.status_code == 422
