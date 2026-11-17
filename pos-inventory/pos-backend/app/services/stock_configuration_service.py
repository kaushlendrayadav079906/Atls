"""Stock Configuration Service for SAP Items management and persistence."""

from __future__ import annotations

import csv
import io
import json
import logging
import os
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
import time
from typing import Any, Dict, Iterator, List, Optional, Tuple

try:
    from zoneinfo import ZoneInfo
    KOLKATA_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    # Asia/Kolkata (IST) is strictly fixed at UTC+05:30 (no DST changes)
    KOLKATA_TZ = timezone(timedelta(hours=5, minutes=30))


def get_kolkata_now() -> datetime:
    """Returns the current timezone-aware timestamp in Asia/Kolkata (IST)."""
    return datetime.now(KOLKATA_TZ)

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

from app.db.connection import (
    get_db_connection,
    get_db_cursor,
    is_mysql,
    is_postgres,
    normalize_ddl_for_dialect,
)
from app.core.config import settings
from app.services.sap.client import get_sap_client, SAPConnectionError, SAPValidationError
from app.services.sap.items_service import SAPItemsService
from app.services.sap.warehouses_service import SAPWarehousesService

logger = logging.getLogger(__name__)

FALLBACK_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "_stock_configuration.json")

SAP_OWNED_FIELDS = {
    "sr_no",
    "item_code",
    "description",
    "qty",
    "stock_qty",
    "vendor_name",
    "vendor_code",
    "grpo_no",
    "rcvd_qty",
    "ok_qty",
    "rej_qty",
    "entry_date",
    "remark",
}

USER_CONFIGURABLE_FIELDS = {
    "nt_weight",
    "qc",
    "drw_yn",
    "v_chk",
    "lm",
    "olng",
    "lpk",
    "lbl",
    "mc_or_pt",
}


def clean_qc(val: Any) -> Optional[bool]:
    if val is None or val == "" or str(val).strip() == "":
        return None
    if isinstance(val, bool):
        return val
    s = str(val).strip().upper()
    if s in ["Y", "YES", "TRUE", "1", "T", "PASS"]:
        return True
    if s in ["N", "NO", "FALSE", "0", "F", "FAIL"]:
        return False
    return None


def clean_yn(val: Any) -> str:
    if val is None or val == "" or str(val).strip() == "":
        return ""
    s = str(val).strip().upper()
    if s in ["Y", "YES", "TRUE", "1", "T"]:
        return "Y"
    if s in ["N", "NO", "FALSE", "0", "F"]:
        return "N"
    return ""


def format_sap_last_updated(update_date: Any, update_time: Any) -> Optional[str]:
    """Combine SAP OITM.UpdateDate and OITM.UpdateTime into YYYY-MM-DD HH:MM:SS format."""
    if not update_date:
        return None
    d_str = str(update_date).split("T")[0].strip()
    if not d_str:
        return None
    t_str = "00:00:00"
    if update_time is not None:
        t_raw = str(update_time).strip()
        if ":" in t_raw:
            parts = t_raw.split(":")
            if len(parts) == 2:
                t_str = f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:00"
            elif len(parts) >= 3:
                t_str = f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:{parts[2].zfill(2)}"
        elif t_raw.isdigit():
            padded = t_raw.zfill(6)
            t_str = f"{padded[0:2]}:{padded[2:4]}:{padded[4:6]}"
    return f"{d_str} {t_str}"


COLUMNS = [
    "sr_no",
    "item_code",
    "description",
    "qty",
    "stock_qty",
    "vendor_name",
    "vendor_code",
    "grpo_no",
    "rcvd_qty",
    "nt_weight",
    "qc",
    "drw_yn",
    "v_chk",
    "ok_qty",
    "rej_qty",
    "lm",
    "olng",
    "lpk",
    "lbl",
    "mc_or_pt",
    "items_group_code",
    "warehouse_code",
    "is_active",
    "entry_date",
    "remark",
    "created_at",
    "updated_at",
    "last_submitted_at",
    "last_submitted_by",
    "record_category",
    "item_create_date",
    "so_date",
    "po_date",
    "grn_date",
    "po_no",
    "so_no",
    "so_qty",
    "po_qty",
    "po_doc_entry",
]

