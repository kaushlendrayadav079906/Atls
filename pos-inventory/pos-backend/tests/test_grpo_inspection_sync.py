"""Tests for SAP GRPO Inspection Fields Synchronization (PDN1 UDFs)."""

import os
os.environ["TESTING"] = "True"
os.environ["SAP_STOCK_SYNC_ENABLED"] = "False"

from datetime import datetime, timedelta
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.stock_configuration_service import StockConfigurationService


@pytest.fixture
def service():
    return StockConfigurationService()


def create_mock_sap_client():
    mock_client = MagicMock()
    mock_client.session_id = "test-session"
    mock_client.session_timeout = datetime.utcnow() + timedelta(hours=1)
    return mock_client


def test_grpo_payload_udf_mapping(service):
    """Verify that all 8 inspection fields map to their exact SAP PDN1 UDFs."""
    test_data = {
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "N",
        "lm": "Y",
        "olng": "Y",
        "lpk": "N",
        "lbl": "Y",
        "mc_or_pt": "Y",
    }
    
    mock_client = create_mock_sap_client()
    mock_client.get.side_effect = [
        {
            "DocEntry": 770,
            "DocNum": 473,
            "DocumentLines": [
                {"LineNum": 0, "ItemCode": "CS1124", "U_QC": "N", "U_DRW": "N", "U_VCHK": "Y"}
            ]
        },
        {
            "DocEntry": 770,
            "DocNum": 473,
            "DocumentLines": [
                {
                    "LineNum": 0,
                    "ItemCode": "CS1124",
                    "U_QC": "Y",
                    "U_DRW": "Y",
                    "U_VCHK": "N",
                    "U_LM": "Y",
                    "U_OLNG": "Y",
                    "U_IPK": "N",
                    "U_LBL": "Y",
                    "U_MCorPT": "Y",
                    "U_LUpdated": datetime.utcnow().strftime("%Y-%m-%d"),
                }
            ]
        }
    ]
    
    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        res = service._sync_grpo_to_sap(770, 0, test_data)
        
        assert res["status"] == "success"
        assert res["verified"] is True
        assert res["doc_entry"] == 770
        assert res["line_num"] == 0
        
        # Verify PATCH call target and payload structure
        mock_client.patch.assert_called_once()
        call_args = mock_client.patch.call_args
        assert call_args[0][0] == "PurchaseDeliveryNotes(770)"
        patch_body = call_args[1]["data"]
        
        assert "DocumentLines" in patch_body
        assert len(patch_body["DocumentLines"]) == 1
        line = patch_body["DocumentLines"][0]
        
        # Exact PDN1 UDF verifications
        assert line["LineNum"] == 0
        assert line["U_QC"] == "Y"
        assert line["U_DRW"] == "Y"
        assert line["U_VCHK"] == "N"
        assert line["U_LM"] == "Y"
        assert line["U_OLNG"] == "Y"
        assert line["U_IPK"] == "N"
        assert line["U_LBL"] == "Y"
        assert line["U_MCorPT"] == "Y"


def test_correct_document_line_selection(service):
    """Verify that when grpo_doc_entry and grpo_line_num are provided, the exact line is targeted."""
    doc_entry, line_num, grpo_no = service.resolve_grpo_doc_and_line(
        item_code="CS1124",
        grpo_no="473",
        grpo_doc_entry=770,
        grpo_line_num=1,
    )
    assert doc_entry == 770
    assert line_num == 1
    assert grpo_no == "473"


def test_resolve_missing_identifiers_using_docnum_and_item_code(service):
    """Verify that when grpo_doc_entry and line_num are missing, they are resolved via DocNum and ItemCode."""
    mock_client = create_mock_sap_client()
    mock_client.get.return_value = {
        "value": [
            {
                "DocEntry": 770,
                "DocNum": 473,
                "DocumentLines": [
                    {"LineNum": 0, "ItemCode": "OTHER_ITEM"},
                    {"LineNum": 3, "ItemCode": "CS1124"},
                ]
            }
        ]
    }
    
    with patch.object(service, "get_item", return_value=None), \
         patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        doc_entry, line_num, grpo_no = service.resolve_grpo_doc_and_line(
            item_code="CS1124",
            grpo_no="473",
            grpo_doc_entry=None,
            grpo_line_num=None,
        )
        assert doc_entry == 770
        assert line_num == 3
        assert grpo_no == "473"


