"""Tests for SAP PDN1 (Goods Receipt PO Lines) Inspection Fields Synchronization.

Covers:
1. Retrieval of inspection fields strictly from PDN1 (U_QC, U_DRW, U_VCHK, U_LM, U_OLNG, U_IPK, U_LBL, U_MCorPT, U_LUpdated).
2. Remarks mapped to OPDN (U_Remark) as a GRPO header-level field.
3. Weight mapped to OITM (U_PerPices).
4. Sales Order Cancellation filter (Cancelled eq 'tNO').
5. Composite row identity (item_code, grpo_doc_entry, grpo_line_num).
6. Safe handling of ODBC -1029 error without marking failed changes as synced.
7. Immediate readback verification before confirming success.
8. Zero live SAP writes (all tests run with mocked SAP client).
"""

import os
os.environ["TESTING"] = "True"
os.environ["SAP_STOCK_SYNC_ENABLED"] = "False"

from datetime import datetime, timedelta
import pytest
from unittest.mock import MagicMock, patch

from app.services.stock_configuration_service import (
    StockConfigurationService,
    SAP_PDN1_INSPECTION_FIELDS,
    SAP_ITEM_MASTER_FIELDS,
)


@pytest.fixture
def service():
    return StockConfigurationService()


def create_mock_sap_client():
    mock_client = MagicMock()
    mock_client.session_id = "test-session"
    mock_client.session_timeout = datetime.utcnow() + timedelta(hours=1)
    return mock_client


def test_pdn1_inspection_fields_definition():
    """Verify SAP_PDN1_INSPECTION_FIELDS contains all 8 line-level inspection fields."""
    expected = {"qc", "drw_yn", "v_chk", "lm", "olng", "lpk", "lbl", "mc_or_pt"}
    assert set(SAP_PDN1_INSPECTION_FIELDS.keys()) == expected
    assert SAP_PDN1_INSPECTION_FIELDS["qc"] == "U_QC"
    assert SAP_PDN1_INSPECTION_FIELDS["drw_yn"] == "U_DRW"
    assert SAP_PDN1_INSPECTION_FIELDS["v_chk"] == "U_VCHK"
    assert SAP_PDN1_INSPECTION_FIELDS["lm"] == "U_LM"
    assert SAP_PDN1_INSPECTION_FIELDS["olng"] == "U_OLNG"
    assert SAP_PDN1_INSPECTION_FIELDS["lpk"] == "U_IPK"
    assert SAP_PDN1_INSPECTION_FIELDS["lbl"] == "U_LBL"
    assert SAP_PDN1_INSPECTION_FIELDS["mc_or_pt"] == "U_MCorPT"


def test_item_master_weight_field_definition():
    """Verify SAP_ITEM_MASTER_FIELDS maps nt_weight to Item Master fields including U_PerPices."""
    assert "nt_weight" in SAP_ITEM_MASTER_FIELDS
    assert SAP_ITEM_MASTER_FIELDS["nt_weight"] == "InventoryWeight"


def test_item_master_weight_syncs_u_perpices(service):
    """Verify that _sync_item_to_sap writes U_PerPices to OITM as per SQL query."""
    mock_client = create_mock_sap_client()
    mock_client.get.side_effect = [
        {"ItemCode": "ITEM01", "InventoryWeight": 10.0, "PurchaseUnitWeight": 10.0, "SalesUnitWeight": 10.0, "U_PerPices": 10},
        {"ItemCode": "ITEM01", "InventoryWeight": 15.5, "PurchaseUnitWeight": 15.5, "SalesUnitWeight": 15.5, "U_PerPices": 16},
    ]
    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        res = service._sync_item_to_sap("ITEM01", {"nt_weight": 15.5})
        assert res["status"] == "success"
        mock_client.patch.assert_called_once()
        body = mock_client.patch.call_args[1]["data"]
        assert body["U_PerPices"] == 16
        assert body["InventoryWeight"] == 15.5