class StockConfigurationService:
    """Service handling Stock Configuration persistence, SAP integration, Excel import/export."""

    _last_synced_at: Optional[str] = None

    def __init__(self):
        self._ensure_table()

    @contextmanager
    def _get_connection(self) -> Iterator[Any]:
        with get_db_connection() as conn:
            yield conn

    def _ensure_table(self) -> None:
        """Create stock_configuration table if it does not exist, and seed initial records if empty."""
        try:
            with self._get_connection() as conn:
                with get_db_cursor(conn, dict_cursor=False) as cur:
                    base_ddl = """
                        CREATE TABLE IF NOT EXISTS stock_configuration (
                            sr_no INTEGER DEFAULT 0,
                            item_code VARCHAR(50) PRIMARY KEY,
                            description VARCHAR(255) NOT NULL,
                            qty NUMERIC(12, 2) DEFAULT 0,
                            stock_qty NUMERIC(12, 2) DEFAULT 0,
                            vendor_name VARCHAR(255) DEFAULT '',
                            vendor_code VARCHAR(50) DEFAULT '',
                            grpo_no VARCHAR(50) DEFAULT '',
                            rcvd_qty NUMERIC(12, 2) DEFAULT 0,
                            nt_weight NUMERIC(12, 4) DEFAULT 0,
                            qc BOOLEAN DEFAULT FALSE,
                            drw_yn VARCHAR(5) DEFAULT 'Y',
                            v_chk VARCHAR(5) DEFAULT 'Y',
                            ok_qty NUMERIC(12, 2) DEFAULT 0,
                            rej_qty NUMERIC(12, 2) DEFAULT 0,
                            lm VARCHAR(5) DEFAULT 'Y',
                            olng VARCHAR(5) DEFAULT 'Y',
                            lpk VARCHAR(5) DEFAULT 'Y',
                            lbl VARCHAR(5) DEFAULT 'Y',
                            mc_or_pt VARCHAR(5) DEFAULT 'Y',
                            items_group_code VARCHAR(50) DEFAULT '',
                            warehouse_code VARCHAR(50) DEFAULT '01',
                            is_active BOOLEAN DEFAULT TRUE,
                            entry_date DATE,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """
                    cur.execute(normalize_ddl_for_dialect(base_ddl))

                    cols_to_add = [
                        ("sr_no", "INTEGER DEFAULT 0"),
                        ("entry_date", "DATE"),
                        ("last_submitted_at", "TIMESTAMP NULL"),
                        ("remark", "TEXT"),
                        ("last_submitted_by", "VARCHAR(100)"),
                        ("record_category", "VARCHAR(50) DEFAULT 'Item Master'"),
                        ("item_create_date", "DATE"),
                        ("so_date", "DATE"),
                        ("po_date", "DATE"),
                        ("grn_date", "DATE"),
                        ("po_no", "VARCHAR(50) DEFAULT ''"),
                        ("so_no", "VARCHAR(50) DEFAULT ''"),
                        ("so_qty", "NUMERIC(12, 2) DEFAULT 0"),
                        ("po_qty", "NUMERIC(12, 2) DEFAULT 0"),
                        ("po_doc_entry", "INTEGER NULL"),
                    ]
                    if is_mysql():
                        for col_name, col_type in cols_to_add:
                            try:
                                cur.execute(f"ALTER TABLE stock_configuration ADD COLUMN {col_name} {col_type};")
                            except Exception:
                                pass
                        try:
                            cur.execute("CREATE INDEX idx_stock_config_dates ON stock_configuration(grn_date, entry_date, item_create_date);")
                        except Exception:
                            pass
                        try:
                            cur.execute("CREATE INDEX idx_stock_config_category ON stock_configuration(record_category);")
                        except Exception:
                            pass
                    else:
                        for col_name, col_type in cols_to_add:
                            cur.execute(f"ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS {col_name} {col_type};")
                        cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_config_dates ON stock_configuration(grn_date, entry_date, item_create_date);")
                        cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_config_category ON stock_configuration(record_category);")

                    audit_ddl = """
                        CREATE TABLE IF NOT EXISTS stock_configuration_audit (
                            id SERIAL PRIMARY KEY,
                            item_code VARCHAR(50) NOT NULL,
                            previous_remark TEXT,
                            new_remark TEXT,
                            admin_user_id VARCHAR(100),
                            action VARCHAR(50) DEFAULT 'SUBMIT_REMARK',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """
                    cur.execute(normalize_ddl_for_dialect(audit_ddl))
                    if is_mysql():
                        try:
                            cur.execute("CREATE INDEX idx_stock_config_audit_item ON stock_configuration_audit(item_code);")
                            cur.execute("CREATE INDEX idx_stock_config_audit_created ON stock_configuration_audit(created_at);")
                        except Exception:
                            pass
                    else:
                        cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_config_audit_item ON stock_configuration_audit(item_code);")
                        cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_config_audit_created ON stock_configuration_audit(created_at);")

                    cur.execute("UPDATE stock_configuration SET entry_date = COALESCE(grn_date, po_date, item_create_date, '2025-01-07') WHERE entry_date IS NULL;")
                    cur.execute("UPDATE stock_configuration SET remark = '' WHERE remark IS NULL;")
                    # Reference SAP SQL: QTY is Sales Order quantity from ORDR/RDR1 for Branch 1, and 0 for Branch 2 / unlinked
                    cur.execute("UPDATE stock_configuration SET qty = COALESCE(so_qty, 0.0) WHERE so_no IS NOT NULL AND so_no <> '';")
                    cur.execute("UPDATE stock_configuration SET qty = 0.0 WHERE so_no IS NULL OR so_no = '';")

                    cur.execute("SELECT COUNT(*) FROM stock_configuration;")
                    row = cur.fetchone()
                    count = row[0] if isinstance(row, (tuple, list)) else 0
                    if count == 0:
                        logger.info("Stock configuration table is empty. Live SAP synchronization will populate real SAP records on first cycle.")
            logger.info("Stock configuration table ensured in database.")
        except Exception as e:
            logger.warning(f"Database stock_configuration init failed ({e}), using JSON fallback.")
            self._ensure_fallback_json()
            self._ensure_fallback_json()

    def _ensure_fallback_json(self) -> None:
        if not os.path.exists(FALLBACK_JSON_PATH):
            with open(FALLBACK_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2)

    def _read_from_fallback(self) -> List[Dict[str, Any]]:
        self._ensure_fallback_json()
        try:
            with open(FALLBACK_JSON_PATH, "r", encoding="utf-8") as f:
                items = json.load(f)
                if not isinstance(items, list):
                    return []
                for it in items:
                    if not it.get("entry_date"):
                        it["entry_date"] = "2025-01-07"
                    if "remark" not in it:
                        it["remark"] = ""
                    if "po_doc_entry" not in it:
                        pno = str(it.get("po_no") or "").strip()
                        it["po_doc_entry"] = int(pno) if pno.isdigit() else None
                    if "remark_history" not in it:
                        it["remark_history"] = []
                return items
        except Exception:
            return []

    def _write_to_fallback(self, items: List[Dict[str, Any]]) -> None:
        with open(FALLBACK_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2)

    def refresh_live_stock_from_sap(self, item_codes: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Fast live synchronization from SAP Business One.
        Fetches:
        1. Recent Goods Receipt POs (PurchaseDeliveryNotes) with line quantities and base PO references.
        2. Recent Purchase Orders (PurchaseOrders) with line quantities and dates.
        3. SAP Item Masters (QuantityOnStock, ItemName, ItemGroup, etc.).
        Updates both the database and fallback JSON storage.
        Strictly preserves ATLAS custom fields: remarks, qc, drawing, v_chk, etc.
        """
        try:
            client = get_sap_client()
            if not client.session_id or (client.session_timeout and datetime.utcnow() >= client.session_timeout):
                client.login()
            logger.info("SAP connection successful: authenticated with SAP Service Layer.")
        except Exception as e:
            logger.warning(f"Live SAP refresh skipped - SAP unavailable: {e}")
            return {"success": False, "message": f"SAP unavailable: {str(e)}", "timestamp": self._last_synced_at}

        now = get_kolkata_now()
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")

        # 1. Fetch recent Goods Receipt POs (PurchaseDeliveryNotes) ordered by UpdateDate desc to detect live edits
        grpos = []
        try:
            res_grpo = client.get("PurchaseDeliveryNotes", params={
                "$orderby": "UpdateDate desc, DocEntry desc",
                "$top": 50,
                "$select": "DocEntry,DocNum,DocDate,CardName,CardCode,UpdateDate,Cancelled,DocumentStatus,U_SONo,DocumentLines",
            })
            grpos = [g for g in res_grpo.get("value", []) if g.get("Cancelled") != "tYES"]
        except Exception as e:
            logger.warning(f"Error fetching recent GRPOs from SAP: {e}")

        # 2. Fetch recent Purchase Orders (PurchaseOrders) ordered by UpdateDate desc to detect live edits
        pos = []
        try:
            res_po = client.get("PurchaseOrders", params={
                "$orderby": "UpdateDate desc, DocEntry desc",
                "$top": 50,
                "$select": "DocEntry,DocNum,DocDate,CardName,CardCode,UpdateDate,Cancelled,DocumentStatus,ImportFileNum,Comments,DocumentLines",
            })
            pos = [p for p in res_po.get("value", []) if p.get("Cancelled") != "tYES"]
        except Exception as e:
            logger.warning(f"Error fetching recent Purchase Orders from SAP: {e}")

        # 3. Build PO lookup and fetch missing base POs referenced in GRPOs
        po_by_entry = {p.get("DocEntry"): p for p in pos if p.get("DocEntry")}
        missing_po_entries = set()
        for g in grpos:
            for l in g.get("DocumentLines", []):
                if l.get("BaseType") == 22 and l.get("BaseEntry"):
                    if l.get("BaseEntry") not in po_by_entry:
                        missing_po_entries.add(l.get("BaseEntry"))

        if missing_po_entries:
            try:
                filter_po = " or ".join([f"DocEntry eq {e}" for e in list(missing_po_entries)[:20]])
                res_missing_po = client.get("PurchaseOrders", params={
                    "$filter": filter_po,
                    "$select": "DocEntry,DocNum,DocDate,CardName,CardCode,UpdateDate,Cancelled,DocumentStatus,ImportFileNum,Comments,DocumentLines",
                })
                for p in res_missing_po.get("value", []):
                    if p.get("DocEntry") and p.get("Cancelled") != "tYES":
                        po_by_entry[p["DocEntry"]] = p
            except Exception as e:
                logger.warning(f"Error bulk fetching missing base POs: {e}")

        # 4. Fetch linked Sales Orders (Branch 1: POs linked to SOs via ImportFileNum / ImportEnt, and GRPO U_SONo)
        so_doc_nums = set()
        for p in po_by_entry.values():
            imp = p.get("ImportFileNum")
            if imp:
                try:
                    so_doc_nums.add(int(imp))
                except (ValueError, TypeError):
                    pass
        for g in grpos:
            so_hdr = g.get("U_SONo")
            if so_hdr:
                try:
                    so_doc_nums.add(int(so_hdr))
                except (ValueError, TypeError):
                    pass

        so_by_doc_num = {}
        for so_num in so_doc_nums:
            try:
                res_so = client.get("Orders", params={"$filter": f"DocNum eq {so_num}"})
                for so in res_so.get("value", []):
                    if so.get("Cancelled") != "tYES":
                        so_by_doc_num[so_num] = so
            except Exception as e:
                logger.warning(f"Error fetching linked SO DocNum {so_num}: {e}")

        # 5. Build received_map (keyed by ItemCode, newest GRPO first)
        received_map = {}
        for g in grpos:
            grpo_no = str(g.get("DocNum") or "")
            grn_date_raw = g.get("DocDate")
            grn_date = str(grn_date_raw).split("T")[0] if grn_date_raw else None
            vendor_name = g.get("CardName") or ""
            vendor_code = g.get("CardCode") or ""
            hdr_so_no = str(g.get("U_SONo") or "")

            for l in g.get("DocumentLines", []):
                code = l.get("ItemCode")
                if not code or code in received_map:
                    continue

                rcvd_qty = float(l.get("Quantity") or 0.0)
                rem_open_qty = float(l.get("RemainingOpenQuantity")) if l.get("RemainingOpenQuantity") is not None else rcvd_qty
                ok_qty = rem_open_qty
                rej_qty = max(0.0, rcvd_qty - rem_open_qty)

                base_type = l.get("BaseType")
                base_entry = l.get("BaseEntry")
                base_line = l.get("BaseLine")

                po_no = ""
                po_date = None
                po_qty = 0.0
                po_comments = ""
                so_no = ""
                so_date = None
                so_qty = 0.0

                if base_type == 22 and base_entry and base_entry in po_by_entry:
                    base_po = po_by_entry[base_entry]
                    po_no = str(base_po.get("DocNum") or "")
                    po_comments = str(base_po.get("Comments") or "").strip()
                    if base_po.get("DocDate"):
                        po_date = str(base_po.get("DocDate")).split("T")[0]
                    for pl in base_po.get("DocumentLines", []):
                        if pl.get("LineNum") == base_line or pl.get("ItemCode") == code:
                            po_qty = float(pl.get("Quantity") or 0.0)
                            break
                    if not po_qty:
                        po_qty = rcvd_qty

                    imp_file = base_po.get("ImportFileNum")
                    if imp_file:
                        try:
                            so_num_int = int(imp_file)
                            if so_num_int in so_by_doc_num:
                                so_doc = so_by_doc_num[so_num_int]
                                so_no = str(so_doc.get("DocNum") or imp_file)
                                if so_doc.get("DocDate"):
                                    so_date = str(so_doc.get("DocDate")).split("T")[0]
                                so_lines = [
                                    float(sl.get("Quantity") or 0.0)
                                    for sl in so_doc.get("DocumentLines", [])
                                    if sl.get("ItemCode") == code
                                ]
                                so_qty = sum(so_lines) if so_lines else 0.0
                        except (ValueError, TypeError):
                            pass

                # If SO not resolved via PO, check header UDF U_SONo
                if not so_qty and hdr_so_no:
                    try:
                        so_num_int = int(hdr_so_no)
                        if so_num_int in so_by_doc_num:
                            so_doc = so_by_doc_num[so_num_int]
                            so_no = str(so_doc.get("DocNum") or hdr_so_no)
                            if so_doc.get("DocDate"):
                                so_date = str(so_doc.get("DocDate")).split("T")[0]
                            so_lines = [
                                float(sl.get("Quantity") or 0.0)
                                for sl in so_doc.get("DocumentLines", [])
                                if sl.get("ItemCode") == code
                            ]
                            so_qty = sum(so_lines) if so_lines else 0.0
                    except (ValueError, TypeError):
                        pass

                # Reference SAP SQL query:
                # Branch 1 (linked to Sales Order via OPOR.ImportEnt): QTY = SO quantity from ORDR/RDR1
                # Branch 2 (regular PO where OPOR.ImportEnt IS NULL, or direct GRPO): QTY = 0.0
                qty = so_qty if (so_no and so_qty > 0) else 0.0

                received_map[code] = {
                    "grpo_no": grpo_no,
                    "grn_date": grn_date,
                    "rcvd_qty": rcvd_qty,
                    "ok_qty": ok_qty,
                    "rej_qty": rej_qty,
                    "vendor_name": vendor_name,
                    "vendor_code": vendor_code,
                    "po_no": po_no,
                    "po_doc_entry": int(base_entry) if (base_type == 22 and base_entry) else (int(po_no) if po_no and str(po_no).isdigit() else None),
                    "po_date": po_date,
                    "po_qty": po_qty,
                    "po_comments": po_comments,
                    "so_no": so_no if so_qty > 0 else "",
                    "so_date": so_date if so_qty > 0 else None,
                    "so_qty": so_qty,
                    "qty": qty,
                    "item_desc": l.get("ItemDescription"),
                }

        # 6. Build pending_po_map (for items on POs not yet received in recent GRPOs)
        pending_po_map = {}
        for p in pos:
            po_entry = p.get("DocEntry")
            po_no = str(p.get("DocNum") or "")
            po_date_raw = p.get("DocDate")
            po_date = str(po_date_raw).split("T")[0] if po_date_raw else None
            po_comments = str(p.get("Comments") or "").strip()
            vendor_name = p.get("CardName") or ""
            vendor_code = p.get("CardCode") or ""
            imp_file = p.get("ImportFileNum")
            so_no = ""
            so_date = None
            so_qty = 0.0
            if imp_file:
                try:
                    so_num_int = int(imp_file)
                    if so_num_int in so_by_doc_num:
                        so_doc = so_by_doc_num[so_num_int]
                        so_no = str(so_doc.get("DocNum") or imp_file)
                        if so_doc.get("DocDate"):
                            so_date = str(so_doc.get("DocDate")).split("T")[0]
                except (ValueError, TypeError):
                    pass

            for l in p.get("DocumentLines", []):
                code = l.get("ItemCode")
                if not code or code in received_map or code in pending_po_map:
                    continue
                open_qty = float(l.get("RemainingOpenQuantity") or 0.0)
                if so_no and so_num_int and so_num_int in so_by_doc_num:
                    so_lines = [
                        float(sl.get("Quantity") or 0.0)
                        for sl in so_by_doc_num[so_num_int].get("DocumentLines", [])
                        if sl.get("ItemCode") == code
                    ]
                    so_qty = sum(so_lines) if so_lines else 0.0
                qty = so_qty if (so_no and so_qty > 0) else 0.0

                if open_qty > 0 or float(l.get("Quantity") or 0.0) > 0:
                    pending_po_map[code] = {
                        "po_no": po_no,
                        "po_doc_entry": int(po_entry) if po_entry else (int(po_no) if po_no and str(po_no).isdigit() else None),
                        "po_date": po_date,
                        "po_qty": float(l.get("Quantity") or 0.0),
                        "po_comments": po_comments,
                        "open_qty": open_qty,
                        "vendor_name": vendor_name,
                        "vendor_code": vendor_code,
                        "so_no": so_no if so_qty > 0 else "",
                        "so_date": so_date if so_qty > 0 else None,
                        "so_qty": so_qty,
                        "qty": qty,
                        "item_desc": l.get("ItemDescription"),
                    }

        # 7. Fetch Item Masters (target_items)
        target_items = []
        try:
            if item_codes and len(item_codes) > 0:
                for chunk_idx in range(0, len(item_codes), 20):
                    chunk = item_codes[chunk_idx : chunk_idx + 20]
                    filter_str = " or ".join([f"ItemCode eq '{c}'" for c in chunk])
                    res = client.get("Items", params={
                        "$filter": filter_str,
                        "$select": "ItemCode,ItemName,QuantityOnStock,ItemsGroupCode,Valid,Frozen,CreateDate,UpdateDate,UpdateTime,Mainsupplier,InventoryWeight,PurchaseUnitWeight,SalesUnitWeight,U_PerPices,U_Drawing,User_Text,U_QC,U_V_Chk,U_LM,U_OLNG,U_LPK,U_LBL,U_MC_OR_PT"
                    })
                    target_items.extend(res.get("value", []))
            else:
                res = client.get("Items", params={
                    "$orderby": "UpdateDate desc",
                    "$top": 50,
                    "$select": "ItemCode,ItemName,QuantityOnStock,ItemsGroupCode,Valid,Frozen,CreateDate,UpdateDate,UpdateTime,Mainsupplier,InventoryWeight,PurchaseUnitWeight,SalesUnitWeight,U_PerPices,U_Drawing,User_Text,U_QC,U_V_Chk,U_LM,U_OLNG,U_LPK,U_LBL,U_MC_OR_PT"
                })
                target_items = res.get("value", [])

                # If background sync, also include candidate items from recent documents
                items_by_code = {it.get("ItemCode"): it for it in target_items if it.get("ItemCode")}
                missing_candidate_codes = list((set(received_map.keys()) | set(pending_po_map.keys())) - set(items_by_code.keys()))
                if missing_candidate_codes:
                    for chunk_idx in range(0, min(len(missing_candidate_codes), 40), 20):
                        chunk = missing_candidate_codes[chunk_idx : chunk_idx + 20]
                        filter_missing = " or ".join([f"ItemCode eq '{c}'" for c in chunk])
                        try:
                            res_m = client.get("Items", params={
                                "$filter": filter_missing,
                                "$select": "ItemCode,ItemName,QuantityOnStock,ItemsGroupCode,Valid,Frozen,CreateDate,UpdateDate,UpdateTime,Mainsupplier,InventoryWeight,PurchaseUnitWeight,SalesUnitWeight,U_PerPices,U_Drawing,User_Text,U_QC,U_V_Chk,U_LM,U_OLNG,U_LPK,U_LBL,U_MC_OR_PT"
                            })
                            target_items.extend(res_m.get("value", []))
                        except Exception as m_err:
                            logger.warning(f"Error bulk fetching missing candidate items: {m_err}")
        except Exception as e:
            logger.warning(f"Error fetching live items from SAP: {e}")

        logger.info(
            "SAP records retrieved: %d GRPOs, %d Purchase Orders, %d Item Masters.",
            len(grpos),
            len(pos),
            len(target_items),
        )

        # 7. Upsert to database preserving user remarks and configuration fields
        synced_count = 0
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    synced_count = self._upsert_sap_items_cursor(cur, conn, target_items, received_map, pending_po_map)
            logger.info("Stock configuration database synchronization: %d records inserted or updated.", synced_count)
        except Exception as db_err:
            logger.warning(f"Database update skipped during live refresh ({db_err})")

        # 8. Update fallback JSON
        try:
            fallback_items = self._read_from_fallback()
            fb_by_code = {it["item_code"]: it for it in fallback_items if "item_code" in it}
            for s_it in target_items:
                code = s_it.get("ItemCode")
                if not code:
                    continue
                stock = float(s_it.get("QuantityOnStock") or 0.0)
                name = s_it.get("ItemName") or code
                is_active = (s_it.get("Valid") == "tYES" and s_it.get("Frozen") != "tYES")
                sap_last_updated = format_sap_last_updated(s_it.get("UpdateDate"), s_it.get("UpdateTime")) or now.isoformat()
                if code in fb_by_code:
                    fb_row = fb_by_code[code]
                    fb_row["stock_qty"] = stock
                    fb_row["description"] = name
                    fb_row["is_active"] = is_active
                    fb_row["updated_at"] = sap_last_updated
                    # One-way submission protection: website-entered values remain authoritative
                    is_website_authoritative = bool(fb_row.get("last_submitted_at"))
                    if not is_website_authoritative:
                        s_wt = float(s_it.get("PurchaseUnitWeight") or s_it.get("InventoryWeight") or s_it.get("SalesUnitWeight") or s_it.get("U_PerPices") or 0.0)
                        if s_wt > 0 and not fb_row.get("nt_weight"):
                            fb_row["nt_weight"] = round(s_wt, 4)
                        s_drw = clean_yn(s_it.get("U_Drawing") or s_it.get("U_JobDrawing"))
                        if s_drw and not fb_row.get("drw_yn"):
                            fb_row["drw_yn"] = s_drw
                        if s_it.get("U_QC") is not None and fb_row.get("qc") is None:
                            fb_row["qc"] = clean_qc(s_it.get("U_QC"))
                        for s_k, fb_k in [("U_V_Chk", "v_chk"), ("U_LM", "lm"), ("U_OLNG", "olng"), ("U_LPK", "lpk"), ("U_LBL", "lbl"), ("U_MC_OR_PT", "mc_or_pt")]:
                            if s_it.get(s_k) is not None and not fb_row.get(fb_k):
                                fb_row[fb_k] = clean_yn(s_it.get(s_k))
                    if code in received_map:
                        rm = received_map[code]
                        fb_row["grpo_no"] = rm.get("grpo_no") or fb_row.get("grpo_no", "")
                        fb_row["grn_date"] = rm.get("grn_date") or fb_row.get("grn_date")
                        fb_row["entry_date"] = rm.get("grn_date") or rm.get("po_date") or fb_row.get("entry_date")
                        fb_row["rcvd_qty"] = rm.get("rcvd_qty", fb_row.get("rcvd_qty", 0.0))
                        fb_row["ok_qty"] = rm.get("ok_qty", fb_row.get("ok_qty", 0.0))
                        fb_row["rej_qty"] = rm.get("rej_qty", fb_row.get("rej_qty", 0.0))
                        fb_row["po_no"] = rm.get("po_no") or fb_row.get("po_no", "")
                        fb_row["po_doc_entry"] = rm.get("po_doc_entry") or fb_row.get("po_doc_entry")
                        fb_row["po_date"] = rm.get("po_date") or fb_row.get("po_date")
                        fb_row["po_qty"] = rm.get("po_qty", fb_row.get("po_qty", 0.0))
                        if rm.get("po_comments") and not is_website_authoritative and not fb_row.get("remark"):
                            fb_row["remark"] = rm["po_comments"]
                        fb_row["so_no"] = rm.get("so_no", "")
                        fb_row["so_date"] = rm.get("so_date")
                        fb_row["so_qty"] = rm.get("so_qty", 0.0)
                        fb_row["qty"] = rm.get("qty", 0.0)
                        fb_row["vendor_name"] = rm.get("vendor_name") or fb_row.get("vendor_name", "")
                        fb_row["vendor_code"] = rm.get("vendor_code") or fb_row.get("vendor_code", "")
                        fb_row["record_category"] = "Received Stock"
                    elif code in pending_po_map:
                        pm = pending_po_map[code]
                        fb_row["po_no"] = pm.get("po_no") or fb_row.get("po_no", "")
                        fb_row["po_doc_entry"] = pm.get("po_doc_entry") or fb_row.get("po_doc_entry")
                        fb_row["po_date"] = pm.get("po_date") or fb_row.get("po_date")
                        fb_row["entry_date"] = pm.get("po_date") or fb_row.get("entry_date")
                        fb_row["po_qty"] = pm.get("po_qty", fb_row.get("po_qty", 0.0))
                        if pm.get("po_comments"):
                            fb_row["remark"] = pm["po_comments"]
                        fb_row["so_no"] = pm.get("so_no", "")
                        fb_row["so_date"] = pm.get("so_date")
                        fb_row["so_qty"] = pm.get("so_qty", 0.0)
                        fb_row["qty"] = pm.get("qty", 0.0)
                        fb_row["vendor_name"] = pm.get("vendor_name") or fb_row.get("vendor_name", "")
                        fb_row["vendor_code"] = pm.get("vendor_code") or fb_row.get("vendor_code", "")
                        fb_row["record_category"] = "Pending Receipt"
                else:
                    rm = received_map.get(code)
                    pm = pending_po_map.get(code)
                    info = rm or pm or {}
                    p_qty = float(info.get("po_qty", 0.0))
                    r_qty = float(info.get("rcvd_qty", 0.0))
                    c_qty = float(info.get("qty", 0.0))
                    item_create = str(s_it.get("CreateDate")).split("T")[0] if s_it.get("CreateDate") else now.strftime("%Y-%m-%d")
                    new_item = {
                        "sr_no": len(fallback_items) + 1,
                        "item_code": code,
                        "description": name,
                        "qty": c_qty,
                        "stock_qty": stock,
                        "vendor_name": info.get("vendor_name", ""),
                        "vendor_code": info.get("vendor_code", ""),
                        "grpo_no": info.get("grpo_no", ""),
                        "rcvd_qty": r_qty,
                        "nt_weight": round(float(s_it.get("PurchaseUnitWeight") or s_it.get("InventoryWeight") or s_it.get("SalesUnitWeight") or s_it.get("U_PerPices") or 0.0), 4),
                        "qc": clean_qc(s_it.get("U_QC")) if clean_qc(s_it.get("U_QC")) is not None else True,
                        "drw_yn": clean_yn(s_it.get("U_Drawing") or s_it.get("U_JobDrawing")) or "Y",
                        "v_chk": clean_yn(s_it.get("U_V_Chk")) or "Y",
                        "ok_qty": float(info.get("ok_qty", 0.0)),
                        "rej_qty": float(info.get("rej_qty", 0.0)),
                        "lm": clean_yn(s_it.get("U_LM")) or "Y",
                        "olng": clean_yn(s_it.get("U_OLNG")) or "Y",
                        "lpk": clean_yn(s_it.get("U_LPK")) or "Y",
                        "lbl": clean_yn(s_it.get("U_LBL")) or "Y",
                        "mc_or_pt": clean_yn(s_it.get("U_MC_OR_PT")) or "Y",
                        "items_group_code": str(s_it.get("U_SUBG") or s_it.get("ItemsGroupCode") or "Standard"),
                        "warehouse_code": "01",
                        "is_active": is_active,
                        "entry_date": info.get("grn_date") or info.get("po_date") or item_create,
                        "created_at": now.isoformat(),
                        "updated_at": sap_last_updated,
                        "last_submitted_at": None,
                        "remark": (info.get("po_comments") or str(s_it.get("User_Text") or "")).strip(),
                        "last_submitted_by": None,
                        "record_category": "Received Stock" if rm else ("Pending Receipt" if pm else "Item Master"),
                        "item_create_date": item_create,
                        "so_date": info.get("so_date"),
                        "po_date": info.get("po_date"),
                        "grn_date": info.get("grn_date"),
                        "po_no": info.get("po_no", ""),
                        "po_doc_entry": info.get("po_doc_entry"),
                        "so_no": info.get("so_no", ""),
                        "so_qty": float(info.get("so_qty", 0.0)),
                        "po_qty": p_qty,
                        "remark_history": [],
                    }
                    fallback_items.append(new_item)
                    fb_by_code[code] = new_item
            self._write_to_fallback(fallback_items)
            if synced_count == 0:
                synced_count = len(target_items)
        except Exception as fb_err:
            logger.debug(f"Fallback JSON sync skipped: {fb_err}")

        StockConfigurationService._last_synced_at = now_str
        return {
            "success": True,
            "refreshed_count": synced_count,
            "total_items": len(target_items),
            "timestamp": now_str,
        }

    def get_items(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        vendor: Optional[str] = None,
        group: Optional[str] = None,
        warehouse: Optional[str] = None,
        branch: Optional[str] = None,
        period: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        refresh: bool = False,
    ) -> Dict[str, Any]:
        """Fetch paginated stock configuration items, KPIs, filter options, and SAP connection status."""
        if refresh:
            try:
                self.refresh_live_stock_from_sap()
            except Exception as ref_err:
                logger.warning(f"Automatic refresh during get_items skipped: {ref_err}")

        now_k = get_kolkata_now()
        today_str = now_k.strftime("%Y-%m-%d")
        yesterday_str = (now_k - timedelta(days=1)).strftime("%Y-%m-%d")
        week_start_str = (now_k - timedelta(days=now_k.weekday())).strftime("%Y-%m-%d")
        month_start_str = now_k.strftime("%Y-%m-01")
        year_start_str = now_k.strftime("%Y-01-01")
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Filter options from distinct stored values
                    cur.execute("SELECT DISTINCT vendor_name FROM stock_configuration WHERE vendor_name <> '' ORDER BY vendor_name")
                    vendor_list = [r[0] for r in cur.fetchall()]

                    cur.execute("SELECT DISTINCT items_group_code FROM stock_configuration WHERE items_group_code <> '' ORDER BY items_group_code")
                    group_list = [r[0] for r in cur.fetchall()]

                    cur.execute("SELECT DISTINCT warehouse_code FROM stock_configuration WHERE warehouse_code <> '' ORDER BY warehouse_code")
                    warehouse_list = [r[0] for r in cur.fetchall()]

                    # Build filtered query
                    conditions = []
                    params: Dict[str, Any] = {}

                    if search and search.strip():
                        s = f"%{search.strip()}%"
                        conditions.append("(item_code LIKE %(search)s OR description LIKE %(search)s OR vendor_name LIKE %(search)s)")
                        params["search"] = s

                    if vendor and vendor.strip() and vendor.strip().lower() != "all vendors":
                        conditions.append("vendor_name LIKE %(vendor)s")
                        params["vendor"] = f"%{vendor.strip()}%"

                    if group and group.strip() and group.strip().lower() != "all groups":
                        conditions.append("items_group_code LIKE %(group)s")
                        params["group"] = f"%{group.strip()}%"

                    eff_wh = warehouse or branch
                    if eff_wh and eff_wh.strip() and eff_wh.strip().lower() not in ("all warehouses", "all branches", "all"):
                        conditions.append("warehouse_code LIKE %(warehouse)s")
                        params["warehouse"] = f"%{eff_wh.strip()}%"

                    # Date filter handling on authoritative stock date:
                    # Received Stock -> GRN Date; Pending Receipt -> PO Date; Item Master -> Create Date
                    eff_date = "COALESCE(grn_date, entry_date, item_create_date, DATE(created_at))"
                    if period and period.strip().lower() not in ("all dates (total)", "all_time", "all", ""):
                        p = period.strip().lower()
                        if p in ("today", "daily"):
                            conditions.append(f"{eff_date} = %(today_str)s")
                            params["today_str"] = today_str
                        elif p in ("yesterday",):
                            conditions.append(f"{eff_date} = %(yesterday_str)s")
                            params["yesterday_str"] = yesterday_str
                        elif p in ("week", "weekly", "this week"):
                            conditions.append(f"{eff_date} >= %(week_start_str)s")
                            params["week_start_str"] = week_start_str
                        elif p in ("month", "monthly", "this month"):
                            conditions.append(f"{eff_date} >= %(month_start_str)s")
                            params["month_start_str"] = month_start_str
                        elif p in ("year", "yearly", "this year"):
                            conditions.append(f"{eff_date} >= %(year_start_str)s")
                            params["year_start_str"] = year_start_str

                    if date_from and date_from.strip():
                        conditions.append(f"{eff_date} >= %(date_from)s")
                        params["date_from"] = date_from.strip()

                    if date_to and date_to.strip():
                        conditions.append(f"{eff_date} <= %(date_to)s")
                        params["date_to"] = date_to.strip()

                    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

                    # Count matching records
                    cur.execute(f"SELECT COUNT(*) FROM stock_configuration {where_clause}", params)
                    filtered_total = cur.fetchone()[0] or 0

                    # On-demand SAP lookup: If search yielded no results in local database, query SAP on-demand and auto-upsert
                    if search and search.strip() and filtered_total == 0:
                        try:
                            sap_items = SAPItemsService().get_items(search=search.strip(), top=50)
                            if sap_items:
                                self._upsert_sap_items_cursor(cur, conn, sap_items)
                                conn.commit()
                                # Refresh filter lists
                                cur.execute("SELECT DISTINCT vendor_name FROM stock_configuration WHERE vendor_name <> '' ORDER BY vendor_name")
                                vendor_list = [r[0] for r in cur.fetchall()]
                                cur.execute("SELECT DISTINCT items_group_code FROM stock_configuration WHERE items_group_code <> '' ORDER BY items_group_code")
                                group_list = [r[0] for r in cur.fetchall()]
                                # Re-count matching records
                                cur.execute(f"SELECT COUNT(*) FROM stock_configuration {where_clause}", params)
                                filtered_total = cur.fetchone()[0] or 0
                        except Exception as s_err:
                            logger.warning(f"On-demand SAP lookup for '{search}' encountered error: {s_err}")

                    # Calculate KPIs matching current filters
                    if where_clause:
                        total_items = filtered_total
                        cur.execute(f"SELECT COUNT(*) FROM stock_configuration {where_clause} AND is_active = TRUE", params)
                        active_items = cur.fetchone()[0] or 0
                        cur.execute(f"SELECT COUNT(*) FROM stock_configuration {where_clause} AND is_active = FALSE", params)
                        inactive_items = cur.fetchone()[0] or 0
                        cur.execute(f"SELECT COUNT(DISTINCT warehouse_code) FROM stock_configuration {where_clause} AND warehouse_code <> ''", params)
                        warehouses_count = cur.fetchone()[0] or 0
                    else:
                        cur.execute("SELECT COUNT(*) FROM stock_configuration")
                        total_items = cur.fetchone()[0] or 0
                        cur.execute("SELECT COUNT(*) FROM stock_configuration WHERE is_active = TRUE")
                        active_items = cur.fetchone()[0] or 0
                        cur.execute("SELECT COUNT(*) FROM stock_configuration WHERE is_active = FALSE")
                        inactive_items = cur.fetchone()[0] or 0
                        cur.execute("SELECT COUNT(DISTINCT warehouse_code) FROM stock_configuration WHERE warehouse_code <> ''")
                        warehouses_count = cur.fetchone()[0] or 0

                    # Fetch page records
                    offset = max(0, (page - 1) * page_size)
                    params["limit"] = page_size
                    params["offset"] = offset

                    query = f"""
                        SELECT {', '.join(COLUMNS)}
                        FROM stock_configuration
                        {where_clause}
                        ORDER BY sr_no ASC, item_code ASC
                        LIMIT %(limit)s OFFSET %(offset)s;
                    """
                    cur.execute(query, params)
                    rows = cur.fetchall()

                    items = []
                    for r in rows:
                        item_dict = dict(zip(COLUMNS, r))
                        # Cast numbers to floats/ints for JSON serialization
                        for num_col in ["qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty", "so_qty", "po_qty"]:
                            if item_dict.get(num_col) is not None:
                                item_dict[num_col] = float(item_dict[num_col])
                        for d_col in ["entry_date", "item_create_date", "so_date", "po_date", "grn_date"]:
                            if isinstance(item_dict.get(d_col), (datetime, date)):
                                item_dict[d_col] = item_dict[d_col].isoformat()
                        if not item_dict.get("entry_date"):
                            item_dict["entry_date"] = item_dict.get("grn_date") or item_dict.get("po_date") or item_dict.get("item_create_date") or now_k.strftime("%Y-%m-%d")
                        if isinstance(item_dict.get("created_at"), datetime):
                            item_dict["created_at"] = item_dict["created_at"].isoformat()
                        if isinstance(item_dict.get("updated_at"), datetime):
                            item_dict["updated_at"] = item_dict["updated_at"].isoformat()
                        if isinstance(item_dict.get("last_submitted_at"), (datetime, date)):
                            item_dict["last_submitted_at"] = item_dict["last_submitted_at"].isoformat()
                        items.append(item_dict)

        except Exception as exc:
            logger.warning(f"Error querying PostgreSQL stock_configuration ({exc}), using JSON fallback.")
            all_items = self._read_from_fallback()
            total_items = len(all_items)
            active_items = sum(1 for it in all_items if it.get("is_active", True))
            inactive_items = total_items - active_items
            warehouses_count = len({it.get("warehouse_code") for it in all_items if it.get("warehouse_code")})

            vendor_list = sorted(list({it.get("vendor_name") for it in all_items if it.get("vendor_name")}))
            group_list = sorted(list({it.get("items_group_code") for it in all_items if it.get("items_group_code")}))
            warehouse_list = sorted(list({it.get("warehouse_code") for it in all_items if it.get("warehouse_code")}))

            filtered = all_items
            if search and search.strip():
                st = search.strip().lower()
                filtered = [
                    it for it in filtered
                    if st in str(it.get("item_code", "")).lower()
                    or st in str(it.get("description", "")).lower()
                    or st in str(it.get("vendor_name", "")).lower()
                ]
            if vendor and vendor.strip() and vendor.strip().lower() != "all vendors":
                vt = vendor.strip().lower()
                filtered = [it for it in filtered if vt in str(it.get("vendor_name", "")).lower()]
            if group and group.strip() and group.strip().lower() != "all groups":
                gt = group.strip().lower()
                filtered = [it for it in filtered if gt in str(it.get("items_group_code", "")).lower()]
            if warehouse and warehouse.strip() and warehouse.strip().lower() != "all warehouses":
                wt = warehouse.strip().lower()
                filtered = [it for it in filtered if wt in str(it.get("warehouse_code", "")).lower()]

            if period and period.strip().lower() not in ("all dates (total)", "all_time", "all", ""):
                p = period.strip().lower()
                def _eff_date_val(it: Dict[str, Any]) -> str:
                    raw = it.get("grn_date") or it.get("entry_date") or it.get("item_create_date") or str(it.get("created_at", ""))
                    return str(raw).split("T")[0] if raw else "2025-01-07"

                if p in ("today", "daily"):
                    filtered = [it for it in filtered if _eff_date_val(it) == today_str]
                elif p in ("yesterday",):
                    filtered = [it for it in filtered if _eff_date_val(it) == yesterday_str]
                elif p in ("week", "weekly", "this week"):
                    filtered = [it for it in filtered if _eff_date_val(it) >= week_start_str]
                elif p in ("month", "monthly", "this month"):
                    filtered = [it for it in filtered if _eff_date_val(it) >= month_start_str]
                elif p in ("year", "yearly", "this year"):
                    filtered = [it for it in filtered if _eff_date_val(it) >= year_start_str]

            if date_from and date_from.strip():
                df = date_from.strip()
                filtered = [it for it in filtered if (str(it.get("grn_date") or it.get("entry_date") or "").split("T")[0]) >= df]
            if date_to and date_to.strip():
                dt = date_to.strip()
                filtered = [it for it in filtered if (str(it.get("grn_date") or it.get("entry_date") or "").split("T")[0]) <= dt]

            filtered_total = len(filtered)
            offset = max(0, (page - 1) * page_size)
            items = filtered[offset : offset + page_size]

        # Check real SAP health
        sap_health = self._get_sap_health_status()

        return {
            "items": items,
            "total": filtered_total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (filtered_total + page_size - 1) // page_size),
            "kpis": {
                "total_items": total_items,
                "active_items": active_items,
                "inactive_items": inactive_items,
                "warehouses_count": warehouses_count,
            },
            "filters": {
                "vendors": vendor_list,
                "groups": group_list,
                "warehouses": warehouse_list,
            },
            "sap_status": sap_health.get("status", "disconnected"),
            "sap_message": sap_health.get("message", ""),
            "last_synced_at": StockConfigurationService._last_synced_at or self._last_synced_at,
            "sync_interval_seconds": int(getattr(settings, "SAP_STOCK_SYNC_INTERVAL_SECONDS", 30)),
        }

    def _get_sap_health_status(self) -> Dict[str, Any]:
        """Check live SAP Service Layer status without blocking database queries."""
        try:
            client = get_sap_client()
            if client._last_health_result:
                return client._last_health_result
            if client.session_id and (not client.session_timeout or datetime.utcnow() < client.session_timeout):
                return {
                    "status": "connected",
                    "authenticated": True,
                    "circuit_breaker": "CLOSED",
                    "message": "SAP authenticated and connected",
                }
            return {
                "status": "connected" if client.session_id else "disconnected",
                "authenticated": bool(client.session_id),
                "message": "SAP status ready",
            }
        except Exception as e:
            return {"status": "disconnected", "message": str(e)}

    def _sync_item_to_sap(
        self,
        item_code: str,
        data: Dict[str, Any],
        admin_user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Controlled two-way write-back from ATLAS to SAP Business One Service Layer.
        Strict Safety Policy:
        - Confined strictly to Item Master Data: PATCH Items('{ItemCode}') (OITM).
        - Finance and transactional write-back remains permanently disabled (FINANCE_WRITEBACK_ENABLED=False).
        - ATLAS NEVER modifies JournalEntries, Invoices, Orders, PurchaseOrders, GRPOs, or stock balances.
        - Whitelisted SAP fields: InventoryWeight, U_PerPices, U_Drawing, User_Text.
        - Missing UDFs (QC, V CHK, LM, OLNG, LPK, LBL, MC OR PT) are stored in ATLAS DB and flagged as ATLAS-managed.
        - Verifies persistence via immediate read-back GET before confirming success.
        """
        code = str(item_code).strip()
        if not code:
            raise ValueError("item_code cannot be empty.")

        # Safety Check: Enforce Item Master boundaries only
        sap_payload: Dict[str, Any] = {}
        sap_written_fields: List[str] = []
        atlas_only_fields: List[str] = []

        # 1. NT. WEIGHT -> Maps to InventoryWeight, PurchaseUnitWeight, SalesUnitWeight (Edm.Double) & U_PerPices (db_Numeric(11))
        if "nt_weight" in data and data["nt_weight"] is not None:
            try:
                w_val = float(data["nt_weight"])
                if w_val < 0:
                    raise ValueError("Field 'nt_weight' cannot be negative.")
                w_val = round(w_val, 2)
                sap_payload["InventoryWeight"] = w_val
                sap_payload["PurchaseUnitWeight"] = w_val
                sap_payload["SalesUnitWeight"] = w_val
                # In RMPL_DEMO database, U_PerPices is registered with 0 decimals (integer)
                # Commented out per requirement:
                # sap_payload["U_PerPices"] = int(round(w_val))
                sap_written_fields.extend(["InventoryWeight", "PurchaseUnitWeight", "SalesUnitWeight"])
            except (ValueError, TypeError) as ex:
                raise ValueError(f"Invalid numeric value for 'nt_weight': {ex}")

        # 2. DRW. Y/N -> Maps to U_Drawing (db_Alpha(50))
        drw_input = data.get("drw_yn") if "drw_yn" in data else data.get("drawing", data.get("drw"))
        if drw_input is not None:
            drw_val = clean_yn(drw_input)
            if drw_val in ("Y", "N"):
                sap_payload["U_Drawing"] = drw_val
                sap_written_fields.append("U_Drawing")

        # 3. QC -> Maps to U_QC (db_Alpha(1): 'Y' / 'N')
        if "qc" in data and data["qc"] is not None:
            qc_bool = clean_qc(data["qc"])
            if qc_bool is not None:
                sap_payload["U_QC"] = "Y" if qc_bool else "N"
                sap_written_fields.append("U_QC")

        # 5. V CHK -> Maps to U_V_Chk (db_Alpha(1): 'Y' / 'N')
        v_chk_input = data.get("v_chk") if "v_chk" in data else data.get("U_V_Chk")
        if v_chk_input is not None:
            v_chk_val = clean_yn(v_chk_input)
            if v_chk_val in ("Y", "N"):
                sap_payload["U_V_Chk"] = v_chk_val
                sap_written_fields.append("U_V_Chk")

        # 6. LM -> Maps to U_LM (db_Alpha(1): 'Y' / 'N')
        lm_input = data.get("lm") if "lm" in data else data.get("U_LM")
        if lm_input is not None:
            lm_val = clean_yn(lm_input)
            if lm_val in ("Y", "N"):
                sap_payload["U_LM"] = lm_val
                sap_written_fields.append("U_LM")

        # 7. OLNG -> Maps to U_OLNG (db_Alpha(1): 'Y' / 'N')
        olng_input = data.get("olng") if "olng" in data else data.get("U_OLNG")
        if olng_input is not None:
            olng_val = clean_yn(olng_input)
            if olng_val in ("Y", "N"):
                sap_payload["U_OLNG"] = olng_val
                sap_written_fields.append("U_OLNG")

        # 8. LPK / I PK -> Maps to U_LPK (db_Alpha(1): 'Y' / 'N')
        lpk_input = data.get("lpk") if "lpk" in data else (data.get("i_pk") if "i_pk" in data else data.get("U_LPK"))
        if lpk_input is not None:
            lpk_val = clean_yn(lpk_input)
            if lpk_val in ("Y", "N"):
                sap_payload["U_LPK"] = lpk_val
                sap_written_fields.append("U_LPK")

        # 9. LBL -> Maps to U_LBL (db_Alpha(1): 'Y' / 'N')
        lbl_input = data.get("lbl") if "lbl" in data else data.get("U_LBL")
        if lbl_input is not None:
            lbl_val = clean_yn(lbl_input)
            if lbl_val in ("Y", "N"):
                sap_payload["U_LBL"] = lbl_val
                sap_written_fields.append("U_LBL")

        # 10. MC OR PT -> Maps to U_MC_OR_PT (db_Alpha(1): 'Y' / 'N')
        mc_input = data.get("mc_or_pt") if "mc_or_pt" in data else (data.get("mc_pt") if "mc_pt" in data else data.get("U_MC_OR_PT"))
        if mc_input is not None:
            mc_val = clean_yn(mc_input)
            if mc_val in ("Y", "N"):
                sap_payload["U_MC_OR_PT"] = mc_val
                sap_written_fields.append("U_MC_OR_PT")

        # If no verified SAP fields were changed, save locally and return
        if not sap_payload:
            return {
                "item_code": code,
                "status": "success",
                "verified": True,
                "sap_synced": True,
                "sap_written": False,
                "sap_fields": [],
                "atlas_only_fields": [],
                "message": f"Saved in ATLAS database (no editable SAP fields in payload).",
            }

        # Step A: SAP Session and Pre-read Verification
        client = get_sap_client()
        try:
            if not client.session_id or (client.session_timeout and datetime.utcnow() >= client.session_timeout):
                client.login()
        except Exception as auth_err:
            logger.error(f"Failed to authenticate with SAP Service Layer: {auth_err}")
            raise SAPConnectionError(f"SAP Service Layer authentication failed: {auth_err}")

        # Pre-read current SAP item to ensure existence and capture baseline values
        select_props = "ItemCode,ItemName,InventoryWeight,PurchaseUnitWeight,SalesUnitWeight,U_Drawing,U_PerPices,U_QC,U_V_Chk,U_LM,U_OLNG,U_LPK,U_LBL,U_MC_OR_PT,UpdateDate,UpdateTime"
        try:
            pre_item = client.get(
                f"Items('{code}')?$select={select_props}"
            )
        except Exception as pre_err:
            logger.error(f"Failed to pre-read item '{code}' from SAP: {pre_err}")
            raise RuntimeError(f"Cannot verify item '{code}' in SAP Business One: {pre_err}")

        if not pre_item or not pre_item.get("ItemCode"):
            raise ValueError(f"Item '{code}' does not exist in SAP Business One.")

        before_values = {
            "InventoryWeight": pre_item.get("InventoryWeight"),
            "PurchaseUnitWeight": pre_item.get("PurchaseUnitWeight"),
            "SalesUnitWeight": pre_item.get("SalesUnitWeight"),
            "U_Drawing": pre_item.get("U_Drawing"),
            "U_PerPices": pre_item.get("U_PerPices"),
            "U_QC": pre_item.get("U_QC"),
            "U_V_Chk": pre_item.get("U_V_Chk"),
            "U_LM": pre_item.get("U_LM"),
            "U_OLNG": pre_item.get("U_OLNG"),
            "U_LPK": pre_item.get("U_LPK"),
            "U_LBL": pre_item.get("U_LBL"),
            "U_MC_OR_PT": pre_item.get("U_MC_OR_PT"),
            "UpdateDate": pre_item.get("UpdateDate"),
            "UpdateTime": pre_item.get("UpdateTime"),
        }

        # Strict diff: only include fields in PATCH payload that actually differ from before_values
        filtered_payload = {}
        for k, v in sap_payload.items():
            pre_v = before_values.get(k)
            is_different = False
            if k in ("InventoryWeight", "PurchaseUnitWeight", "SalesUnitWeight"):
                if pre_v is None or abs(float(pre_v) - float(v)) > 0.01:
                    is_different = True
            # elif k == "U_PerPices":
            #     if pre_v is None:
            #         is_different = True
            #     else:
            #         try:
            #             if int(round(float(pre_v))) != int(v):
            #                 is_different = True
            #         except (ValueError, TypeError):
            #             is_different = True
            else:
                str_pre = str(pre_v or "").strip().upper()
                str_v = str(v or "").strip().upper()
                if str_pre != str_v:
                    is_different = True
            if is_different:
                filtered_payload[k] = v

        if not filtered_payload:
            logger.info(f"Item {code} SAP values already match target payload; skipping redundant PATCH.")
            sap_update_date = pre_item.get("UpdateDate")
            sap_update_time = pre_item.get("UpdateTime")
            confirmed_last_updated = format_sap_last_updated(sap_update_date, sap_update_time) or get_kolkata_now().strftime("%Y-%m-%d %H:%M:%S")
            return {
                "item_code": code,
                "status": "success",
                "verified": True,
                "sap_synced": True,
                "sap_written": True,
                "sap_fields": sap_written_fields,
                "atlas_only_fields": atlas_only_fields,
                "before_values": before_values,
                "after_values": before_values,
                "confirmed_update_date": sap_update_date,
                "confirmed_update_time": sap_update_time,
                "confirmed_last_updated": confirmed_last_updated,
                "message": f"Item {code} verified in SAP Business One (values already identical).",
            }

        # Step B: Execute SAP Service Layer PATCH with strictly modified fields
        endpoint = f"Items('{code}')"
        try:
            client.patch(endpoint, data=filtered_payload)
            logger.info(f"SAP PATCH successful for {code}: {filtered_payload}")
        except Exception as patch_err:
            logger.error(f"SAP PATCH failed for {code}: {patch_err}")
            try:
                from app.services import audit_service
                audit_service.record_audit_entry(
                    user_id=str(admin_user_id or "admin"),
                    username=str(admin_user_id or "admin"),
                    role="admin",
                    entity_type="stock_configuration",
                    record_id=code,
                    action="SAP_WRITE_BACK_FAILED",
                    changes=[{"field": k, "previous": before_values.get(k), "new": v} for k, v in filtered_payload.items()],
                    status="FAILED",
                    error_message=str(patch_err),
                )
            except Exception:
                pass
            raise RuntimeError(f"SAP write-back rejected by SAP Service Layer: {patch_err}")

        # Step C: Read-Back Verification from SAP Service Layer
        try:
            post_item = client.get(
                f"Items('{code}')?$select={select_props}"
            )
        except Exception as readback_err:
            logger.error(f"SAP read-back failed for {code}: {readback_err}")
            raise RuntimeError(f"SAP read-back verification failed for '{code}': {readback_err}")

        after_values = {
            "InventoryWeight": post_item.get("InventoryWeight"),
            "PurchaseUnitWeight": post_item.get("PurchaseUnitWeight"),
            "SalesUnitWeight": post_item.get("SalesUnitWeight"),
            "U_Drawing": post_item.get("U_Drawing"),
            "U_PerPices": post_item.get("U_PerPices"),
            "U_QC": post_item.get("U_QC"),
            "U_V_Chk": post_item.get("U_V_Chk"),
            "U_LM": post_item.get("U_LM"),
            "U_OLNG": post_item.get("U_OLNG"),
            "U_LPK": post_item.get("U_LPK"),
            "U_LBL": post_item.get("U_LBL"),
            "U_MC_OR_PT": post_item.get("U_MC_OR_PT"),
            "UpdateDate": post_item.get("UpdateDate"),
            "UpdateTime": post_item.get("UpdateTime"),
        }

        # Strict read-back validation assertions
        verification_mismatches = []
        if "InventoryWeight" in filtered_payload:
            actual_wt = post_item.get("InventoryWeight")
            expected_wt = filtered_payload["InventoryWeight"]
            if actual_wt is None or abs(float(actual_wt) - float(expected_wt)) > 0.01:
                verification_mismatches.append(f"InventoryWeight expected {expected_wt}, got {actual_wt}")

        if "PurchaseUnitWeight" in filtered_payload:
            actual_p_wt = post_item.get("PurchaseUnitWeight")
            expected_p_wt = filtered_payload["PurchaseUnitWeight"]
            if actual_p_wt is None or abs(float(actual_p_wt) - float(expected_p_wt)) > 0.01:
                verification_mismatches.append(f"PurchaseUnitWeight expected {expected_p_wt}, got {actual_p_wt}")

        if "SalesUnitWeight" in filtered_payload:
            actual_s_wt = post_item.get("SalesUnitWeight")
            expected_s_wt = filtered_payload["SalesUnitWeight"]
            if actual_s_wt is None or abs(float(actual_s_wt) - float(expected_s_wt)) > 0.01:
                verification_mismatches.append(f"SalesUnitWeight expected {expected_s_wt}, got {actual_s_wt}")

        if "U_Drawing" in filtered_payload:
            actual_drw = str(post_item.get("U_Drawing") or "").strip().upper()
            expected_drw = str(filtered_payload["U_Drawing"]).strip().upper()
            if actual_drw != expected_drw:
                verification_mismatches.append(f"U_Drawing expected '{expected_drw}', got '{actual_drw}'")

        # Note: U_PerPices verification commented out per requirement
        # if "U_PerPices" in filtered_payload:
        #     actual_pp = post_item.get("U_PerPices")
        #     expected_pp = filtered_payload["U_PerPices"]
        #     try:
        #         if actual_pp is None or int(round(float(actual_pp))) != int(expected_pp):
        #             verification_mismatches.append(f"U_PerPices expected {expected_pp}, got {actual_pp}")
        #     except (ValueError, TypeError):
        #         verification_mismatches.append(f"U_PerPices conversion error: expected {expected_pp}, got {actual_pp}")

        for u_prop in ["U_QC", "U_V_Chk", "U_LM", "U_OLNG", "U_LPK", "U_LBL", "U_MC_OR_PT"]:
            if u_prop in filtered_payload:
                actual_val = str(post_item.get(u_prop) or "").strip().upper()
                expected_val = str(filtered_payload[u_prop]).strip().upper()
                if actual_val != expected_val:
                    verification_mismatches.append(f"{u_prop} expected '{expected_val}', got '{actual_val}'")

        if verification_mismatches:
            err_msg = "; ".join(verification_mismatches)
            logger.error(f"SAP read-back mismatch for {code}: {err_msg}")
            raise RuntimeError(f"SAP persistence verification failed for {code}: {err_msg}")

        # Step D: Audit Logging of Successful Write-Back
        try:
            from app.services import audit_service
            audit_service.record_audit_entry(
                user_id=str(admin_user_id or "admin"),
                username=str(admin_user_id or "admin"),
                role="admin",
                entity_type="stock_configuration",
                record_id=code,
                action="SAP_WRITE_BACK_SUCCESS",
                changes=[
                    {"field": k, "previous": before_values.get(k), "new": after_values.get(k)}
                    for k in sap_payload.keys()
                ],
                status="SUCCESS",
                sap_response=after_values,
            )
        except Exception as audit_err:
            logger.warning(f"Failed to record audit entry for {code}: {audit_err}")

        msg = f"Item {code} updated in SAP Business One & verified via read-back ({', '.join(sap_written_fields)})."
        if atlas_only_fields:
            msg += f" Note: {', '.join(atlas_only_fields)} saved in ATLAS DB (SAP UDFs pending configuration)."

        sap_update_date = post_item.get("UpdateDate")
        sap_update_time = post_item.get("UpdateTime")
        confirmed_last_updated = format_sap_last_updated(sap_update_date, sap_update_time) or get_kolkata_now().strftime("%Y-%m-%d %H:%M:%S")

        return {
            "item_code": code,
            "status": "success",
            "verified": True,
            "sap_synced": True,
            "sap_written": True,
            "sap_fields": sap_written_fields,
            "atlas_only_fields": atlas_only_fields,
            "before_values": before_values,
            "after_values": after_values,
            "confirmed_update_date": sap_update_date,
            "confirmed_update_time": sap_update_time,
            "confirmed_last_updated": confirmed_last_updated,
            "message": msg,
        }

    def resolve_po_doc_entry(
        self,
        item_code: str,
        po_no: Optional[str] = None,
        po_doc_entry: Optional[int] = None,
    ) -> Optional[int]:
        """
        Resolve the authoritative Purchase Order DocEntry for an item row.
        Priority:
        1. Directly provided po_doc_entry (> 0)
        2. Stored po_doc_entry in local database / JSON record
        3. Lookup via po_no in SAP PurchaseOrders ($filter=DocNum eq {po_no})
        4. Lookup via GRPO BaseEntry in SAP PurchaseDeliveryNotes
        """
        if po_doc_entry is not None:
            try:
                e = int(po_doc_entry)
                if e > 0:
                    return e
            except (ValueError, TypeError):
                pass

        code = str(item_code).strip()
        existing = self.get_item(code) if code else None
        if existing and existing.get("po_doc_entry"):
            try:
                e = int(existing["po_doc_entry"])
                if e > 0:
                    return e
            except (ValueError, TypeError):
                pass

        # Try to resolve from po_no
        eff_po_no = po_no or (existing.get("po_no") if existing else None)
        if eff_po_no:
            eff_clean = str(eff_po_no).strip()
            if eff_clean.isdigit():
                try:
                    client = get_sap_client()
                    if client.session_id:
                        res = client.get("PurchaseOrders", params={
                            "$filter": f"DocNum eq {eff_clean}",
                            "$select": "DocEntry,DocNum",
                            "$top": 1,
                        })
                        vals = res.get("value", []) if isinstance(res, dict) else []
                        if vals and vals[0].get("DocEntry"):
                            return int(vals[0]["DocEntry"])
                except Exception as po_lookup_err:
                    logger.debug(f"SAP PO lookup for {eff_po_no} skipped: {po_lookup_err}")
                # Fallback: in demo / standard SAP environments, DocNum often matches DocEntry
                return int(eff_clean)

        # Try to resolve from GRPO base entry if available
        eff_grpo_no = existing.get("grpo_no") if existing else None
        if eff_grpo_no:
            eff_grpo_clean = str(eff_grpo_no).strip()
            if eff_grpo_clean.isdigit():
                try:
                    client = get_sap_client()
                    if client.session_id:
                        res = client.get("PurchaseDeliveryNotes", params={
                            "$filter": f"DocNum eq {eff_grpo_clean}",
                            "$select": "DocEntry,DocNum,DocumentLines",
                            "$top": 1,
                        })
                        vals = res.get("value", []) if isinstance(res, dict) else []
                        if vals:
                            lines = vals[0].get("DocumentLines", [])
                            for l in lines:
                                if l.get("ItemCode") == code and l.get("BaseType") == 22 and l.get("BaseEntry"):
                                    return int(l["BaseEntry"])
                except Exception as grpo_lookup_err:
                    logger.debug(f"SAP GRPO lookup for {eff_grpo_no} skipped: {grpo_lookup_err}")

        return None

    def _sync_po_to_sap(
        self,
        doc_entry: int,
        comments: str,
        admin_user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Synchronize Purchase Order comments strictly to SAP PurchaseOrders({DocEntry}).
        
        Policy:
        - Strictly confined to PurchaseOrders resource: PATCH PurchaseOrders({DocEntry}).
        - Modifies only the 'Comments' field.
        - Verifies persistence via immediate read-back GET before confirming success.
        - Never modifies Item Master through this method.
        """
        try:
            entry = int(doc_entry)
            if entry <= 0:
                raise ValueError(f"Invalid Purchase Order DocEntry: {doc_entry}")
        except (ValueError, TypeError):
            raise ValueError(f"Purchase Order DocEntry must be a positive integer, got: {doc_entry}")

        target_comments = str(comments or "").strip()

        client = get_sap_client()
        try:
            if not client.session_id or (client.session_timeout and datetime.utcnow() >= client.session_timeout):
                client.login()
        except Exception as auth_err:
            logger.error(f"Failed to authenticate with SAP Service Layer for PO update: {auth_err}")
            raise SAPConnectionError(f"SAP Service Layer authentication failed: {auth_err}")

        # Step 1: Pre-read Purchase Order from SAP
        select_props = "DocEntry,DocNum,DocDate,CardCode,CardName,Comments,UpdateDate,UpdateTime"
        try:
            pre_po = client.get(f"PurchaseOrders({entry})?$select={select_props}")
        except Exception as pre_err:
            logger.error(f"Failed to pre-read Purchase Order DocEntry {entry} from SAP: {pre_err}")
            raise RuntimeError(f"Cannot verify Purchase Order DocEntry {entry} in SAP: {pre_err}")

        if not pre_po or "DocEntry" not in pre_po:
            raise ValueError(f"Purchase Order with DocEntry {entry} does not exist in SAP Business One.")

        before_comments = str(pre_po.get("Comments") or "").strip()
        doc_num = pre_po.get("DocNum")

        # Step 2: Skip redundant PATCH if comments are already identical in SAP
        if before_comments == target_comments:
            logger.info(f"Purchase Order {doc_num} (DocEntry {entry}) comments already match target; skipping redundant PATCH.")
            return {
                "doc_entry": entry,
                "doc_num": doc_num,
                "status": "success",
                "verified": True,
                "comments": before_comments,
                "before_comments": before_comments,
                "after_comments": before_comments,
                "update_date": pre_po.get("UpdateDate"),
                "update_time": pre_po.get("UpdateTime"),
                "message": f"Purchase Order {doc_num or entry} comments verified in SAP (already identical).",
            }

        # Step 3: Execute SAP Service Layer PATCH
        patch_payload = {"Comments": target_comments}
        try:
            client.patch(f"PurchaseOrders({entry})", data=patch_payload)
            logger.info(f"SAP PATCH successful for PurchaseOrders({entry}): {patch_payload}")
        except Exception as patch_err:
            logger.error(f"SAP PATCH failed for PurchaseOrders({entry}): {patch_err}")
            try:
                from app.services import audit_service
                audit_service.record_audit_entry(
                    user_id=str(admin_user_id or "admin"),
                    username=str(admin_user_id or "admin"),
                    role="admin",
                    entity_type="purchase_order",
                    record_id=str(entry),
                    action="SAP_PO_WRITE_BACK_FAILED",
                    changes=[{"field": "Comments", "previous": before_comments, "new": target_comments}],
                    status="FAILED",
                    error_message=str(patch_err),
                )
            except Exception:
                pass
            raise RuntimeError(f"Purchase Order write-back rejected by SAP Service Layer: {patch_err}")

        # Step 4: Immediate Read-Back Verification from SAP
        try:
            post_po = client.get(f"PurchaseOrders({entry})?$select={select_props}")
        except Exception as readback_err:
            logger.error(f"SAP read-back failed for PurchaseOrders({entry}): {readback_err}")
            raise RuntimeError(f"SAP read-back verification failed for PurchaseOrders({entry}): {readback_err}")

        after_comments = str(post_po.get("Comments") or "").strip()
        if after_comments != target_comments:
            raise RuntimeError(
                f"Purchase Order read-back verification mismatch for DocEntry {entry}: "
                f"expected '{target_comments}', got '{after_comments}'"
            )

        # Step 5: Audit Log
        try:
            from app.services import audit_service
            audit_service.record_audit_entry(
                user_id=str(admin_user_id or "admin"),
                username=str(admin_user_id or "admin"),
                role="admin",
                entity_type="purchase_order",
                record_id=str(entry),
                action="SAP_PO_WRITE_BACK_SUCCESS",
                changes=[{"field": "Comments", "previous": before_comments, "new": after_comments}],
                status="SUCCESS",
                sap_response={"Comments": after_comments},
            )
        except Exception as audit_err:
            logger.warning(f"Failed to record audit entry for PO {entry}: {audit_err}")

        return {
            "doc_entry": entry,
            "doc_num": doc_num,
            "status": "success",
            "verified": True,
            "comments": after_comments,
            "before_comments": before_comments,
            "after_comments": after_comments,
            "update_date": post_po.get("UpdateDate"),
            "update_time": post_po.get("UpdateTime"),
            "message": f"Purchase Order {doc_num or entry} comments updated in SAP & verified via read-back.",
        }

    def update_item(self, item_code: str, data: Dict[str, Any], admin_user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Update user-configurable fields for a specific stock configuration item.
        Orchestrates two independent write-back targets:
        1. SAP Item Master Data: U_QC, U_Drawing, U_V_Chk, U_LM, U_OLNG, U_LPK, U_LBL, U_MC_OR_PT, NT. WEIGHT
        2. SAP Purchase Orders: Comments (from REMARKS) using verified PO DocEntry.
        SAP-owned read-only fields (qty, stock_qty, vendor_name, grpo_no, rcvd_qty, ok_qty,
        rej_qty, description, entry_date) are strictly preserved.
        """
        code = str(item_code).strip()
        existing_item = self.get_item(code)
        if not existing_item:
            raise ValueError(f"Item {code} not found in stock configuration.")

        # 1. Collect user-configurable Item Master fields
        updates: Dict[str, Any] = {}
        if admin_user_id:
            updates["last_submitted_by"] = str(admin_user_id)

        if "nt_weight" in data and data["nt_weight"] is not None:
            try:
                val = float(data["nt_weight"])
                if val < 0:
                    raise ValueError("Field 'nt_weight' cannot be negative.")
                updates["nt_weight"] = round(val, 2)
            except (ValueError, TypeError) as ex:
                if "cannot be negative" in str(ex):
                    raise
                raise ValueError("Invalid numeric value for 'nt_weight'.")

        if "qc" in data and data["qc"] is not None:
            qc_c = clean_qc(data["qc"])
            if qc_c is not None:
                updates["qc"] = qc_c

        for f in ["drw_yn", "v_chk", "lm", "olng", "lpk", "lbl", "mc_or_pt"]:
            if f in data and data[f] is not None:
                c_val = clean_yn(data[f])
                if c_val:
                    updates[f] = c_val

        # Support common aliases
        if "i_pk" in data and "lpk" not in updates and data["i_pk"] is not None:
            c_val = clean_yn(data["i_pk"])
            if c_val:
                updates["lpk"] = c_val
        if "mc_pt" in data and "mc_or_pt" not in updates and data["mc_pt"] is not None:
            c_val = clean_yn(data["mc_pt"])
            if c_val:
                updates["mc_or_pt"] = c_val
        if "drawing" in data and "drw_yn" not in updates and data["drawing"] is not None:
            c_val = clean_yn(data["drawing"])
            if c_val:
                updates["drw_yn"] = c_val

        # 2. Check for actual Item Master changes
        has_item_master_changes = False
        for k, v in updates.items():
            if k == "last_submitted_by":
                continue
            curr_v = existing_item.get(k)
            if k == "nt_weight":
                if curr_v is None or abs(float(curr_v) - float(v)) > 0.001:
                    has_item_master_changes = True
                    break
            elif k == "qc":
                if curr_v != v:
                    has_item_master_changes = True
                    break
            else:
                if str(curr_v or "").strip().upper() != str(v or "").strip().upper():
                    has_item_master_changes = True
                    break

        # 3. Check for REMARKS (Purchase Order Comments) changes
        has_remark_in_payload = "remark" in data and data["remark"] is not None
        new_remark = str(data["remark"]).strip() if has_remark_in_payload else None
        prev_remark = str(existing_item.get("remark") or "").strip()
        remark_changed = has_remark_in_payload and (new_remark != prev_remark)

        # Track results for separate Item Master and Purchase Order updates
        item_master_result: Dict[str, Any] = {"status": "unchanged", "message": "No Item Master fields modified"}
        po_result: Dict[str, Any] = {"status": "unchanged", "message": "No PO comments modified"}
        im_error: Optional[str] = None
        po_error: Optional[str] = None
        confirmed_last_updated = None

        # Step A: Execute Purchase Order update if remarks changed
        resolved_doc_entry = None
        if remark_changed:
            resolved_doc_entry = self.resolve_po_doc_entry(
                code,
                po_no=data.get("po_no"),
                po_doc_entry=data.get("po_doc_entry"),
            )
            # Website is authoritative: always ensure user-entered remark is saved locally
            updates["remark"] = new_remark
            if resolved_doc_entry:
                updates["po_doc_entry"] = resolved_doc_entry

            if not resolved_doc_entry:
                po_error = f"Cannot update REMARKS in SAP for item '{code}': No associated Purchase Order found (DocEntry missing)."
                po_result = {"status": "error", "error": po_error}
                logger.warning(po_error)
            else:
                try:
                    po_result = self._sync_po_to_sap(resolved_doc_entry, new_remark, admin_user_id=admin_user_id)
                except Exception as p_err:
                    po_error = str(p_err)
                    po_result = {"status": "error", "doc_entry": resolved_doc_entry, "error": po_error}
                    logger.warning(f"Purchase Order update failed for {code} (DocEntry {resolved_doc_entry}): {p_err}")

        # Step B: Execute Item Master update if item fields changed
        if has_item_master_changes:
            try:
                item_master_result = self._sync_item_to_sap(code, updates, admin_user_id=admin_user_id)
                confirmed_last_updated = item_master_result.get("confirmed_last_updated")
            except Exception as im_err:
                im_error = str(im_err)
                item_master_result = {"status": "error", "error": im_error}
                logger.error(f"Item Master update failed for {code}: {im_err}")

        # Step C: Assess combined results
        if im_error and po_error:
            raise RuntimeError(f"Both SAP updates failed for {code} - Item Master: {im_error}; Purchase Order: {po_error}")
        elif im_error and not remark_changed:
            raise RuntimeError(f"Item Master write-back failed for {code}: {im_error}")

        is_partial = bool(im_error or po_error)
        overall_success = not is_partial

        # Construct user-facing status message
        messages: List[str] = []
        if item_master_result.get("status") == "success":
            messages.append("Item Master updated in SAP")
        elif im_error:
            messages.append(f"Item Master update failed ({im_error})")

        if po_result.get("status") == "success":
            po_id_str = str(po_result.get("doc_num") or resolved_doc_entry)
            messages.append(f"Purchase Order {po_id_str} comments updated in SAP")
        elif po_error:
            messages.append(f"Purchase Order update failed ({po_error})")

        if not messages:
            final_message = f"Item {code} verified (no values modified)."
        else:
            final_message = "; ".join(messages) + "."

        # Stamping last updated timestamp
        now = get_kolkata_now()
        if confirmed_last_updated:
            try:
                confirmed_dt = datetime.strptime(confirmed_last_updated, "%Y-%m-%d %H:%M:%S").replace(tzinfo=KOLKATA_TZ)
                updates["last_submitted_at"] = confirmed_dt
                updates["updated_at"] = confirmed_dt
            except Exception:
                updates["last_submitted_at"] = now
                updates["updated_at"] = now
        elif overall_success or is_partial:
            updates["last_submitted_at"] = now
            updates["updated_at"] = now

        # Step D: Persistence in Database & Fallback Storage
        try:
            with self._get_connection() as conn:
                with get_db_cursor(conn, dict_cursor=True) as cur:
                    if updates:
                        set_items = [f"{col} = %({col})s" for col in updates.keys()]
                        sql = f"""
                            UPDATE stock_configuration
                            SET {', '.join(set_items)}
                            WHERE item_code = %(code)s;
                        """
                        cur.execute(sql, {**updates, "code": code})

                    if remark_changed:
                        try:
                            cur.execute(
                                """
                                INSERT INTO stock_configuration_audit (
                                    item_code, previous_remark, new_remark, admin_user_id, action, created_at
                                ) VALUES (
                                    %(code)s, %(prev)s, %(new)s, %(user)s, 'UPDATE_REMARK', %(now)s
                                );
                                """,
                                {
                                    "code": code,
                                    "prev": prev_remark,
                                    "new": new_remark,
                                    "user": str(admin_user_id or "admin"),
                                    "now": now,
                                },
                            )
                        except Exception:
                            pass

                    cur.execute("SELECT * FROM stock_configuration WHERE item_code = %(code)s;", {"code": code})
                    row = cur.fetchone()
                    if not row:
                        raise ValueError(f"Item {code} not found in stock configuration.")
                    result = dict(row)
                    for num_col in ["qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"]:
                        if result.get(num_col) is not None:
                            result[num_col] = float(result[num_col])
                    if isinstance(result.get("updated_at"), datetime):
                        result["updated_at"] = result["updated_at"].isoformat()
                    if isinstance(result.get("last_submitted_at"), (datetime, date)):
                        result["last_submitted_at"] = result["last_submitted_at"].isoformat()
                    result["remark"] = str(result.get("remark") or "")

                    # Keep fallback JSON in sync
                    try:
                        f_items = self._read_from_fallback()
                        for it in f_items:
                            if it.get("item_code") == code:
                                it.update(updates)
                                it["updated_at"] = now.isoformat()
                                it["last_submitted_at"] = now.isoformat()
                                if admin_user_id:
                                    it["last_submitted_by"] = str(admin_user_id)
                                if remark_changed:
                                    if "remark_history" not in it:
                                        it["remark_history"] = []
                                    it["remark_history"].append({
                                        "id": len(it["remark_history"]) + 1,
                                        "item_code": code,
                                        "previous_remark": prev_remark,
                                        "new_remark": new_remark,
                                        "admin_user_id": str(admin_user_id or "admin"),
                                        "action": "UPDATE_REMARK",
                                        "created_at": now.isoformat(),
                                    })
                                break
                        self._write_to_fallback(f_items)
                    except Exception:
                        pass

                    return {
                        "item_code": code,
                        "success": overall_success,
                        "partial_success": is_partial,
                        "item": result,
                        "item_master": item_master_result,
                        "purchase_order": po_result,
                        "message": final_message,
                        "sap_message": final_message,
                        "sap_synced": overall_success or item_master_result.get("status") == "success" or po_result.get("status") == "success",
                        "last_submitted_at": result.get("last_submitted_at"),
                        "remark": result.get("remark", ""),
                    }
        except (ValueError, RuntimeError, SAPValidationError, SAPConnectionError):
            raise
        except Exception as e:
            logger.warning(f"Error updating item in PostgreSQL ({e}), falling back to JSON.")
            items = self._read_from_fallback()
            found = False
            for it in items:
                if it.get("item_code") == code:
                    it.update(updates)
                    it["updated_at"] = now.isoformat()
                    it["last_submitted_at"] = now.isoformat()
                    if admin_user_id:
                        it["last_submitted_by"] = str(admin_user_id)
                    if remark_changed:
                        if "remark_history" not in it:
                            it["remark_history"] = []
                        it["remark_history"].append({
                            "id": len(it["remark_history"]) + 1,
                            "item_code": code,
                            "previous_remark": prev_remark,
                            "new_remark": new_remark,
                            "admin_user_id": str(admin_user_id or "admin"),
                            "action": "UPDATE_REMARK",
                            "created_at": now.isoformat(),
                        })
                    found = True
                    result = it
                    break
            if not found:
                raise ValueError(f"Item {code} not found.")
            self._write_to_fallback(items)

            return {
                "item_code": code,
                "success": overall_success,
                "partial_success": is_partial,
                "item": result,
                "item_master": item_master_result,
                "purchase_order": po_result,
                "message": final_message,
                "sap_message": final_message,
                "sap_synced": overall_success or item_master_result.get("status") == "success" or po_result.get("status") == "success",
                "last_submitted_at": result.get("last_submitted_at"),
                "remark": result.get("remark", ""),
            }

    def bulk_update_items(self, items_data: List[Dict[str, Any]], admin_user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Bulk update user-configurable fields with per-row status tracking,
        and automated SAP Business One synchronization (Item Master + Purchase Orders).
        SAP-owned fields are protected and preserved.
        """
        results: List[Dict[str, Any]] = []
        successful_count = 0
        failed_count = 0
        sap_synced_count = 0

        for item_data in items_data:
            code = str(item_data.get("item_code") or "").strip()
            if not code:
                failed_count += 1
                results.append({"item_code": "", "success": False, "error": "Missing item_code in update item."})
                continue

            # Validate nt_weight against negative value
            if "nt_weight" in item_data and item_data["nt_weight"] is not None:
                try:
                    val = float(item_data["nt_weight"])
                    if val < 0:
                        failed_count += 1
                        results.append({"item_code": code, "success": False, "error": "Field 'nt_weight' cannot be negative."})
                        continue
                except (ValueError, TypeError):
                    failed_count += 1
                    results.append({"item_code": code, "success": False, "error": "Invalid numeric value for 'nt_weight'."})
                    continue

            try:
                res = self.update_item(code, item_data, admin_user_id=admin_user_id)
                is_success = bool(res.get("success", False))
                is_partial = bool(res.get("partial_success", False))
                if is_success or is_partial:
                    successful_count += 1
                else:
                    failed_count += 1

                if res.get("sap_synced"):
                    sap_synced_count += 1

                results.append({
                    "item_code": code,
                    "success": is_success,
                    "partial_success": is_partial,
                    "item": res.get("item") or res,
                    "item_master": res.get("item_master"),
                    "purchase_order": res.get("purchase_order"),
                    "sap_synced": res.get("sap_synced", False),
                    "sap_message": res.get("sap_message", ""),
                    "message": res.get("message", ""),
                })
            except Exception as ex:
                failed_count += 1
                results.append({"item_code": code, "success": False, "error": str(ex)})

        return {
            "total": len(items_data),
            "successful": successful_count,
            "failed": failed_count,
            "sap_synced_count": sap_synced_count,
            "results": results,
        }

    def add_item(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new item to the stock configuration table."""
        code = str(data.get("item_code") or "").strip()
        if not code:
            raise ValueError("SAP Code (Item Code) is required.")

        desc = str(data.get("description") or "").strip()
        if not desc:
            raise ValueError("Description is required.")

        def clean_field(v: Any) -> str:
            if v is None:
                return ""
            s = str(v).strip().upper()
            return "Y" if s.startswith("Y") or s in ["1", "TRUE"] else ("N" if s.startswith("N") or s in ["0", "FALSE"] else s)

        now = get_kolkata_now()
        new_item = {
            "item_code": code,
            "description": desc,
            "qty": max(0.0, float(data.get("qty", 0.0))),
            "stock_qty": max(0.0, float(data.get("stock_qty", 0.0))),
            "vendor_name": str(data.get("vendor_name") or "").strip(),
            "vendor_code": str(data.get("vendor_code") or "").strip(),
            "grpo_no": str(data.get("grpo_no") or "").strip(),
            "rcvd_qty": max(0.0, float(data.get("rcvd_qty", 0.0))),
            "nt_weight": max(0.0, float(data.get("nt_weight", 0.0))),
            "qc": bool(data.get("qc", False)),
            "drw_yn": clean_field(data.get("drw_yn")),
            "v_chk": clean_field(data.get("v_chk")),
            "ok_qty": max(0.0, float(data.get("ok_qty", 0.0))),
            "rej_qty": max(0.0, float(data.get("rej_qty", 0.0))),
            "lm": clean_field(data.get("lm")),
            "olng": clean_field(data.get("olng")),
            "lpk": clean_field(data.get("lpk")),
            "lbl": clean_field(data.get("lbl")),
            "mc_or_pt": clean_field(data.get("mc_or_pt")),
            "items_group_code": str(data.get("items_group_code") or "Finished Goods").strip(),
            "warehouse_code": str(data.get("warehouse_code") or "01").strip(),
            "is_active": bool(data.get("is_active", True)),
            "created_at": now,
            "updated_at": now,
        }

        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO stock_configuration (
                            item_code, description, qty, stock_qty, vendor_name, vendor_code,
                            grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty,
                            lm, olng, lpk, lbl, mc_or_pt, items_group_code, warehouse_code,
                            is_active, created_at, updated_at
                        ) VALUES (
                            %(item_code)s, %(description)s, %(qty)s, %(stock_qty)s, %(vendor_name)s, %(vendor_code)s,
                            %(grpo_no)s, %(rcvd_qty)s, %(nt_weight)s, %(qc)s, %(drw_yn)s, %(v_chk)s, %(ok_qty)s, %(rej_qty)s,
                            %(lm)s, %(olng)s, %(lpk)s, %(lbl)s, %(mc_or_pt)s, %(items_group_code)s, %(warehouse_code)s,
                            %(is_active)s, %(created_at)s, %(updated_at)s
                        );
                        """,
                        new_item,
                    )
                    conn.commit()
                    return self.get_item(code) or new_item
        except Exception as e:
            if "Duplicate entry" in str(e) or "already exists" in str(e) or (psycopg2 and isinstance(e, psycopg2.IntegrityError)):
                raise ValueError(f"Item code '{code}' already exists.")
            logger.warning(f"Error inserting item in database ({e}), falling back to JSON.")
            items = self._read_from_fallback()
            if any(it.get("item_code") == code for it in items):
                raise ValueError(f"Item code '{code}' already exists.")
            new_item["created_at"] = now.isoformat()
            new_item["updated_at"] = now.isoformat()
            items.append(new_item)
            self._write_to_fallback(items)
            return new_item

    def delete_item(self, item_code: str) -> bool:
        """Delete an item from stock configuration."""
        code = str(item_code).strip()
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM stock_configuration WHERE item_code = %(code)s;", {"code": code})
                    if cur.rowcount == 0:
                        raise ValueError(f"Item {code} not found.")
                    conn.commit()
                    return True
        except ValueError:
            raise
        except Exception as e:
            logger.warning(f"Error deleting from database ({e}), falling back to JSON.")
            items = self._read_from_fallback()
            initial_len = len(items)
            items = [it for it in items if it.get("item_code") != code]
            if len(items) == initial_len:
                raise ValueError(f"Item {code} not found.")
            self._write_to_fallback(items)
            return True

    def get_item(self, item_code: str) -> Optional[Dict[str, Any]]:
        """Fetch a single stock configuration item by item_code."""
        code = str(item_code).strip()
        try:
            with self._get_connection() as conn:
                with get_db_cursor(conn, dict_cursor=True) as cur:
                    cur.execute(
                        f"SELECT {', '.join(COLUMNS)} FROM stock_configuration WHERE item_code = %(code)s;",
                        {"code": code},
                    )
                    row = cur.fetchone()
                    if not row:
                        return None
                    item_dict = dict(row)
                    for num_col in ["qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty", "so_qty", "po_qty"]:
                        if item_dict.get(num_col) is not None:
                            item_dict[num_col] = float(item_dict[num_col])
                    for d_col in ["entry_date", "item_create_date", "so_date", "po_date", "grn_date"]:
                        if isinstance(item_dict.get(d_col), (datetime, date)):
                            item_dict[d_col] = item_dict[d_col].isoformat()
                    if isinstance(item_dict.get("created_at"), datetime):
                        item_dict["created_at"] = item_dict["created_at"].isoformat()
                    if isinstance(item_dict.get("updated_at"), datetime):
                        item_dict["updated_at"] = item_dict["updated_at"].isoformat()
                    if isinstance(item_dict.get("last_submitted_at"), (datetime, date)):
                        item_dict["last_submitted_at"] = item_dict["last_submitted_at"].isoformat()
                    item_dict["remark"] = str(item_dict.get("remark") or "")
                    return item_dict
        except Exception as e:
            logger.warning(f"Error fetching item {code} from PostgreSQL ({e}), checking JSON fallback.")
            items = self._read_from_fallback()
            for it in items:
                if it.get("item_code") == code:
                    return it
            return None

    def get_remark_history(self, item_code: str) -> List[Dict[str, Any]]:
        """Retrieve audit history of remarks for a specific item code."""
        code = str(item_code).strip()
        history = []
        try:
            with self._get_connection() as conn:
                with get_db_cursor(conn, dict_cursor=True) as cur:
                    cur.execute(
                        """
                        SELECT id, item_code, previous_remark, new_remark, admin_user_id, action, created_at
                        FROM stock_configuration_audit
                        WHERE item_code = %(code)s
                        ORDER BY created_at DESC;
                        """,
                        {"code": code},
                    )
                    rows = cur.fetchall()
                    for r in rows:
                        entry = dict(r)
                        if isinstance(entry.get("created_at"), (datetime, date)):
                            entry["created_at"] = entry["created_at"].isoformat()
                        history.append(entry)
                    return history
        except Exception as e:
            logger.warning(f"Error fetching remark audit history from PostgreSQL ({e}), checking JSON fallback.")
            items = self._read_from_fallback()
            for it in items:
                if it.get("item_code") == code:
                    return list(reversed(it.get("remark_history", [])))
            return []

    def _upsert_sap_items_cursor(
        self,
        cur: Any,
        conn: Any,
        sap_items: List[Dict[str, Any]],
        received_map: Optional[Dict[str, Dict[str, Any]]] = None,
        pending_po_map: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> int:
        """
        Batch upsert SAP items into stock_configuration table preserving user remarks and configurable fields.
        Incorporates Goods Receipt POs (Received Stock), Open Purchase Orders (Pending Receipt), and Item Master data.
        Uses execute_values for high-performance bulk synchronization.
        """
        if not sap_items and not received_map and not pending_po_map:
            return 0

        received_map = received_map or {}
        pending_po_map = pending_po_map or {}
        now = get_kolkata_now()

        # Get current max sr_no
        cur.execute("SELECT COALESCE(MAX(sr_no), 0) FROM stock_configuration;")
        next_sr = (cur.fetchone()[0] or 0) + 1

        # Check which items already exist to retain their sr_no
        all_candidate_codes = [it.get("ItemCode") for it in sap_items if it.get("ItemCode")]
        for c in received_map.keys():
            all_candidate_codes.append(c)
        for c in pending_po_map.keys():
            all_candidate_codes.append(c)

        existing_items = {}
        if all_candidate_codes:
            unique_codes = list(set(all_candidate_codes))
            for k in range(0, len(unique_codes), 500):
                chunk = unique_codes[k:k+500]
                placeholders = ",".join(["%s"] * len(chunk))
                cur.execute(f"SELECT item_code, sr_no FROM stock_configuration WHERE item_code IN ({placeholders});", tuple(chunk))
                for row in cur.fetchall():
                    existing_items[row[0]] = row[1]

        rows_to_upsert = []
        handled_codes = set()

        for s_item in sap_items:
            code = s_item.get("ItemCode")
            if not code or code in handled_codes:
                continue
            handled_codes.add(code)
            name = s_item.get("ItemName") or code
            stock = float(s_item.get("QuantityOnStock") or 0.0)
            is_active = (s_item.get("Valid") == "tYES" and s_item.get("Frozen") != "tYES")
            group = str(s_item.get("U_SUBG") or s_item.get("ItemsGroupCode") or "Standard")
            vendor_code = s_item.get("Mainsupplier") or ""
            vendor_name = vendor_code

            # SAP Net Weight: check PurchaseUnitWeight, InventoryWeight, SalesUnitWeight, U_PerPices
            nt_weight = round(float(
                s_item.get("PurchaseUnitWeight")
                or s_item.get("InventoryWeight")
                or s_item.get("SalesUnitWeight")
                or s_item.get("U_PerPices")
                or 0.0
            ), 4)

            # QC and configuration flags: preserve user/DB values if blank in SAP; default to Y/True for new rows
            qc_val = clean_qc(s_item.get("U_QC"))
            drw_yn = clean_yn(s_item.get("U_Drawing") or s_item.get("U_JobDrawing"))
            v_chk = clean_yn(s_item.get("U_V_Chk"))
            lm = clean_yn(s_item.get("U_LM"))
            olng = clean_yn(s_item.get("U_OLNG"))
            lpk = clean_yn(s_item.get("U_LPK"))
            lbl = clean_yn(s_item.get("U_LBL"))
            mc_or_pt = clean_yn(s_item.get("U_MC_OR_PT"))

            if code not in existing_items:
                if qc_val is None:
                    qc_val = True
                drw_yn = drw_yn or "Y"
                v_chk = v_chk or "Y"
                lm = lm or "Y"
                olng = olng or "Y"
                lpk = lpk or "Y"
                lbl = lbl or "Y"
                mc_or_pt = mc_or_pt or "Y"

            po_comment = ""
            if code in received_map:
                po_comment = received_map[code].get("po_comments", "")
            elif code in pending_po_map:
                po_comment = pending_po_map[code].get("po_comments", "")
            sap_remark = po_comment or str(s_item.get("User_Text") or "").strip()

            raw_create = s_item.get("CreateDate")
            item_create_date = str(raw_create).split("T")[0] if raw_create else None
            sap_last_updated = format_sap_last_updated(s_item.get("UpdateDate"), s_item.get("UpdateTime")) or now.strftime("%Y-%m-%d %H:%M:%S")

            if code in existing_items:
                item_sr = existing_items[code]
            else:
                item_sr = next_sr
                next_sr += 1
                existing_items[code] = item_sr

            if code in received_map:
                info = received_map[code]
                record_cat = "Received Stock"
                grpo_no = info.get("grpo_no", "")
                rcvd_qty = float(info.get("rcvd_qty", 0.0))
                grn_date = info.get("grn_date")
                po_no = info.get("po_no", "")
                po_date = info.get("po_date")
                po_qty = float(info.get("po_qty", 0.0))
                entry_date = grn_date or po_date or item_create_date or now.strftime("%Y-%m-%d")
                so_no = info.get("so_no", "")
                so_date = info.get("so_date")
                so_qty = float(info.get("so_qty", 0.0))
                # QTY is Sales Order quantity (from ORDR/RDR1) if linked via OPOR.ImportEnt (Branch 1), else 0.0 (Branch 2 / Direct GRPO)
                qty = so_qty if (so_no and so_qty > 0) else 0.0
                ok_qty = float(info.get("ok_qty", rcvd_qty))
                rej_qty = float(info.get("rej_qty", 0.0))
                if info.get("vendor_name"):
                    vendor_name = info["vendor_name"]
                    vendor_code = info.get("vendor_code") or vendor_code
            elif code in pending_po_map:
                pinfo = pending_po_map[code]
                record_cat = "Pending Receipt"
                grpo_no = ""
                rcvd_qty = 0.0
                grn_date = None
                po_no = pinfo.get("po_no", "")
                po_date = pinfo.get("po_date")
                po_qty = float(pinfo.get("po_qty", 0.0))
                entry_date = po_date or item_create_date or now.strftime("%Y-%m-%d")
                so_no = pinfo.get("so_no", "")
                so_date = pinfo.get("so_date")
                so_qty = float(pinfo.get("so_qty", 0.0))
                # QTY is Sales Order quantity if linked via OPOR.ImportEnt (Branch 1), else 0.0 (Branch 2)
                qty = so_qty if (so_no and so_qty > 0) else 0.0
                ok_qty = 0.0
                rej_qty = 0.0
                if pinfo.get("vendor_name"):
                    vendor_name = pinfo["vendor_name"]
                    vendor_code = pinfo.get("vendor_code") or vendor_code
            else:
                record_cat = "Item Master"
                grpo_no = ""
                rcvd_qty = 0.0
                grn_date = None
                po_no = ""
                po_date = None
                po_qty = 0.0
                so_no = ""
                so_date = None
                so_qty = 0.0
                entry_date = item_create_date or now.strftime("%Y-%m-%d")
                qty = 0.0
                ok_qty = 0.0
                rej_qty = 0.0

            rows_to_upsert.append((
                item_sr, code, name, qty, stock, vendor_name, vendor_code,
                grpo_no, rcvd_qty, nt_weight, qc_val, drw_yn, v_chk, ok_qty, rej_qty,
                lm, olng, lpk, lbl, mc_or_pt, group, '01',
                is_active, entry_date, sap_remark, now, sap_last_updated,
                record_cat, item_create_date, so_date, po_date, grn_date,
                po_no, so_no, so_qty, po_qty
            ))

        if not rows_to_upsert:
            return 0

        if is_mysql():
            upsert_sql = """
                INSERT INTO stock_configuration (
                    sr_no, item_code, description, qty, stock_qty, vendor_name, vendor_code,
                    grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty,
                    lm, olng, lpk, lbl, mc_or_pt, items_group_code, warehouse_code,
                    is_active, entry_date, remark, created_at, updated_at,
                    record_category, item_create_date, so_date, po_date, grn_date,
                    po_no, so_no, so_qty, po_qty
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s
                )
                ON DUPLICATE KEY UPDATE
                    stock_qty = VALUES(stock_qty),
                    is_active = VALUES(is_active),
                    description = VALUES(description),
                    nt_weight = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.nt_weight, IF(stock_configuration.nt_weight > 0, stock_configuration.nt_weight, VALUES(nt_weight))),
                    drw_yn = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.drw_yn, IF(stock_configuration.drw_yn != '', stock_configuration.drw_yn, VALUES(drw_yn))),
                    remark = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.remark, IF(stock_configuration.remark != '', stock_configuration.remark, VALUES(remark))),
                    qc = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.qc, IF(stock_configuration.qc IS NOT NULL, stock_configuration.qc, VALUES(qc))),
                    v_chk = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.v_chk, IF(stock_configuration.v_chk != '', stock_configuration.v_chk, VALUES(v_chk))),
                    lm = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.lm, IF(stock_configuration.lm != '', stock_configuration.lm, VALUES(lm))),
                    olng = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.olng, IF(stock_configuration.olng != '', stock_configuration.olng, VALUES(olng))),
                    lpk = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.lpk, IF(stock_configuration.lpk != '', stock_configuration.lpk, VALUES(lpk))),
                    lbl = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.lbl, IF(stock_configuration.lbl != '', stock_configuration.lbl, VALUES(lbl))),
                    mc_or_pt = IF(stock_configuration.last_submitted_at IS NOT NULL, stock_configuration.mc_or_pt, IF(stock_configuration.mc_or_pt != '', stock_configuration.mc_or_pt, VALUES(mc_or_pt))),
                    grpo_no = IF(VALUES(grpo_no) != '', VALUES(grpo_no), stock_configuration.grpo_no),
                    rcvd_qty = IF(VALUES(record_category) = 'Received Stock', VALUES(rcvd_qty), stock_configuration.rcvd_qty),
                    ok_qty = IF(VALUES(record_category) = 'Received Stock', VALUES(ok_qty), stock_configuration.ok_qty),
                    rej_qty = IF(VALUES(record_category) = 'Received Stock', VALUES(rej_qty), stock_configuration.rej_qty),
                    po_no = IF(VALUES(po_no) != '', VALUES(po_no), stock_configuration.po_no),
                    so_no = IF(VALUES(so_no) != '', VALUES(so_no), stock_configuration.so_no),
                    po_qty = IF(VALUES(record_category) != 'Item Master', VALUES(po_qty), stock_configuration.po_qty),
                    so_qty = IF(VALUES(so_no) != '', VALUES(so_qty), stock_configuration.so_qty),
                    qty = IF(VALUES(so_no) != '' AND VALUES(so_qty) > 0, VALUES(so_qty), IF(VALUES(record_category) != 'Item Master', VALUES(qty), stock_configuration.qty)),
                    entry_date = IF(VALUES(grpo_no) != '' OR VALUES(po_no) != '', VALUES(entry_date), stock_configuration.entry_date),
                    grn_date = COALESCE(VALUES(grn_date), stock_configuration.grn_date),
                    po_date = COALESCE(VALUES(po_date), stock_configuration.po_date),
                    so_date = COALESCE(VALUES(so_date), stock_configuration.so_date),
                    record_category = IF(VALUES(record_category) != 'Item Master', VALUES(record_category), stock_configuration.record_category),
                    item_create_date = COALESCE(VALUES(item_create_date), stock_configuration.item_create_date),
                    items_group_code = COALESCE(NULLIF(VALUES(items_group_code), ''), stock_configuration.items_group_code),
                    vendor_code = COALESCE(NULLIF(VALUES(vendor_code), ''), stock_configuration.vendor_code),
                    vendor_name = COALESCE(NULLIF(VALUES(vendor_name), ''), stock_configuration.vendor_name),
                    updated_at = VALUES(updated_at);
            """
            cur.executemany(upsert_sql, rows_to_upsert)
        else:
            pg_values_sql = """
                INSERT INTO stock_configuration (
                    sr_no, item_code, description, qty, stock_qty, vendor_name, vendor_code,
                    grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty,
                    lm, olng, lpk, lbl, mc_or_pt, items_group_code, warehouse_code,
                    is_active, entry_date, remark, created_at, updated_at,
                    record_category, item_create_date, so_date, po_date, grn_date,
                    po_no, so_no, so_qty, po_qty
                ) VALUES %s
                ON CONFLICT (item_code) DO UPDATE
                SET stock_qty = EXCLUDED.stock_qty,
                    is_active = EXCLUDED.is_active,
                    description = EXCLUDED.description,
                    nt_weight = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.nt_weight WHEN stock_configuration.nt_weight > 0 THEN stock_configuration.nt_weight ELSE EXCLUDED.nt_weight END,
                    drw_yn = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.drw_yn WHEN stock_configuration.drw_yn <> '' THEN stock_configuration.drw_yn ELSE EXCLUDED.drw_yn END,
                    remark = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.remark WHEN stock_configuration.remark <> '' THEN stock_configuration.remark ELSE EXCLUDED.remark END,
                    qc = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.qc WHEN stock_configuration.qc IS NOT NULL THEN stock_configuration.qc ELSE EXCLUDED.qc END,
                    v_chk = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.v_chk WHEN stock_configuration.v_chk <> '' THEN stock_configuration.v_chk ELSE EXCLUDED.v_chk END,
                    lm = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.lm WHEN stock_configuration.lm <> '' THEN stock_configuration.lm ELSE EXCLUDED.lm END,
                    olng = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.olng WHEN stock_configuration.olng <> '' THEN stock_configuration.olng ELSE EXCLUDED.olng END,
                    lpk = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.lpk WHEN stock_configuration.lpk <> '' THEN stock_configuration.lpk ELSE EXCLUDED.lpk END,
                    lbl = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.lbl WHEN stock_configuration.lbl <> '' THEN stock_configuration.lbl ELSE EXCLUDED.lbl END,
                    mc_or_pt = CASE WHEN stock_configuration.last_submitted_at IS NOT NULL THEN stock_configuration.mc_or_pt WHEN stock_configuration.mc_or_pt <> '' THEN stock_configuration.mc_or_pt ELSE EXCLUDED.mc_or_pt END,
                    grpo_no = CASE WHEN EXCLUDED.grpo_no <> '' THEN EXCLUDED.grpo_no ELSE stock_configuration.grpo_no END,
                    rcvd_qty = CASE WHEN EXCLUDED.record_category = 'Received Stock' THEN EXCLUDED.rcvd_qty ELSE stock_configuration.rcvd_qty END,
                    ok_qty = CASE WHEN EXCLUDED.record_category = 'Received Stock' THEN EXCLUDED.ok_qty ELSE stock_configuration.ok_qty END,
                    rej_qty = CASE WHEN EXCLUDED.record_category = 'Received Stock' THEN EXCLUDED.rej_qty ELSE stock_configuration.rej_qty END,
                    po_no = CASE WHEN EXCLUDED.po_no <> '' THEN EXCLUDED.po_no ELSE stock_configuration.po_no END,
                    so_no = CASE WHEN EXCLUDED.so_no <> '' THEN EXCLUDED.so_no ELSE stock_configuration.so_no END,
                    po_qty = CASE WHEN EXCLUDED.record_category <> 'Item Master' THEN EXCLUDED.po_qty ELSE stock_configuration.po_qty END,
                    so_qty = CASE WHEN EXCLUDED.so_no <> '' THEN EXCLUDED.so_qty ELSE stock_configuration.so_qty END,
                    qty = CASE WHEN EXCLUDED.so_no <> '' AND EXCLUDED.so_qty > 0 THEN EXCLUDED.so_qty WHEN EXCLUDED.record_category <> 'Item Master' THEN EXCLUDED.qty ELSE stock_configuration.qty END,
                    entry_date = CASE WHEN EXCLUDED.grpo_no <> '' OR EXCLUDED.po_no <> '' THEN EXCLUDED.entry_date ELSE stock_configuration.entry_date END,
                    grn_date = COALESCE(EXCLUDED.grn_date, stock_configuration.grn_date),
                    po_date = COALESCE(EXCLUDED.po_date, stock_configuration.po_date),
                    so_date = COALESCE(EXCLUDED.so_date, stock_configuration.so_date),
                    record_category = CASE WHEN EXCLUDED.record_category <> 'Item Master' THEN EXCLUDED.record_category ELSE stock_configuration.record_category END,
                    item_create_date = COALESCE(EXCLUDED.item_create_date, stock_configuration.item_create_date),
                    items_group_code = COALESCE(NULLIF(EXCLUDED.items_group_code, ''), stock_configuration.items_group_code),
                    vendor_code = COALESCE(NULLIF(EXCLUDED.vendor_code, ''), stock_configuration.vendor_code),
                    vendor_name = COALESCE(NULLIF(EXCLUDED.vendor_name, ''), stock_configuration.vendor_name),
                    updated_at = EXCLUDED.updated_at;
            """
            try:
                import psycopg2.extras
                psycopg2.extras.execute_values(cur, pg_values_sql, rows_to_upsert, page_size=200)
            except Exception:
                placeholders = "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                pg_exec_sql = pg_values_sql.replace("VALUES %s", f"VALUES {placeholders}")
                cur.executemany(pg_exec_sql, rows_to_upsert)
        return len(rows_to_upsert)

    def sync_from_sap(self, top: int = 1000) -> Dict[str, Any]:
        """
        Synchronize stock configuration with genuine SAP Business One data across all entities:
        Items (OITM), PurchaseDeliveryNotes (GRPO/OPDN/PDN1), PurchaseOrders (OPOR/POR1),
        and Sales Orders (ORDR/RDR1 linked via ImportEnt / ImportFileNum).
        Preserves user remarks, audit trails, and configuration fields.
        """
        client = get_sap_client()
        try:
            if not client.session_id or (client.session_timeout and datetime.utcnow() >= client.session_timeout):
                client.login()
        except Exception as err:
            raise RuntimeError(f"SAP Business One Service Layer is not connected ({str(err)}). Cannot perform live synchronization.")

        sap_service = SAPItemsService()

        # 1. Fetch live items from SAP ordered by newest/recently updated
        sap_items = sap_service.get_items(top=top, orderby="UpdateDate desc,CreateDate desc")

        # 2. Fetch recent Goods Receipt POs (PurchaseDeliveryNotes) excluding cancelled documents
        res_grpo = client.get("PurchaseDeliveryNotes", params={"$filter": "Cancelled eq 'tNO'", "$orderby": "DocEntry desc", "$top": 100})
        grpos = [g for g in res_grpo.get("value", []) if g.get("Cancelled") != "tYES"]

        # 3. Fetch recent Purchase Orders excluding cancelled documents
        res_po = client.get("PurchaseOrders", params={"$filter": "Cancelled eq 'tNO'", "$orderby": "DocEntry desc", "$top": 100})
        pos = [p for p in res_po.get("value", []) if p.get("Cancelled") != "tYES"]
        po_by_entry = {p.get("DocEntry"): p for p in pos}

        # Check for any base PO entries referenced in GRPO that are missing from po_by_entry
        missing_po_entries = set()
        for g in grpos:
            for l in g.get("DocumentLines", []):
                if l.get("BaseType") == 22 and l.get("BaseEntry"):
                    if l.get("BaseEntry") not in po_by_entry:
                        missing_po_entries.add(l.get("BaseEntry"))

        for base_entry in list(missing_po_entries)[:50]:
            try:
                po_doc = client.get(f"PurchaseOrders({base_entry})")
                if po_doc and "DocEntry" in po_doc and po_doc.get("Cancelled") != "tYES":
                    po_by_entry[po_doc["DocEntry"]] = po_doc
            except Exception as e:
                logger.warning(f"Error fetching base PO DocEntry {base_entry}: {e}")

        # 4. Fetch linked Sales Orders (Branch 1: POs linked to SOs via ImportFileNum / ImportEnt, and GRPO U_SONo)
        so_doc_nums = set()
        for p in po_by_entry.values():
            imp = p.get("ImportFileNum")
            if imp:
                try:
                    so_doc_nums.add(int(imp))
                except (ValueError, TypeError):
                    pass

        for g in grpos:
            so_hdr = g.get("U_SONo")
            if so_hdr:
                try:
                    so_doc_nums.add(int(so_hdr))
                except (ValueError, TypeError):
                    pass

        so_by_doc_num = {}
        for so_num in so_doc_nums:
            try:
                res_so = client.get("Orders", params={"$filter": f"DocNum eq {so_num} and Cancelled eq 'tNO'"})
                for so in res_so.get("value", []):
                    if so.get("Cancelled") != "tYES":
                        so_by_doc_num[so_num] = so
            except Exception as e:
                logger.warning(f"Error fetching linked SO DocNum {so_num}: {e}")

        # 5. Build received_map (keyed by ItemCode, newest GRPO first)
        received_map = {}
        for g in grpos:
            grpo_no = str(g.get("DocNum") or "")
            grn_date_raw = g.get("DocDate")
            grn_date = str(grn_date_raw).split("T")[0] if grn_date_raw else None
            vendor_name = g.get("CardName") or ""
            vendor_code = g.get("CardCode") or ""
            hdr_so_no = str(g.get("U_SONo") or "")

            for l in g.get("DocumentLines", []):
                code = l.get("ItemCode")
                if not code or code in received_map:
                    continue

                rcvd_qty = float(l.get("Quantity") or 0.0)
                rem_open_qty = float(l.get("RemainingOpenQuantity")) if l.get("RemainingOpenQuantity") is not None else rcvd_qty
                ok_qty = rem_open_qty
                rej_qty = max(0.0, rcvd_qty - rem_open_qty)

                base_type = l.get("BaseType")
                base_entry = l.get("BaseEntry")
                base_line = l.get("BaseLine")

                po_no = ""
                po_date = None
                po_qty = 0.0
                po_comments = ""
                so_no = ""
                so_date = None
                so_qty = 0.0

                if base_type == 22 and base_entry and base_entry in po_by_entry:
                    base_po = po_by_entry[base_entry]
                    po_no = str(base_po.get("DocNum") or "")
                    po_comments = str(base_po.get("Comments") or "").strip()
                    if base_po.get("DocDate"):
                        po_date = str(base_po.get("DocDate")).split("T")[0]
                    for pl in base_po.get("DocumentLines", []):
                        if pl.get("LineNum") == base_line or pl.get("ItemCode") == code:
                            po_qty = float(pl.get("Quantity") or 0.0)
                            break
                    if not po_qty:
                        po_qty = rcvd_qty

                    imp_file = base_po.get("ImportFileNum")
                    if imp_file:
                        try:
                            so_num_int = int(imp_file)
                            if so_num_int in so_by_doc_num:
                                so_doc = so_by_doc_num[so_num_int]
                                so_no = str(so_doc.get("DocNum") or imp_file)
                                if so_doc.get("DocDate"):
                                    so_date = str(so_doc.get("DocDate")).split("T")[0]
                                so_qty_total = 0.0
                                found_so_line = False
                                for sl in so_doc.get("DocumentLines", []):
                                    if sl.get("ItemCode") == code:
                                        so_qty_total += float(sl.get("Quantity") or 0.0)
                                        found_so_line = True
                                so_qty = so_qty_total if found_so_line else 0.0
                        except (ValueError, TypeError):
                            pass

                # If SO not resolved via PO, check header UDF U_SONo
                if not so_qty and hdr_so_no:
                    try:
                        so_num_int = int(hdr_so_no)
                        if so_num_int in so_by_doc_num:
                            so_doc = so_by_doc_num[so_num_int]
                            so_no = str(so_doc.get("DocNum") or hdr_so_no)
                            if so_doc.get("DocDate"):
                                so_date = str(so_doc.get("DocDate")).split("T")[0]
                            so_qty_total = 0.0
                            found_so_line = False
                            for sl in so_doc.get("DocumentLines", []):
                                if sl.get("ItemCode") == code:
                                    so_qty_total += float(sl.get("Quantity") or 0.0)
                                    found_so_line = True
                            so_qty = so_qty_total if found_so_line else 0.0
                    except (ValueError, TypeError):
                        pass

                received_map[code] = {
                    "grpo_no": grpo_no,
                    "grn_date": grn_date,
                    "rcvd_qty": rcvd_qty,
                    "ok_qty": ok_qty,
                    "rej_qty": rej_qty,
                    "vendor_name": vendor_name,
                    "vendor_code": vendor_code,
                    "po_no": po_no,
                    "po_doc_entry": int(base_entry) if (base_type == 22 and base_entry) else (int(po_no) if po_no and str(po_no).isdigit() else None),
                    "po_date": po_date,
                    "po_qty": po_qty,
                    "po_comments": po_comments,
                    "so_no": so_no if so_qty > 0 else "",
                    "so_date": so_date if so_qty > 0 else None,
                    "so_qty": so_qty,
                    "item_desc": l.get("ItemDescription"),
                }

        # 6. Build pending_po_map (for items with open POs but not received)
        pending_po_map = {}
        for p in pos:
            po_entry = p.get("DocEntry")
            po_no = str(p.get("DocNum") or "")
            po_date = str(p.get("DocDate")).split("T")[0] if p.get("DocDate") else None
            po_comments = str(p.get("Comments") or "").strip()
            vendor_name = p.get("CardName") or ""
            vendor_code = p.get("CardCode") or ""
            imp_file = p.get("ImportFileNum")
            so_no = ""
            so_date = None
            so_num_int = None
            if imp_file:
                try:
                    so_num_int = int(imp_file)
                    if so_num_int in so_by_doc_num:
                        so_doc = so_by_doc_num[so_num_int]
                        so_no = str(so_doc.get("DocNum") or imp_file)
                        if so_doc.get("DocDate"):
                            so_date = str(so_doc.get("DocDate")).split("T")[0]
                except (ValueError, TypeError):
                    pass

            for l in p.get("DocumentLines", []):
                code = l.get("ItemCode")
                if not code or code in received_map or code in pending_po_map:
                    continue
                open_qty = float(l.get("RemainingOpenQuantity") or l.get("OpenQuantity") or l.get("Quantity") or 0.0)
                so_qty = 0.0
                if so_no and so_num_int and so_num_int in so_by_doc_num:
                    so_qty_total = 0.0
                    found_so_line = False
                    for sl in so_by_doc_num[so_num_int].get("DocumentLines", []):
                        if sl.get("ItemCode") == code:
                            so_qty_total += float(sl.get("Quantity") or 0.0)
                            found_so_line = True
                    so_qty = so_qty_total if found_so_line else 0.0
                pending_po_map[code] = {
                    "po_no": po_no,
                    "po_date": po_date,
                    "po_qty": float(l.get("Quantity") or 0.0),
                    "po_comments": po_comments,
                    "open_qty": open_qty,
                    "vendor_name": vendor_name,
                    "vendor_code": vendor_code,
                    "so_no": so_no if so_qty > 0 else "",
                    "so_date": so_date if so_qty > 0 else None,
                    "so_qty": so_qty,
                    "item_desc": l.get("ItemDescription"),
                }

        # 7. Ensure all items in received_map and pending_po_map have their genuine SAP Item Master loaded
        items_by_code = {it.get("ItemCode"): it for it in sap_items if it.get("ItemCode")}
        all_candidate_codes = set(received_map.keys()) | set(pending_po_map.keys())
        for code in all_candidate_codes:
            if code not in items_by_code:
                try:
                    it = client.get(f"Items('{code}')")
                    if it and "ItemCode" in it:
                        items_by_code[code] = it
                        sap_items.append(it)
                except Exception as e:
                    logger.warning(f"Error fetching SAP Item Master for {code}: {e}")

        now = get_kolkata_now()
        synced_count = 0
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    synced_count = self._upsert_sap_items_cursor(cur, conn, sap_items, received_map, pending_po_map)
                    # Sync to fallback JSON so offline/fallback mode is also fresh
                    try:
                        cur.execute("SELECT * FROM stock_configuration ORDER BY sr_no ASC;")
                        col_names = [d[0] for d in cur.description]
                        all_db_rows = []
                        for r in cur.fetchall():
                            row_dict = dict(zip(col_names, r))
                            for dk, dv in row_dict.items():
                                if isinstance(dv, (datetime, date)):
                                    row_dict[dk] = dv.isoformat()
                            all_db_rows.append(row_dict)
                        if all_db_rows:
                            self._write_to_fallback(all_db_rows)
                    except Exception as f_err:
                        logger.warning(f"Failed to update fallback JSON during sync_from_sap: {f_err}")

            StockConfigurationService._last_synced_at = now.strftime("%Y-%m-%d %H:%M:%S")
            return {
                "success": True,
                "synced_count": synced_count,
                "total_sap_items": len(sap_items),
                "received_items_count": len(received_map),
                "pending_po_items_count": len(pending_po_map),
                "timestamp": StockConfigurationService._last_synced_at,
            }
        except Exception as e:
            logger.warning(f"Database update failed during sync_from_sap ({e}), updating fallback storage...")
            # Update fallback storage directly
            fallback_items = self._read_from_fallback()
            fb_by_code = {it.get("item_code"): it for it in fallback_items if it.get("item_code")}
            synced_count = 0
            for s_item in sap_items:
                code = s_item.get("ItemCode")
                if not code:
                    continue
                stock = float(s_item.get("QuantityOnStock") or 0.0)
                name = s_item.get("ItemName") or code
                is_active = (s_item.get("Valid") == "tYES" and s_item.get("Frozen") != "tYES")
                if code in fb_by_code:
                    fb_it = fb_by_code[code]
                    fb_it["stock_qty"] = stock
                    fb_it["description"] = name
                    fb_it["is_active"] = is_active
                    sap_last_updated = format_sap_last_updated(s_item.get("UpdateDate"), s_item.get("UpdateTime"))
                    if sap_last_updated:
                        fb_it["updated_at"] = sap_last_updated
                    else:
                        fb_it["updated_at"] = now.isoformat()
                    if s_item.get("User_Text"):
                        fb_it["remark"] = s_item.get("User_Text")
                    if code in received_map:
                        rm = received_map[code]
                        fb_it["grpo_no"] = rm.get("grpo_no") or fb_it.get("grpo_no", "")
                        fb_it["rcvd_qty"] = rm.get("rcvd_qty", fb_it.get("rcvd_qty", 0.0))
                        fb_it["po_qty"] = rm.get("po_qty", fb_it.get("po_qty", 0.0))
                        fb_it["so_qty"] = rm.get("so_qty", fb_it.get("so_qty", 0.0))
                        fb_it["so_no"] = rm.get("so_no", fb_it.get("so_no", ""))
                        fb_it["po_no"] = rm.get("po_no", fb_it.get("po_no", ""))
                        fb_it["qty"] = rm.get("so_qty") if (rm.get("so_no") and rm.get("so_qty", 0) > 0) else 0.0
                        fb_it["entry_date"] = rm.get("grn_date") or fb_it.get("entry_date")
                        fb_it["vendor_name"] = rm.get("vendor_name") or fb_it.get("vendor_name", "")
                    synced_count += 1
            self._write_to_fallback(fallback_items)
            StockConfigurationService._last_synced_at = now.strftime("%Y-%m-%d %H:%M:%S")
            return {
                "success": True,
                "synced_count": synced_count,
                "total_sap_items": len(sap_items),
                "received_items_count": len(received_map),
                "pending_po_items_count": len(pending_po_map),
                "timestamp": StockConfigurationService._last_synced_at,
                "storage": "fallback",
            }

    def export_excel(
        self,
        search: Optional[str] = None,
        vendor: Optional[str] = None,
        group: Optional[str] = None,
        warehouse: Optional[str] = None,
        branch: Optional[str] = None,
        period: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> bytes:
        """
        Export all matching stock configuration records to an Excel .xlsx workbook.
        Matches the exact column order and headers from the reference spreadsheet.
        """
        # Fetch all matching records without pagination limit
        data = self.get_items(
            page=1,
            page_size=100000,
            search=search,
            vendor=vendor,
            group=group,
            warehouse=warehouse,
            branch=branch,
            period=period,
            date_from=date_from,
            date_to=date_to,
        )
        items = data["items"]

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Stock Items"

        headers = [
            "SR. NO.",
            "SAP CODE",
            "Desc.",
            "Qty.",
            "Stock Qty.",
            "VENDOR NAME",
            "GRPO No.",
            "RCVD. Qty.",
            "NT. WEIGHT",
            "QC",
            "DRW. Y/N",
            "V CHK",
            "Ok Qty.",
            "Rej. Qty.",
            "LM",
            "OLNG",
            "I PK",
            "LBL",
            "MC or PT",
            "ENTRY DATE",
            "LAST UPDATED",
            "REMARKS",
        ]

        # Header styling
        header_font = Font(name="Calibri", size=11, bold=True, color="1E293B")
        header_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
        thin_border = Border(
            left=Side(style="thin", color="E2E8F0"),
            right=Side(style="thin", color="E2E8F0"),
            top=Side(style="thin", color="E2E8F0"),
            bottom=Side(style="thin", color="E2E8F0"),
        )
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")
        right_align = Alignment(horizontal="right", vertical="center")

        ws.append(headers)
        ws.row_dimensions[1].height = 26

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = center_align

        # Append data rows
        for idx, it in enumerate(items, start=1):
            raw_ed = it.get("entry_date")
            formatted_entry_date = "—"
            if raw_ed:
                try:
                    if isinstance(raw_ed, (datetime, date)):
                        formatted_entry_date = raw_ed.strftime("%d-%m-%Y")
                    else:
                        d_parts = str(raw_ed).split("T")[0].split("-")
                        if len(d_parts) == 3:
                            formatted_entry_date = f"{d_parts[2]}-{d_parts[1]}-{d_parts[0]}"
                        else:
                            formatted_entry_date = str(raw_ed)
                except Exception:
                    formatted_entry_date = str(raw_ed)

            raw_last_sub = it.get("last_submitted_at") or it.get("updated_at")
            formatted_last_sub = "—"
            if raw_last_sub:
                try:
                    if isinstance(raw_last_sub, (datetime, date)):
                        formatted_last_sub = raw_last_sub.strftime("%d-%m-%Y %H:%M")
                    else:
                        formatted_last_sub = str(raw_last_sub)
                except Exception:
                    formatted_last_sub = str(raw_last_sub)

            row_data = [
                idx,
                it.get("item_code", ""),
                it.get("description", ""),
                it.get("qty", 0),
                it.get("stock_qty", 0),
                it.get("vendor_name", ""),
                it.get("grpo_no", ""),
                it.get("rcvd_qty", 0),
                it.get("nt_weight", 0),
                "Y" if it.get("qc") else ("N" if it.get("qc") is False else ""),
                it.get("drw_yn") or "",
                it.get("v_chk") or "",
                it.get("ok_qty", 0),
                it.get("rej_qty", 0),
                it.get("lm") or "",
                it.get("olng") or "",
                it.get("lpk") or "",
                it.get("lbl") or "",
                it.get("mc_or_pt") or "",
                formatted_entry_date,
                formatted_last_sub,
                it.get("remark", ""),
            ]
            ws.append(row_data)
            row_num = idx + 1
            ws.row_dimensions[row_num].height = 22
            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=row_num, column=col_idx)
                cell.border = thin_border
                cell.font = Font(name="Calibri", size=10)
                if col_idx in [1, 2, 7, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21]:
                    cell.alignment = center_align
                elif col_idx in [3, 6, 22]:
                    cell.alignment = left_align
                else:
                    cell.alignment = right_align

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = 0
            col_letter = col[0].column_letter
            for cell in col:
                val = str(cell.value or "")
                if len(val) > max_len:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    def import_excel(self, file_bytes: bytes, filename: str, preview: bool = True) -> Dict[str, Any]:
        """
        Import stock configuration items from an uploaded Excel (.xlsx) or CSV file.
        Validates columns, identifies duplicate SAP codes and invalid rows, and returns
        either a preview breakdown or commits valid records.
        """
        rows: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        duplicates: List[str] = []
        seen_codes: set = set()

        if filename.lower().endswith(".csv"):
            content = file_bytes.decode("utf-8-sig", errors="replace")
            reader = csv.reader(io.StringIO(content))
            raw_rows = list(reader)
            if not raw_rows:
                raise ValueError("The uploaded CSV file is empty.")
            raw_headers = [h.strip().upper() for h in raw_rows[0]]
            data_rows = raw_rows[1:]
        else:
            try:
                wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                ws = wb.active
                data_rows = list(ws.iter_rows(values_only=True))
                if not data_rows:
                    raise ValueError("The uploaded Excel workbook contains no data.")
                raw_headers = [str(h or "").strip().upper() for h in data_rows[0]]
                data_rows = data_rows[1:]
            except Exception as e:
                raise ValueError(f"Could not read Excel file: {str(e)}")

        # Map headers flexibly
        header_map: Dict[str, int] = {}
        for idx, h in enumerate(raw_headers):
            if "SAP CODE" in h or "ITEM CODE" in h or h == "CODE":
                header_map["item_code"] = idx
            elif "DESC" in h or "NAME" in h and "VENDOR" not in h:
                header_map["description"] = idx
            elif h in ["QTY.", "QTY", "QUANTITY"]:
                header_map["qty"] = idx
            elif "STOCK" in h:
                header_map["stock_qty"] = idx
            elif "VENDOR" in h:
                header_map["vendor_name"] = idx
            elif "GRPO" in h:
                header_map["grpo_no"] = idx
            elif "RCVD" in h or "RECEIVED" in h:
                header_map["rcvd_qty"] = idx
            elif "WEIGHT" in h or "NT." in h:
                header_map["nt_weight"] = idx
            elif h in ["QC", "QC CHECK"]:
                header_map["qc"] = idx
            elif "DRW" in h:
                header_map["drw_yn"] = idx
            elif "V CHK" in h or "VISUAL" in h:
                header_map["v_chk"] = idx
            elif "OK" in h:
                header_map["ok_qty"] = idx
            elif "REJ" in h:
                header_map["rej_qty"] = idx
            elif h == "LM":
                header_map["lm"] = idx
            elif h == "OLNG":
                header_map["olng"] = idx
            elif h in ["I PK", "I/PK", "LPK", "IPK"]:
                header_map["lpk"] = idx
            elif h == "LBL":
                header_map["lbl"] = idx
            elif "MC" in h or "PT" in h:
                header_map["mc_or_pt"] = idx

        if "item_code" not in header_map:
            raise ValueError("Required column 'SAP CODE' was not found in the uploaded file.")

        for row_idx, r in enumerate(data_rows, start=2):
            if not any(r):
                continue

            def get_val(col_name: str, default: Any = "") -> Any:
                idx = header_map.get(col_name)
                if idx is not None and idx < len(r) and r[idx] is not None:
                    return r[idx]
                return default

            code = str(get_val("item_code")).strip()
            desc = str(get_val("description")).strip()

            if not code:
                errors.append({"row": row_idx, "field": "SAP CODE", "message": "SAP Code is empty."})
                continue

            if code in seen_codes:
                duplicates.append(code)
                errors.append({"row": row_idx, "field": "SAP CODE", "message": f"Duplicate SAP Code '{code}' in upload."})
                continue
            seen_codes.add(code)

            try:
                qty = float(get_val("qty", 0.0) or 0.0)
                stock_qty = float(get_val("stock_qty", 0.0) or 0.0)
                rcvd_qty = float(get_val("rcvd_qty", 0.0) or 0.0)
                nt_weight = float(get_val("nt_weight", 0.0) or 0.0)
                ok_qty = float(get_val("ok_qty", 0.0) or 0.0)
                rej_qty = float(get_val("rej_qty", 0.0) or 0.0)
            except ValueError as ve:
                errors.append({"row": row_idx, "field": "Quantities", "message": f"Invalid numerical value: {ve}"})
                continue

            def parse_bool(v: Any) -> bool:
                s = str(v).strip().lower()
                return s in ["y", "yes", "true", "1", "checked"]

            def parse_yn(v: Any) -> str:
                if v is None:
                    return ""
                s = str(v).strip().upper()
                if not s:
                    return ""
                return "Y" if s.startswith("Y") or s in ["1", "TRUE"] else ("N" if s.startswith("N") or s in ["0", "FALSE"] else s)

            parsed_row = {
                "item_code": code,
                "description": desc or f"Item {code}",
                "qty": qty,
                "stock_qty": stock_qty,
                "vendor_name": str(get_val("vendor_name", "")).strip(),
                "grpo_no": str(get_val("grpo_no", "")).strip(),
                "rcvd_qty": rcvd_qty,
                "nt_weight": nt_weight,
                "qc": parse_bool(get_val("qc")),
                "drw_yn": parse_yn(get_val("drw_yn")),
                "v_chk": parse_yn(get_val("v_chk")),
                "ok_qty": ok_qty,
                "rej_qty": rej_qty,
                "lm": parse_yn(get_val("lm")),
                "olng": parse_yn(get_val("olng")),
                "lpk": parse_yn(get_val("lpk")),
                "lbl": parse_yn(get_val("lbl")),
                "mc_or_pt": parse_yn(get_val("mc_or_pt")),
            }
            rows.append(parsed_row)

        if preview:
            return {
                "preview": True,
                "valid_count": len(rows),
                "invalid_count": len(errors),
                "duplicates": duplicates,
                "errors": errors[:50],  # cap at 50 errors
                "sample_rows": rows[:10],
            }

        # Commit valid rows to DB / storage
        committed = 0
        now = get_kolkata_now()
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    for item in rows:
                        if is_mysql():
                            cur.execute(
                                """
                                INSERT INTO stock_configuration (
                                    item_code, description, qty, stock_qty, vendor_name, vendor_code,
                                    grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty,
                                    lm, olng, lpk, lbl, mc_or_pt, created_at, updated_at
                                ) VALUES (
                                    %(item_code)s, %(description)s, %(qty)s, %(stock_qty)s, %(vendor_name)s, '',
                                    %(grpo_no)s, %(rcvd_qty)s, %(nt_weight)s, %(qc)s, %(drw_yn)s, %(v_chk)s, %(ok_qty)s, %(rej_qty)s,
                                    %(lm)s, %(olng)s, %(lpk)s, %(lbl)s, %(mc_or_pt)s, %(now)s, %(now)s
                                )
                                ON DUPLICATE KEY UPDATE
                                    nt_weight = VALUES(nt_weight),
                                    qc = VALUES(qc),
                                    drw_yn = VALUES(drw_yn),
                                    v_chk = VALUES(v_chk),
                                    lm = VALUES(lm),
                                    olng = VALUES(olng),
                                    lpk = VALUES(lpk),
                                    lbl = VALUES(lbl),
                                    mc_or_pt = VALUES(mc_or_pt),
                                    updated_at = VALUES(updated_at);
                                """,
                                {**item, "now": now},
                            )
                        else:
                            cur.execute(
                                """
                                INSERT INTO stock_configuration (
                                    item_code, description, qty, stock_qty, vendor_name, vendor_code,
                                    grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty,
                                    lm, olng, lpk, lbl, mc_or_pt, created_at, updated_at
                                ) VALUES (
                                    %(item_code)s, %(description)s, %(qty)s, %(stock_qty)s, %(vendor_name)s, '',
                                    %(grpo_no)s, %(rcvd_qty)s, %(nt_weight)s, %(qc)s, %(drw_yn)s, %(v_chk)s, %(ok_qty)s, %(rej_qty)s,
                                    %(lm)s, %(olng)s, %(lpk)s, %(lbl)s, %(mc_or_pt)s, %(now)s, %(now)s
                                )
                                ON CONFLICT (item_code) DO UPDATE SET
                                    nt_weight = EXCLUDED.nt_weight,
                                    qc = EXCLUDED.qc,
                                    drw_yn = EXCLUDED.drw_yn,
                                    v_chk = EXCLUDED.v_chk,
                                    lm = EXCLUDED.lm,
                                    olng = EXCLUDED.olng,
                                    lpk = EXCLUDED.lpk,
                                    lbl = EXCLUDED.lbl,
                                    mc_or_pt = EXCLUDED.mc_or_pt,
                                    updated_at = EXCLUDED.updated_at;
                                """,
                                {**item, "now": now},
                            )
                        committed += 1
        except Exception as e:
            logger.warning(f"Error persisting imported rows in PostgreSQL ({e}), falling back to JSON.")
            existing_items = self._read_from_fallback()
            item_map = {it["item_code"]: it for it in existing_items}
            for item in rows:
                code = item["item_code"]
                if code in item_map:
                    # Protect SAP-owned fields on conflict
                    item_map[code].update({
                        "nt_weight": item["nt_weight"],
                        "qc": item["qc"],
                        "drw_yn": item["drw_yn"],
                        "v_chk": item["v_chk"],
                        "lm": item["lm"],
                        "olng": item["olng"],
                        "lpk": item["lpk"],
                        "lbl": item["lbl"],
                        "mc_or_pt": item["mc_or_pt"],
                        "updated_at": now.isoformat(),
                    })
                else:
                    item_map[code] = {
                        **item,
                        "updated_at": now.isoformat(),
                        "created_at": now.isoformat(),
                    }
                committed += 1
            self._write_to_fallback(list(item_map.values()))

        return {
            "preview": False,
            "success": True,
            "imported_count": committed,
            "errors": errors,
        }


class StockConfigurationSyncWorker:
    """
    Automated background worker for real-time SAP Business One Stock Configuration synchronization.
    Runs periodically based on `settings.SAP_STOCK_SYNC_INTERVAL_SECONDS` (default: 30 seconds).
    Uses an asyncio.Lock to guarantee no overlapping synchronization jobs.
    Performs live delta sync of recently updated items and documents.
    """

    def __init__(self, service: "StockConfigurationService"):
        self.service = service
        self._task: Optional[Any] = None
        self._lock = None
        self._running = False
        self._last_error: Optional[str] = None
        self._error_count: int = 0
        self._consecutive_success: int = 0
        self._total_cycles: int = 0
        self._last_cycle_started_at: Optional[str] = None
        self._last_cycle_completed_at: Optional[str] = None
        self._last_synced_count: int = 0

    @property
    def is_running(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    def get_status(self) -> Dict[str, Any]:
        """Return structured real-time status dictionary."""
        return {
            "auto_sync_active": self.is_running,
            "sync_interval_seconds": int(getattr(settings, "SAP_STOCK_SYNC_INTERVAL_SECONDS", 30)),
            "total_cycles": self._total_cycles,
            "consecutive_success": self._consecutive_success,
            "error_count": self._error_count,
            "last_error": self._last_error,
            "last_synced_at": StockConfigurationService._last_synced_at,
            "last_cycle_started_at": self._last_cycle_started_at,
            "last_cycle_completed_at": self._last_cycle_completed_at,
            "last_synced_count": self._last_synced_count,
        }

    async def start(self) -> None:
        """Start the background synchronization loop."""
        import asyncio
        if self._lock is None:
            self._lock = asyncio.Lock()
        if self._task and not self._task.done():
            logger.info("Stock Configuration auto-sync worker is already running.")
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "Stock Configuration auto-sync worker started (interval=%ds, enabled=%s).",
            int(getattr(settings, "SAP_STOCK_SYNC_INTERVAL_SECONDS", 30)),
            bool(getattr(settings, "SAP_STOCK_SYNC_ENABLED", True)),
        )

    async def stop(self) -> None:
        """Cancel and clean up the background synchronization loop."""
        import asyncio
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Stock Configuration auto-sync worker stopped.")

    async def run_once(self) -> Dict[str, Any]:
        """Trigger an immediate sync cycle safely with lock protection."""
        import asyncio
        if self._lock is None:
            self._lock = asyncio.Lock()
        if self._lock.locked():
            return {"success": False, "message": "Synchronization is already in progress"}
        async with self._lock:
            loop = asyncio.get_running_loop()
            res = await loop.run_in_executor(None, self.service.refresh_live_stock_from_sap)
            if res.get("success"):
                self._last_error = None
                self._error_count = 0
                self._consecutive_success += 1
                self._last_synced_count = res.get("refreshed_count", 0)
                self._last_cycle_completed_at = get_kolkata_now().strftime("%Y-%m-%d %H:%M:%S")
            else:
                self._last_error = res.get("message")
                self._error_count += 1
                self._consecutive_success = 0
            return res

    async def _run_loop(self) -> None:
        import asyncio
        logger.info(
            "Stock Configuration auto-sync background loop active (interval=%ds).",
            int(getattr(settings, "SAP_STOCK_SYNC_INTERVAL_SECONDS", 30)),
        )
        # Brief 1-second pause to allow primary application bootstrap to finish
        await asyncio.sleep(1)
        while self._running:
            interval = max(int(getattr(settings, "SAP_STOCK_SYNC_INTERVAL_SECONDS", 30)), 5)
            try:
                if not getattr(settings, "SAP_STOCK_SYNC_ENABLED", True):
                    await asyncio.sleep(interval)
                    continue

                if self._lock is None:
                    self._lock = asyncio.Lock()

                self._total_cycles += 1
                cycle_num = self._total_cycles
                self._last_cycle_started_at = get_kolkata_now().strftime("%Y-%m-%d %H:%M:%S")
                logger.info("Stock Configuration auto-sync cycle #%d started...", cycle_num)

                async with self._lock:
                    loop = asyncio.get_running_loop()
                    res = await loop.run_in_executor(None, self.service.refresh_live_stock_from_sap)

                if res.get("success"):
                    self._last_error = None
                    self._error_count = 0
                    self._consecutive_success += 1
                    self._last_synced_count = res.get("refreshed_count", 0)
                    self._last_cycle_completed_at = get_kolkata_now().strftime("%Y-%m-%d %H:%M:%S")
                    logger.info(
                        "Stock Configuration auto-sync cycle #%d succeeded: %d items refreshed at %s.",
                        cycle_num,
                        self._last_synced_count,
                        self._last_cycle_completed_at,
                    )
                else:
                    self._last_error = res.get("message")
                    self._error_count += 1
                    self._consecutive_success = 0
                    logger.warning(
                        "Stock Configuration auto-sync cycle #%d failed: %s (consecutive errors: %d)",
                        cycle_num,
                        self._last_error,
                        self._error_count,
                    )
            except asyncio.CancelledError:
                logger.info("Stock Configuration auto-sync worker task cancelled.")
                break
            except Exception as exc:
                self._error_count += 1
                self._consecutive_success = 0
                self._last_error = str(exc)
                logger.error(
                    "Unexpected error in Stock Configuration auto-sync loop: %s",
                    exc,
                    exc_info=True,
                )

            backoff = min(interval * (1 if self._error_count <= 1 else 2), 120)
            logger.info("Next synchronization scheduled in %d seconds.", backoff)
            await asyncio.sleep(backoff)


stock_configuration_service = StockConfigurationService()
stock_sync_worker = StockConfigurationSyncWorker(stock_configuration_service)
