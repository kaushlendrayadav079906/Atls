"""Tests for SAP POR1 Inspection Fields Synchronization (Purchase Orders DocumentLines UDFs)."""

import os
os.environ["TESTING"] = "True"
os.environ["SAP_STOCK_SYNC_ENABLED"] = "False"

from datetime import datetime, timedelta
import pytest
from unittest.mock import MagicMock, patch

from app.services.stock_configuration_service import StockConfigurationService


@pytest.fixture
def service():
    return StockConfigurationService()


def create_mock_sap_client():
    mock_client = MagicMock()
    mock_client.session_id = "test-session"
    mock_client.session_timeout = datetime.utcnow() + timedelta(hours=1)
    return mock_client


def test_por1_payload_udf_mapping(service):
    """Verify that all 8 inspection fields and U_LUpdated map to their exact SAP POR1 UDFs."""
    test_data = {
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "N",
        "lm": "Y",
        "olng": "Y",
        "lpk": "N",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "last_submitted_at": "2026-11-18T10:00:00",
    }
    
    mock_client = create_mock_sap_client()
    pre_read_po = {
        "DocEntry": 871,
        "DocNum": 1378,
        "DocumentLines": [
            {"LineNum": 0, "ItemCode": "CS1124", "U_QC": "N", "U_DRW": "N", "U_VCHK": "Y"}
        ]
    }
    post_read_po = {
        "DocEntry": 871,
        "DocNum": 1378,
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
                "U_LUpdated": "2026-11-18",
            }
        ]
    }
    mock_client.get.side_effect = [pre_read_po, post_read_po]
    
    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        res = service._sync_por1_to_sap(871, 0, test_data)
        
        assert res["status"] == "success"
        assert res["verified"] is True
        assert res["doc_entry"] == 871
        assert res["line_num"] == 0
        
        # Verify PATCH call target and payload structure
        mock_client.patch.assert_called_once()
        call_args = mock_client.patch.call_args
        assert call_args[0][0] == "PurchaseOrders(871)"
        patch_body = call_args[1]["data"]
        
        assert "DocumentLines" in patch_body
        assert len(patch_body["DocumentLines"]) == 1
        line = patch_body["DocumentLines"][0]
        
        # Exact POR1 UDF verifications
        assert line["LineNum"] == 0
        assert line["U_QC"] == "Y"
        assert line["U_DRW"] == "Y"
        assert line["U_VCHK"] == "N"
        assert line["U_LM"] == "Y"
        assert line["U_OLNG"] == "Y"
        assert line["U_IPK"] == "N"
        assert line["U_LBL"] == "Y"
        assert line["U_MCorPT"] == "Y"
        assert line["U_LUpdated"] == "2026-11-18"


def test_correct_po_document_line_selection(service):
    """Verify that when po_doc_entry and po_line_num are provided, the exact line is targeted directly."""
    doc_entry, line_num, po_no = service.resolve_po_doc_and_line(
        item_code="CS1124",
        po_no="1378",
        po_doc_entry=871,
        po_line_num=2,
    )
    assert doc_entry == 871
    assert line_num == 2
    assert po_no == "1378"


def test_resolve_missing_identifiers_using_docnum_and_item_code(service):
    """Verify that when po_doc_entry and line_num are missing, they are resolved via DocNum and ItemCode."""
    mock_client = create_mock_sap_client()
    mock_client.get.return_value = {
        "value": [
            {
                "DocEntry": 871,
                "DocNum": 1378,
                "DocumentLines": [
                    {"LineNum": 0, "ItemCode": "OTHER_ITEM"},
                    {"LineNum": 3, "ItemCode": "CS1124_TEST"},
                ]
            }
        ]
    }
    
    with patch.object(service, "get_item", return_value=None), \
         patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        doc_entry, line_num, po_no = service.resolve_po_doc_and_line(
            item_code="CS1124_TEST",
            po_no="1378",
            po_doc_entry=None,
            po_line_num=None,
        )
        assert doc_entry == 871
        assert line_num == 3
        assert po_no == "1378"


def test_resolve_via_grpo_base_entry_and_baseline(service):
    """Verify that when PO is not directly resolved, it can be resolved via GRPO BaseEntry and BaseLine."""
    mock_client = create_mock_sap_client()
    
    # 1. First call to PurchaseDeliveryNotes returns GRPO with BaseEntry=871, BaseLine=1, BaseType=22
    grpo_response = {
        "value": [
            {
                "DocEntry": 770,
                "DocNum": 473,
                "DocumentLines": [
                    {
                        "LineNum": 0,
                        "ItemCode": "CS1124_TEST",
                        "BaseType": 22,
                        "BaseEntry": 871,
                        "BaseLine": 1,
                    }
                ]
            }
        ]
    }
    # 2. Lookup of PurchaseOrders(871)
    po_response = {
        "DocEntry": 871,
        "DocNum": 1378,
        "DocumentLines": [
            {"LineNum": 1, "ItemCode": "CS1124_TEST"}
        ]
    }
    mock_client.get.side_effect = [grpo_response, po_response]
    
    with patch.object(service, "get_item", return_value=None), \
         patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        doc_entry, line_num, po_no = service.resolve_po_doc_and_line(
            item_code="CS1124_TEST",
            po_no=None,
            grpo_no="473",
        )
        assert doc_entry == 871
        assert line_num == 1
        assert po_no == "1378"


