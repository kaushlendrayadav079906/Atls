"""Tests for:
1. POR1 read-side synchronization (refresh_live_stock_from_sap and sync_from_sap).
2. Multiple GRPO records linked to the same PO line.
3. Persistence of po_line_num, grpo_doc_entry, and grpo_line_num across schema, upserts, and fallback.
4. Database fallback using mocked MySQL connection failures.
"""

import os
os.environ["TESTING"] = "True"
os.environ["SAP_STOCK_SYNC_ENABLED"] = "False"

from contextlib import contextmanager
from datetime import datetime, timedelta
import pytest
from unittest.mock import MagicMock, patch

from app.db.connection import is_db_connection_error
from app.services.stock_configuration_service import StockConfigurationService, COLUMNS


@pytest.fixture
def service():
    return StockConfigurationService()


def create_mock_sap_client():
    mock_client = MagicMock()
    mock_client.session_id = "test-session-por1"
    mock_client.session_timeout = datetime.now() + timedelta(hours=2)
    return mock_client


@contextmanager
def create_mock_db_connection():
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = (0,)
    mock_cursor.fetchall.return_value = []
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    yield mock_conn


# ==============================================================================
# 1. POR1 Read-Side Synchronization Tests
# ==============================================================================

def test_refresh_live_stock_retrieves_por1_and_ignores_oitm(service):
    """Verify that refresh_live_stock_from_sap retrieves inspection fields from POR1 and ignores OITM."""
    mock_client = create_mock_sap_client()

    target_code = "ITEM_POR1_TEST"
    po_entry = 871
    po_line = 1

    # 1. Purchase Orders endpoint returns PO 871 with POR1 inspection fields set
    mock_po = {
        "DocEntry": po_entry,
        "DocNum": 1378,
        "DocDate": "2026-11-18",
        "CardCode": "V100",
        "CardName": "Vendor One",
        "U_Remark": "POR1 Read-Side Test Remark",
        "Cancelled": "tNO",
        "DocumentLines": [
            {
                "LineNum": 0,
                "ItemCode": "OTHER_ITEM",
                "Quantity": 10.0,
            },
            {
                "LineNum": po_line,
                "ItemCode": target_code,
                "Quantity": 50.0,
                # POR1 Inspection UDF values:
                "U_QC": "Y",
                "U_DRW": "Y",
                "U_VCHK": "N",
                "U_LM": "Y",
                "U_OLNG": "N",
                "U_IPK": "Y",
                "U_LBL": "N",
                "U_MCorPT": "Y",
                "U_LUpdated": "2026-11-18",
            }
        ]
    }

    # 2. PurchaseDeliveryNotes endpoint returns GRPO linking to PO 871 Line 1
    mock_grpo = {
        "DocEntry": 771,
        "DocNum": 474,
        "DocDate": "2026-11-19",
        "CardCode": "V100",
        "CardName": "Vendor One",
        "U_Remark": "GRPO Read-Side Test Remark",
        "Cancelled": "tNO",
        "DocumentLines": [
            {
                "LineNum": 0,
                "ItemCode": target_code,
                "Quantity": 25.0,
                "RemainingOpenQuantity": 20.0,
                "BaseType": 22,
                "BaseEntry": po_entry,
                "BaseLine": po_line,
                # PDN1 Inspection UDF values:
                "U_QC": "Y",
                "U_DRW": "Y",
                "U_VCHK": "N",
                "U_LM": "Y",
                "U_OLNG": "N",
                "U_IPK": "Y",
                "U_LBL": "N",
                "U_MCorPT": "Y",
                "U_LUpdated": "2026-11-18",
            }
        ]
    }

    # 3. Item Master endpoint returns OITM with conflicting / legacy inspection UDFs
    # These must NOT be used because POR1 is the authoritative source!
    mock_item = {
        "ItemCode": target_code,
        "ItemName": "POR1 Verification Item",
        "QuantityOnStock": 100.0,
        "Valid": "tYES",
        "Frozen": "tNO",
        "PurchaseUnitWeight": 15.5,
        "U_PerPices": 16,
        # Conflicting OITM values that MUST BE IGNORED:
        "U_QC": "N",
        "U_Drawing": "N",
        "U_V_Chk": "Y",
        "U_LM": "N",
        "U_OLNG": "Y",
        "U_LPK": "N",
        "U_LBL": "Y",
        "U_MC_OR_PT": "N",
    }

    def mock_get(endpoint, params=None):
        if "PurchaseDeliveryNotes" in endpoint:
            return {"value": [mock_grpo]}
        if "PurchaseOrders" in endpoint:
            if f"PurchaseOrders({po_entry})" in endpoint:
                return mock_po
            return {"value": [mock_po]}
        if "Items" in endpoint:
            return {"value": [mock_item]}
        if "Orders" in endpoint:
            return {"value": []}
        return {"value": []}

    mock_client.get.side_effect = mock_get

    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client), \
         patch.object(service, "_get_connection", side_effect=create_mock_db_connection), \
         patch.object(service, "_upsert_sap_items_cursor", return_value=1) as mock_upsert:

        service.refresh_live_stock_from_sap(item_codes=[target_code])

        assert mock_upsert.called
        call_args = mock_upsert.call_args[0]
        received_map = call_args[3]

        assert target_code in received_map
        rm_item = received_map[target_code]

        # Verify identifiers
        assert rm_item["po_doc_entry"] == po_entry
        assert rm_item["po_line_num"] == po_line
        assert rm_item["grpo_doc_entry"] == 771
        assert rm_item["grpo_line_num"] == 0
        assert rm_item["po_qty"] == 50.0
        assert rm_item["rcvd_qty"] == 25.0
        assert rm_item["ok_qty"] == 20.0
        assert rm_item["rej_qty"] == 5.0

        # Verify all 9 POR1 inspection fields match POR1 and NOT OITM
        assert rm_item["qc"] is True              # POR1 is 'Y', OITM was 'N'
        assert rm_item["drw_yn"] == "Y"           # POR1 is 'Y', OITM was 'N'
        assert rm_item["v_chk"] == "N"            # POR1 is 'N', OITM was 'Y'
        assert rm_item["lm"] == "Y"               # POR1 is 'Y', OITM was 'N'
        assert rm_item["olng"] == "N"             # POR1 is 'N', OITM was 'Y'
        assert rm_item["lpk"] == "Y"              # POR1 is 'Y', OITM was 'N'
        assert rm_item["lbl"] == "N"              # POR1 is 'N', OITM was 'Y'
        assert rm_item["mc_or_pt"] == "Y"         # POR1 is 'Y', OITM was 'N'
        assert rm_item["last_submitted_at"] == "2026-11-18"