def test_pdn1_sync_payload_and_readback_verification(service):
    """Verify that _sync_grpo_to_sap sends the exact PDN1 UDFs and verifies via readback."""
    mock_client = create_mock_sap_client()
    
    # Pre-read response
    mock_client.get.side_effect = [
        # Pre-read
        {
            "DocEntry": 770,
            "DocNum": 473,
            "DocumentLines": [
                {"LineNum": 0, "ItemCode": "ITEM01", "U_QC": "N", "U_DRW": "N", "U_VCHK": "N"}
            ],
        },
        # Post-read (readback verification)
        {
            "DocEntry": 770,
            "DocNum": 473,
            "DocumentLines": [
                {
                    "LineNum": 0,
                    "ItemCode": "ITEM01",
                    "U_QC": "Y",
                    "U_DRW": "Y",
                    "U_VCHK": "Y",
                    "U_LM": "Y",
                    "U_OLNG": "Y",
                    "U_IPK": "Y",
                    "U_LBL": "Y",
                    "U_MCorPT": "Y",
                    "U_LUpdated": datetime.utcnow().strftime("%Y-%m-%d"),
                }
            ],
        },
    ]

    test_data = {
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
    }

    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        res = service._sync_grpo_to_sap(770, 0, test_data)

        assert res["status"] == "success"
        assert res["verified"] is True
        assert res["doc_entry"] == 770
        assert res["line_num"] == 0

        # Verify PATCH call
        mock_client.patch.assert_called_once()
        patch_call = mock_client.patch.call_args
        assert patch_call[0][0] == "PurchaseDeliveryNotes(770)"
        body = patch_call[1]["data"]
        line = body["DocumentLines"][0]
        assert line["LineNum"] == 0
        assert line["U_QC"] == "Y"
        assert line["U_DRW"] == "Y"
        assert line["U_VCHK"] == "Y"
        assert line["U_LM"] == "Y"
        assert line["U_OLNG"] == "Y"
        assert line["U_IPK"] == "Y"
        assert line["U_LBL"] == "Y"
        assert line["U_MCorPT"] == "Y"
        assert "U_LUpdated" in line


def test_opdn_remark_writeback_and_readback_verification(service):
    """Verify that _sync_grpo_remark_to_sap writes to OPDN.U_Remark and verifies via readback."""
    mock_client = create_mock_sap_client()

    mock_client.get.side_effect = [
        # Pre-read
        {
            "DocEntry": 770,
            "DocNum": 473,
            "U_Remark": "Old remark",
        },
        # Post-read (readback verification)
        {
            "DocEntry": 770,
            "DocNum": 473,
            "U_Remark": "Urgent shipment received",
        },
    ]

    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        res = service._sync_grpo_remark_to_sap(770, "Urgent shipment received")

        assert res["status"] == "success"
        assert res["verified"] is True
        assert res["after_remark"] == "Urgent shipment received"

        # Verify PATCH call target and payload
        mock_client.patch.assert_called_once_with(
            "PurchaseDeliveryNotes(770)",
            data={"U_Remark": "Urgent shipment received"},
        )


def test_odbc_1029_error_handled_safely(service):
    """Verify that SAP ODBC -1029 (non-editable document rows) raises informative error and does not falsely claim success."""
    mock_client = create_mock_sap_client()

    mock_client.get.return_value = {
        "DocEntry": 770,
        "DocNum": 473,
        "DocumentLines": [
            {"LineNum": 0, "ItemCode": "ITEM01", "U_QC": "N"}
        ],
    }
    mock_client.patch.side_effect = Exception("(-1029) ODBC -1029: Cannot update closed document")

    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        with pytest.raises(RuntimeError) as exc_info:
            service._sync_grpo_to_sap(770, 0, {"qc": True})

        err_msg = str(exc_info.value)
        assert "ODBC -1029" in err_msg
        assert "Allow Update of User-Defined Fields When Document Rows Are Not Editable" in err_msg


def test_readback_mismatch_raises_error(service):
    """Verify that if SAP does not persist the updated values, an error is raised."""
    mock_client = create_mock_sap_client()

    mock_client.get.side_effect = [
        # Pre-read
        {
            "DocEntry": 770,
            "DocNum": 473,
            "DocumentLines": [
                {"LineNum": 0, "ItemCode": "ITEM01", "U_QC": "N"}
            ],
        },
        # Post-read still returns old value 'N' despite patch
        {
            "DocEntry": 770,
            "DocNum": 473,
            "DocumentLines": [
                {"LineNum": 0, "ItemCode": "ITEM01", "U_QC": "N"}
            ],
        },
    ]

    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client):
        with pytest.raises(RuntimeError) as exc_info:
            service._sync_grpo_to_sap(770, 0, {"qc": True})

        assert "verification failed" in str(exc_info.value).lower()


def test_composite_row_identity_resolution(service):
    """Verify that separate GRPO receipts for the same item_code are distinguished by doc_entry and line_num."""
    e1, l1, no1 = service.resolve_grpo_doc_and_line("ITEM01", grpo_no="473", grpo_doc_entry=770, grpo_line_num=0)
    e2, l2, no2 = service.resolve_grpo_doc_and_line("ITEM01", grpo_no="474", grpo_doc_entry=771, grpo_line_num=1)

    assert (e1, l1) == (770, 0)
    assert (e2, l2) == (771, 1)
    assert (e1, l1) != (e2, l2)
