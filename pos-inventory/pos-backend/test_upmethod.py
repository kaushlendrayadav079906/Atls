from unittest.mock import patch
from app.services.sap.client import get_sap_client

@patch('app.services.sap.client.SAPServiceLayerClient.login')
@patch('app.services.sap.client.SAPServiceLayerClient.get')
def test_upmethod_scratch(mock_get, mock_login):
    mock_get.return_value = {"value": [{"DocEntry": 1, "U_P_Method": "Cash"}]}
    c = get_sap_client()
    c.login()
    res = c.get('Invoices', {'$top': 10, '$select': 'DocEntry,U_P_Method'})
    mock_login.assert_called_once()
    mock_get.assert_called_with('Invoices', {'$top': 10, '$select': 'DocEntry,U_P_Method'})
    assert "value" in res