def test_sync_from_sap_retrieves_por1_and_preserves_identifiers(service):
    """Verify that sync_from_sap retrieves inspection fields from POR1 DocumentLines and preserves identifiers."""
    mock_client = create_mock_sap_client()

    target_code = "SYNC_ITEM_TEST"
    po_entry = 872
    po_line = 3

    mock_po = {
        "DocEntry": po_entry,
        "DocNum": 1379,
        "DocDate": "2026-11-18",
        "CardCode": "V200",
        "CardName": "Vendor Two",
        "U_Remark": "Sync Test Remark",
        "Cancelled": "tNO",
        "DocumentLines": [
            {
                "LineNum": 3,
                "ItemCode": target_code,
                "Quantity": 100.0,
                "U_QC": "N",
                "U_DRW": "N",
                "U_VCHK": "Y",
                "U_LM": "N",
                "U_OLNG": "Y",
                "U_IPK": "N",
                "U_LBL": "Y",
                "U_MCorPT": "N",
                "U_LUpdated": "2026-11-17",
            }
        ]
    }

    mock_grpo = {
        "DocEntry": 772,
        "DocNum": 475,
        "DocDate": "2026-11-19",
        "CardCode": "V200",
        "CardName": "Vendor Two",
        "U_Remark": "Sync Test Remark",
        "Cancelled": "tNO",
        "DocumentLines": [
            {
                "LineNum": 1,
                "ItemCode": target_code,
                "Quantity": 40.0,
                "RemainingOpenQuantity": 35.0,
                "BaseType": 22,
                "BaseEntry": po_entry,
                "BaseLine": po_line,
                "U_QC": "N",
                "U_DRW": "N",
                "U_VCHK": "Y",
                "U_LM": "N",
                "U_OLNG": "Y",
                "U_IPK": "N",
                "U_LBL": "Y",
                "U_MCorPT": "N",
                "U_LUpdated": "2026-11-17",
            }
        ]
    }

    mock_item = {
        "ItemCode": target_code,
        "ItemName": "Sync Test Item",
        "QuantityOnStock": 80.0,
        "Valid": "tYES",
        "Frozen": "tNO",
        "PurchaseUnitWeight": 20.0,
        "U_PerPices": 20,
    }

    def mock_get(endpoint, params=None):
        if "PurchaseDeliveryNotes" in endpoint:
            return {"value": [mock_grpo]}
        if "PurchaseOrders" in endpoint:
            if f"PurchaseOrders({po_entry})" in endpoint:
                return mock_po
            return {"value": [mock_po]}
        if "Items" in endpoint:
            return {"value": [mock_item]}
        if "Orders" in endpoint:
            return {"value": []}
        return {"value": []}

    mock_client.get.side_effect = mock_get

    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client), \
         patch("app.services.sap.items_service.SAPItemsService.get_items", return_value=[mock_item]), \
         patch.object(service, "_get_connection", side_effect=create_mock_db_connection), \
         patch.object(service, "_upsert_sap_items_cursor", return_value=1) as mock_upsert:

        res = service.sync_from_sap(top=10)
        assert res["success"] is True

        assert mock_upsert.called
        call_args = mock_upsert.call_args[0]
        received_map = call_args[3]

        assert target_code in received_map
        rm_item = received_map[target_code]

        assert rm_item["po_doc_entry"] == po_entry
        assert rm_item["po_line_num"] == po_line
        assert rm_item["grpo_doc_entry"] == 772
        assert rm_item["grpo_line_num"] == 1
        assert rm_item["qc"] is False
        assert rm_item["drw_yn"] == "N"
        assert rm_item["v_chk"] == "Y"
        assert rm_item["lm"] == "N"
        assert rm_item["olng"] == "Y"
        assert rm_item["lpk"] == "N"
        assert rm_item["lbl"] == "Y"
        assert rm_item["mc_or_pt"] == "N"
        assert rm_item["last_submitted_at"] == "2026-11-17"