def test_reject_ambiguous_multiple_grpo_documents_with_same_item(service):
    """Reject resolution when multiple GRPO documents with the same DocNum contain the target item."""
    mock_client = create_mock_sap_client()
    mock_client.get.return_value = {
        "value": [
            {
                "DocEntry": 101,
                "DocNum": 473,
                "DocumentLines": [{"LineNum": 0, "ItemCode": "CS1124"}]
            },
            {
                "DocEntry": 102,
                "DocNum": 473,
                "DocumentLines": [{"LineNum": 0, "ItemCode": "CS1124"}]
            }
        ]
    }
    
    with patch.object(service, "get_item", return_value=None), \
         patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        with pytest.raises(ValueError, match="Ambiguous match: Item 'CS1124' found in multiple GRPO documents"):
            service.resolve_grpo_doc_and_line("CS1124", grpo_no="473")


def test_reject_ambiguous_multiple_lines_in_same_grpo(service):
    """Reject resolution when an item appears on multiple lines of the same GRPO and no line_num was provided."""
    mock_client = create_mock_sap_client()
    mock_client.get.return_value = {
        "value": [
            {
                "DocEntry": 770,
                "DocNum": 473,
                "DocumentLines": [
                    {"LineNum": 0, "ItemCode": "CS1124"},
                    {"LineNum": 2, "ItemCode": "CS1124"},
                ]
            }
        ]
    }
    
    with patch.object(service, "get_item", return_value=None), \
         patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        with pytest.raises(ValueError, match="Ambiguous match: Item 'CS1124' appears on multiple lines"):
            service.resolve_grpo_doc_and_line("CS1124", grpo_no="473")


def test_missing_grpo_number_raises_error(service):
    """Verify error when no GRPO number exists on item or in payload."""
    with patch.object(service, "get_item", return_value={"item_code": "CS9999", "grpo_no": ""}):
        with pytest.raises(ValueError, match="No associated GRPO Number found"):
            service.resolve_grpo_doc_and_line("CS9999", grpo_no="")


def test_grpo_sap_error_handling(service):
    """Verify error handling when SAP Service Layer returns an error on PATCH."""
    mock_client = create_mock_sap_client()
    mock_client.get.return_value = {
        "DocEntry": 770,
        "DocNum": 473,
        "DocumentLines": [{"LineNum": 0, "ItemCode": "CS1124", "U_QC": "N"}]
    }
    mock_client.patch.side_effect = RuntimeError("Service Layer internal error (500)")
    
    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        with patch.dict(os.environ, {"TESTING": "False"}):
            with pytest.raises(RuntimeError, match="PurchaseDeliveryNotes"):
                service._sync_grpo_to_sap(770, 0, {"qc": True})


def test_oitm_inspection_fields_not_modified_in_sync_item(service):
    """Verify that _sync_item_to_sap only updates weight fields and NEVER modifies OITM inspection fields."""
    mock_client = create_mock_sap_client()
    pre_read_response = {
        "ItemCode": "CS1124",
        "InventoryWeight": 10.0,
        "PurchaseUnitWeight": 10.0,
        "SalesUnitWeight": 10.0,
        "U_PerPices": 10,
    }
    post_read_response = {
        "ItemCode": "CS1124",
        "InventoryWeight": 25.0,
        "PurchaseUnitWeight": 25.0,
        "SalesUnitWeight": 25.0,
        "U_PerPices": 25,
    }
    mock_client.get.side_effect = [pre_read_response, post_read_response]
    
    payload_with_inspections = {
        "nt_weight": 25.0,
        "qc": "Y",
        "drw_yn": "Y",
        "v_chk": "Y",
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
    }
    
    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        res = service._sync_item_to_sap("CS1124", payload_with_inspections)
        assert res["status"] == "success"
        
        # Verify PATCH call
        mock_client.patch.assert_called_once()
        patch_payload = mock_client.patch.call_args[1]["data"]
        
        # Weight fields must be present
        assert "InventoryWeight" in patch_payload
        assert "U_PerPices" in patch_payload
        
        # Inspection fields must NOT be present in OITM PATCH payload
        assert "U_QC" not in patch_payload
        assert "U_Drawing" not in patch_payload
        assert "U_V_Chk" not in patch_payload
        assert "U_LM" not in patch_payload
        assert "U_OLNG" not in patch_payload
        assert "U_LPK" not in patch_payload
        assert "U_LBL" not in patch_payload
        assert "U_MC_OR_PT" not in patch_payload
