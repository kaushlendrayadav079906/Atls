import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.core.security import get_current_user

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}

@pytest.fixture
def client():
    """Test client with SAP mocked out."""
    with (
        patch("app.services.sap.client.SAPServiceLayerClient.login", return_value=True),
        patch("app.services.sap.items_service.SAPItemsService.get_items", return_value=[]),
    ):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "test", "branch_id": 1}
        with TestClient(app) as test_client:
            yield test_client

        app.dependency_overrides.clear()