# ==============================================================================
# 2. Multiple GRPO Records Linked to the Same PO Line
# ==============================================================================

def test_multiple_grpos_linked_to_same_po_line(service):
    """Verify that multiple GRPOs pointing to the same PO line link to the exact same PO line and preserve POR1 UDFs."""
    mock_client = create_mock_sap_client()

    target_code = "MULTI_GRPO_ITEM"
    po_entry = 880
    po_line = 0

    mock_po = {
        "DocEntry": po_entry,
        "DocNum": 1400,
        "DocDate": "2026-11-10",
        "CardCode": "V300",
        "CardName": "Vendor Three",
        "Cancelled": "tNO",
        "DocumentLines": [
            {
                "LineNum": po_line,
                "ItemCode": target_code,
                "Quantity": 100.0,
                "U_QC": "Y",
                "U_DRW": "Y",
                "U_VCHK": "Y",
                "U_LM": "Y",
                "U_OLNG": "Y",
                "U_IPK": "Y",
                "U_LBL": "Y",
                "U_MCorPT": "Y",
                "U_LUpdated": "2026-11-10",
            }
        ]
    }

    # Two GRPOs representing partial shipments for the same PO line:
    # GRPO 1 (DocEntry 601, Line 0) - Earlier shipment of 40
    # GRPO 2 (DocEntry 602, Line 0) - Later shipment of 60
    mock_grpos = [
        {
            "DocEntry": 602,
            "DocNum": 502,
            "DocDate": "2026-11-15",
            "CardCode": "V300",
            "CardName": "Vendor Three",
            "Cancelled": "tNO",
            "DocumentLines": [
                {
                    "LineNum": 0,
                    "ItemCode": target_code,
                    "Quantity": 60.0,
                    "RemainingOpenQuantity": 55.0,
                    "BaseType": 22,
                    "BaseEntry": po_entry,
                    "BaseLine": po_line,
                    "U_QC": "Y",
                    "U_DRW": "Y",
                    "U_VCHK": "Y",
                    "U_LM": "Y",
                    "U_OLNG": "Y",
                    "U_IPK": "Y",
                    "U_LBL": "Y",
                    "U_MCorPT": "Y",
                    "U_LUpdated": "2026-11-10",
                }
            ]
        },
        {
            "DocEntry": 601,
            "DocNum": 501,
            "DocDate": "2026-11-12",
            "CardCode": "V300",
            "CardName": "Vendor Three",
            "Cancelled": "tNO",
            "DocumentLines": [
                {
                    "LineNum": 0,
                    "ItemCode": target_code,
                    "Quantity": 40.0,
                    "RemainingOpenQuantity": 40.0,
                    "BaseType": 22,
                    "BaseEntry": po_entry,
                    "BaseLine": po_line,
                }
            ]
        }
    ]

    mock_item = {
        "ItemCode": target_code,
        "ItemName": "Multi GRPO Item",
        "QuantityOnStock": 100.0,
        "Valid": "tYES",
        "Frozen": "tNO",
        "PurchaseUnitWeight": 10.0,
        "U_PerPices": 10,
    }

    def mock_get(endpoint, params=None):
        if "PurchaseDeliveryNotes" in endpoint:
            return {"value": mock_grpos}
        if "PurchaseOrders" in endpoint:
            if f"PurchaseOrders({po_entry})" in endpoint:
                return mock_po
            return {"value": [mock_po]}
        if "Items" in endpoint:
            return {"value": [mock_item]}
        if "Orders" in endpoint:
            return {"value": []}
        return {"value": []}

    mock_client.get.side_effect = mock_get

    with patch("app.services.stock_configuration_service.get_sap_client", return_value=mock_client), \
         patch.object(service, "_get_connection", side_effect=create_mock_db_connection), \
         patch.object(service, "_upsert_sap_items_cursor", return_value=1) as mock_upsert:

        service.refresh_live_stock_from_sap(item_codes=[target_code])

        assert mock_upsert.called
        call_args = mock_upsert.call_args[0]
        received_map = call_args[3]

        assert target_code in received_map
        rm_item = received_map[target_code]

        # The newest GRPO (602 / 502) is recorded as the active delivery context
        assert rm_item["grpo_doc_entry"] == 602
        assert rm_item["grpo_no"] == "502"
        assert rm_item["grpo_line_num"] == 0
        assert rm_item["rcvd_qty"] == 60.0

        # Both GRPOs correctly resolve the exact same PO line
        assert rm_item["po_doc_entry"] == po_entry
        assert rm_item["po_line_num"] == po_line
        assert rm_item["po_qty"] == 100.0

        # POR1 inspection fields are extracted accurately from PO line 0
        assert rm_item["qc"] is True
        assert rm_item["drw_yn"] == "Y"
        assert rm_item["v_chk"] == "Y"
        assert rm_item["mc_or_pt"] == "Y"


