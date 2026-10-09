from unittest.mock import patch
from app.services.sap.client import get_sap_client

@patch('app.services.sap.client.SAPServiceLayerClient.login')
@patch('app.services.sap.client.SAPServiceLayerClient.get')
def test_incoming_payments_scratch(mock_get, mock_login):
    mock_get.return_value = {"value": [{"DocEntry": 1}]}
    c = get_sap_client()
    c.login()
    res = c.get('IncomingPayments', {'$top': 1})
    mock_login.assert_called_once()
    mock_get.assert_called_with('IncomingPayments', {'$top': 1})
    assert "value" in res