def test_reject_ambiguous_multiple_po_documents_with_same_item(service):
    """Reject resolution when multiple PO documents with the same DocNum contain the target item."""
    mock_client = create_mock_sap_client()
    mock_client.get.return_value = {
        "value": [
            {
                "DocEntry": 871,
                "DocNum": 1378,
                "DocumentLines": [{"LineNum": 0, "ItemCode": "CS1124_TEST"}]
            },
            {
                "DocEntry": 872,
                "DocNum": 1378,
                "DocumentLines": [{"LineNum": 0, "ItemCode": "CS1124_TEST"}]
            }
        ]
    }
    
    with patch.object(service, "get_item", return_value=None), \
         patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        with pytest.raises(ValueError, match="Ambiguous match: Item 'CS1124_TEST' found in multiple Purchase Order documents"):
            service.resolve_po_doc_and_line("CS1124_TEST", po_no="1378")


def test_reject_ambiguous_multiple_lines_in_same_po(service):
    """Reject resolution when an item appears on multiple lines of the same PO and no line_num was provided."""
    mock_client = create_mock_sap_client()
    mock_client.get.return_value = {
        "value": [
            {
                "DocEntry": 871,
                "DocNum": 1378,
                "DocumentLines": [
                    {"LineNum": 0, "ItemCode": "CS1124_TEST"},
                    {"LineNum": 2, "ItemCode": "CS1124_TEST"},
                ]
            }
        ]
    }
    
    with patch.object(service, "get_item", return_value=None), \
         patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        with pytest.raises(ValueError, match="Ambiguous match: Item 'CS1124_TEST' appears on multiple lines"):
            service.resolve_po_doc_and_line("CS1124_TEST", po_no="1378")


def test_missing_po_number_raises_error(service):
    """Verify error when no Purchase Order number exists on item or in payload and cannot be resolved."""
    with patch.object(service, "get_item", return_value={"item_code": "CS9999", "po_no": "", "grpo_no": ""}):
        with pytest.raises(ValueError, match="No associated Purchase Order found"):
            service.resolve_po_doc_and_line("CS9999", po_no="")


def test_por1_sap_error_handling(service):
    """Verify error handling when SAP Service Layer returns an error on POR1 PATCH."""
    mock_client = create_mock_sap_client()
    mock_client.get.return_value = {
        "DocEntry": 871,
        "DocNum": 1378,
        "DocumentLines": [{"LineNum": 0, "ItemCode": "CS1124", "U_QC": "N"}]
    }
    mock_client.patch.side_effect = RuntimeError("Service Layer internal error (500)")
    
    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        with patch.dict(os.environ, {"TESTING": "False"}):
            with pytest.raises(RuntimeError, match="SAP write-back rejected by SAP Service Layer for PurchaseOrders"):
                service._sync_por1_to_sap(871, 0, {"qc": True})


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
        assert "U_DRW" not in patch_payload
        assert "U_V_Chk" not in patch_payload
        assert "U_VCHK" not in patch_payload
        assert "U_LM" not in patch_payload
        assert "U_OLNG" not in patch_payload
        assert "U_LPK" not in patch_payload
        assert "U_IPK" not in patch_payload
        assert "U_LBL" not in patch_payload
        assert "U_MC_OR_PT" not in patch_payload
        assert "U_MCorPT" not in patch_payload


def test_sync_po_to_sap_u_remark_opor(service):
    """Verify that _sync_po_to_sap updates U_Remark on OPOR and does NOT update Comments."""
    mock_client = create_mock_sap_client()
    mock_client.get.side_effect = [
        {"DocEntry": 871, "DocNum": 1378, "U_Remark": "Old Remark"},
        {"DocEntry": 871, "DocNum": 1378, "U_Remark": "New Verified Remark"}
    ]
    
    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        res = service._sync_po_to_sap(871, "New Verified Remark")
        assert res["status"] == "success"
        assert res["u_remark"] == "New Verified Remark"
        assert res["verified"] is True
        
        # Verify PATCH call
        mock_client.patch.assert_called_once()
        call_target = mock_client.patch.call_args[0][0]
        call_data = mock_client.patch.call_args[1]["data"]
        assert call_target == "PurchaseOrders(871)"
        assert "U_Remark" in call_data
        assert call_data["U_Remark"] == "New Verified Remark"
        assert "Comments" not in call_data


def test_update_item_orchestration_por1_and_por1_response(service):
    """Verify that update_item correctly routes inspection fields to POR1 and returns por1 in response."""
    mock_por1_sync = {
        "doc_entry": 871,
        "doc_num": 1378,
        "line_num": 0,
        "status": "success",
        "verified": True,
        "sap_written": True,
        "sap_synced": True,
        "por1_fields": ["U_QC", "U_DRW", "U_LUpdated"],
        "after_values": {"U_QC": "Y", "U_DRW": "Y", "U_LUpdated": "2026-11-18"},
        "message": "Purchase Order 1378 line 0 inspection values saved and verified in SAP.",
    }
    
    with patch.object(service, "resolve_po_doc_and_line", return_value=(871, 0, "1378")), \
         patch.object(service, "_sync_por1_to_sap", return_value=mock_por1_sync):
        
        result = service.update_item(
            item_code="CS1124",
            data={
                "qc": True,
                "drw_yn": "Y",
                "po_no": "1378",
                "po_doc_entry": 871,
                "po_line_num": 0,
            },
            admin_user_id="admin",
        )
        
        assert result["success"] is True
        assert "por1" in result
        assert result["por1"]["status"] == "success"
        assert result["por1"]["doc_entry"] == 871
        assert result["por1"]["line_num"] == 0
        assert result["po_line"]["line_num"] == 0
        assert result["item"]["qc"] is True
        assert result["item"]["drw_yn"] == "Y"