# ==============================================================================
# 3. Persistence of Document Identifiers
# ==============================================================================

def test_document_identifiers_present_in_columns_and_schema():
    """Verify that po_line_num, grpo_doc_entry, and grpo_line_num are tracked in COLUMNS."""
    assert "po_doc_entry" in COLUMNS
    assert "po_line_num" in COLUMNS
    assert "grpo_doc_entry" in COLUMNS
    assert "grpo_line_num" in COLUMNS


def test_upsert_preserves_document_identifiers(service):
    """Verify that _upsert_sap_items_cursor constructs row tuples with identifiers and uses COALESCE."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = (0,)
    mock_cursor.fetchall.return_value = []
    mock_conn = MagicMock()

    s_items = [
        {
            "ItemCode": "PERSIST_TEST",
            "ItemName": "Persistence Test Item",
            "QuantityOnStock": 50.0,
            "Valid": "tYES",
            "Frozen": "tNO",
            "Mainsupplier": "V001",
        }
    ]

    received_map = {
        "PERSIST_TEST": {
            "grpo_no": "GRPO_999",
            "grpo_doc_entry": 999,
            "grpo_line_num": 2,
            "rcvd_qty": 20.0,
            "ok_qty": 18.0,
            "rej_qty": 2.0,
            "po_no": "PO_888",
            "po_doc_entry": 888,
            "po_line_num": 1,
            "po_qty": 50.0,
            "qc": True,
            "drw_yn": "Y",
            "v_chk": "Y",
            "lm": "Y",
            "olng": "Y",
            "lpk": "Y",
            "lbl": "Y",
            "mc_or_pt": "Y",
            "vendor_name": "Vendor Test",
            "vendor_code": "V001",
        }
    }

    service._upsert_sap_items_cursor(mock_cursor, mock_conn, s_items, received_map, {})

    assert mock_cursor.executemany.called
    call_args = mock_cursor.executemany.call_args
    sql_query = call_args[0][0]
    rows = call_args[0][1]

    assert len(rows) == 1
    row = rows[0]

    # In row tuple: po_doc_entry, po_line_num, grpo_doc_entry, grpo_line_num
    assert 888 in row
    assert 1 in row
    assert 999 in row
    assert 2 in row

    # Verify SQL query includes columns and preserves existing values
    assert "po_doc_entry" in sql_query
    assert "po_line_num" in sql_query
    assert "grpo_doc_entry" in sql_query
    assert "grpo_line_num" in sql_query
    assert "COALESCE" in sql_query or "ON DUPLICATE KEY UPDATE" in sql_query


# ==============================================================================
# 4. Database Fallback Exception Handling Tests (Mocked MySQL / Connection Failures)
# ==============================================================================

def test_is_db_connection_error_detection():
    """Verify that is_db_connection_error accurately detects DB connection failures and rejects non-DB errors."""
    import pymysql

    # Legitimate connection / circuit-breaker failures:
    assert is_db_connection_error(ConnectionError("Connection refused")) is True
    assert is_db_connection_error(TimeoutError("Timed out waiting for an available MySQL connection from pool.")) is True
    assert is_db_connection_error(pymysql.err.OperationalError(2003, "Can't connect to MySQL server on '127.0.0.1' (10061)")) is True
    assert is_db_connection_error(RuntimeError("PostgreSQL connection circuit breaker is active (service unreachable).")) is True
    assert is_db_connection_error(RuntimeError("DATABASE_URL is not configured in settings.")) is True
    assert is_db_connection_error(RuntimeError("connection to server at 'localhost' failed: Permission denied")) is True

    # Programming and non-DB errors must NOT be identified as DB failures:
    assert is_db_connection_error(ValueError("Item code CS1124 not found")) is False
    assert is_db_connection_error(TypeError("unsupported operand type(s) for +: 'int' and 'str'")) is False
    assert is_db_connection_error(KeyError("missing_field")) is False
    assert is_db_connection_error(AttributeError("'NoneType' object has no attribute 'get'")) is False
    assert is_db_connection_error(RuntimeError("SAP Business One Service Layer returned 500 Internal Error")) is False


def test_update_item_mysql_connection_failure_uses_json_fallback(service):
    """Verify that update_item falls back to offline JSON when MySQL connection fails."""
    import pymysql

    target_code = "CS1124"
    mock_fallback_items = [
        {
            "item_code": target_code,
            "description": "Test Item CS1124",
            "qty": 50.0,
            "stock_qty": 20.0,
            "nt_weight": 10.0,
            "qc": False,
            "drw_yn": "N",
            "v_chk": "N",
            "lm": "N",
            "olng": "N",
            "lpk": "N",
            "lbl": "N",
            "mc_or_pt": "N",
            "po_no": "1378",
            "po_doc_entry": 871,
            "po_line_num": 0,
            "grpo_no": "473",
            "grpo_doc_entry": 770,
            "grpo_line_num": 0,
        }
    ]

    mysql_err = pymysql.err.OperationalError(2003, "Can't connect to MySQL server on '127.0.0.1' (10061)")

    with patch.object(service, "_get_connection", side_effect=mysql_err), \
         patch.object(service, "_read_from_fallback", return_value=mock_fallback_items), \
         patch.object(service, "_write_to_fallback") as mock_write_fallback, \
         patch.object(service, "_sync_por1_to_sap", return_value={"status": "success", "sap_synced": True}), \
         patch.object(service, "_sync_grpo_to_sap", return_value={"status": "success", "sap_synced": True}), \
         patch.object(service, "_sync_grpo_remark_to_sap", return_value={"status": "success", "sap_synced": True}), \
         patch.object(service, "_sync_item_to_sap", return_value={"status": "success", "sap_synced": True}):

        res = service.update_item(
            item_code=target_code,
            data={"qc": True, "drw_yn": "Y", "nt_weight": 14.5},
            admin_user_id="admin_tester",
        )

        assert res["success"] is True
        assert mock_write_fallback.called
        written_items = mock_write_fallback.call_args[0][0]
        item = next(it for it in written_items if it["item_code"] == target_code)
        assert item["qc"] is True
        assert item["drw_yn"] == "Y"
        assert item["nt_weight"] == 14.5


def test_update_item_non_db_runtime_error_is_not_masked_by_fallback(service):
    """Verify that update_item does NOT mask non-database RuntimeErrors as DB failures."""
    target_code = "CS1124"
    unrelated_error = RuntimeError("Unexpected SAP Service Layer fatal crash")

    # If an unexpected non-DB RuntimeError occurs in DB block, it must be re-raised!
    with patch.object(service, "_get_connection", side_effect=unrelated_error), \
         patch.object(service, "_sync_item_to_sap", return_value={"status": "success", "sap_synced": True}):
        with pytest.raises(RuntimeError, match="Unexpected SAP Service Layer fatal crash"):
            service.update_item(
                item_code=target_code,
                data={"nt_weight": 14.5},
                admin_user_id="admin",
            )


def test_update_item_validation_error_is_raised(service):
    """Verify that update_item raises ValueError for invalid inputs (e.g. negative weight) and never falls back."""
    with pytest.raises(ValueError, match="Field 'nt_weight' cannot be negative"):
        service.update_item(
            item_code="CS1124",
            data={"nt_weight": -5.0},
            admin_user_id="admin",
        )
