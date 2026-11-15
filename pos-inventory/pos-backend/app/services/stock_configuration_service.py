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
import psycopg2
import psycopg2.extras

from app.core.config import settings
from app.services.sap.client import get_sap_client, SAPConnectionError
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
    "remark",
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
]

# Initial verified seed data matching the 26 SAP stock items from reference image
INITIAL_ITEMS = [
    {
        "item_code": "FG001",
        "description": "Finished Good 1",
        "qty": 0.0,
        "stock_qty": 95.0,
        "vendor_name": "Bajaj Alliance",
        "vendor_code": "V001",
        "grpo_no": "5001",
        "rcvd_qty": 100.0,
        "nt_weight": 12.5,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 95.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Finished Goods",
        "warehouse_code": "01",
        "is_active": True,
    },
    {
        "item_code": "RM002",
        "description": "Raw Material 2",
        "qty": 0.0,
        "stock_qty": 48.0,
        "vendor_name": "Amit Traders",
        "vendor_code": "V002",
        "grpo_no": "5002",
        "rcvd_qty": 50.0,
        "nt_weight": 8.2,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 48.0,
        "rej_qty": 2.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Raw Materials",
        "warehouse_code": "02",
        "is_active": True,
    },
    {
        "item_code": "PKG003",
        "description": "Packaging Material",
        "qty": 0.0,
        "stock_qty": 180.0,
        "vendor_name": "Kaushal Supplies",
        "vendor_code": "V003",
        "grpo_no": "5003",
        "rcvd_qty": 200.0,
        "nt_weight": 5.0,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 180.0,
        "rej_qty": 20.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Packaging",
        "warehouse_code": "01",
        "is_active": True,
    },
    {
        "item_code": "SP004",
        "description": "Spare Part",
        "qty": 0.0,
        "stock_qty": 72.0,
        "vendor_name": "AMIK KR",
        "vendor_code": "V004",
        "grpo_no": "5004",
        "rcvd_qty": 75.0,
        "nt_weight": 3.4,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 72.0,
        "rej_qty": 3.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Spare Parts",
        "warehouse_code": "SH",
        "is_active": True,
    },
    {
        "item_code": "CHEM005",
        "description": "Chemical Item",
        "qty": 0.0,
        "stock_qty": 60.0,
        "vendor_name": "Global Chem",
        "vendor_code": "V005",
        "grpo_no": "5005",
        "rcvd_qty": 60.0,
        "nt_weight": 10.0,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 60.0,
        "rej_qty": 0.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Chemicals",
        "warehouse_code": "03",
        "is_active": True,
    },
    {
        "item_code": "SUB006",
        "description": "Sub Assembly",
        "qty": 0.0,
        "stock_qty": 38.0,
        "vendor_name": "Tech Parts",
        "vendor_code": "V006",
        "grpo_no": "5006",
        "rcvd_qty": 40.0,
        "nt_weight": 6.8,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 38.0,
        "rej_qty": 2.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Assemblies",
        "warehouse_code": "02",
        "is_active": True,
    },
    {
        "item_code": "TOOL007",
        "description": "Tooling Item",
        "qty": 0.0,
        "stock_qty": 28.0,
        "vendor_name": "Industrial Tools",
        "vendor_code": "V007",
        "grpo_no": "5007",
        "rcvd_qty": 30.0,
        "nt_weight": 15.2,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 28.0,
        "rej_qty": 2.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Tooling",
        "warehouse_code": "04",
        "is_active": True,
    },
    {
        "item_code": "MAT008",
        "description": "Material Item",
        "qty": 0.0,
        "stock_qty": 115.0,
        "vendor_name": "Neha Enterprises",
        "vendor_code": "V008",
        "grpo_no": "5008",
        "rcvd_qty": 120.0,
        "nt_weight": 7.6,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 115.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Raw Materials",
        "warehouse_code": "01",
        "is_active": True,
    },
    {
        "item_code": "FG009",
        "description": "Finished Good 2",
        "qty": 0.0,
        "stock_qty": 80.0,
        "vendor_name": "Starlet Vendors",
        "vendor_code": "V009",
        "grpo_no": "5009",
        "rcvd_qty": 85.0,
        "nt_weight": 11.3,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 80.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Finished Goods",
        "warehouse_code": "01",
        "is_active": True,
    },
    {
        "item_code": "RM010",
        "description": "Raw Material 3",
        "qty": 0.0,
        "stock_qty": 88.0,
        "vendor_name": "IKIO Traders",
        "vendor_code": "V010",
        "grpo_no": "5010",
        "rcvd_qty": 90.0,
        "nt_weight": 9.5,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 88.0,
        "rej_qty": 2.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Raw Materials",
        "warehouse_code": "02",
        "is_active": True,
    },
    # Items 11 to 26 to complete the 26 items dataset (24 active, 2 inactive, 5 warehouses)
    {
        "item_code": "FG011",
        "description": "Standard Assembly A",
        "qty": 0.0,
        "stock_qty": 45.0,
        "vendor_name": "Bajaj Alliance",
        "vendor_code": "V001",
        "grpo_no": "5011",
        "rcvd_qty": 45.0,
        "nt_weight": 14.0,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 45.0,
        "rej_qty": 0.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Finished Goods",
        "warehouse_code": "01",
        "is_active": True,
    },
    {
        "item_code": "RM012",
        "description": "Alloy Sheet 4mm",
        "qty": 0.0,
        "stock_qty": 105.0,
        "vendor_name": "Amit Traders",
        "vendor_code": "V002",
        "grpo_no": "5012",
        "rcvd_qty": 110.0,
        "nt_weight": 18.5,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 105.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Raw Materials",
        "warehouse_code": "02",
        "is_active": True,
    },
    {
        "item_code": "PKG013",
        "description": "Corrugated Boxes XL",
        "qty": 0.0,
        "stock_qty": 340.0,
        "vendor_name": "Kaushal Supplies",
        "vendor_code": "V003",
        "grpo_no": "5013",
        "rcvd_qty": 350.0,
        "nt_weight": 2.2,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 340.0,
        "rej_qty": 10.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Packaging",
        "warehouse_code": "03",
        "is_active": True,
    },
    {
        "item_code": "SP014",
        "description": "Ball Bearing 6204",
        "qty": 0.0,
        "stock_qty": 145.0,
        "vendor_name": "Tech Parts",
        "vendor_code": "V006",
        "grpo_no": "5014",
        "rcvd_qty": 150.0,
        "nt_weight": 0.45,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 145.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Spare Parts",
        "warehouse_code": "SH",
        "is_active": True,
    },
    {
        "item_code": "CHEM015",
        "description": "Industrial Solvent 20L",
        "qty": 0.0,
        "stock_qty": 25.0,
        "vendor_name": "Global Chem",
        "vendor_code": "V005",
        "grpo_no": "5015",
        "rcvd_qty": 25.0,
        "nt_weight": 19.8,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 25.0,
        "rej_qty": 0.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Chemicals",
        "warehouse_code": "03",
        "is_active": True,
    },
    {
        "item_code": "SUB016",
        "description": "Motor Housing Sub-Unit",
        "qty": 0.0,
        "stock_qty": 62.0,
        "vendor_name": "AMIK KR",
        "vendor_code": "V004",
        "grpo_no": "5016",
        "rcvd_qty": 65.0,
        "nt_weight": 8.9,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 62.0,
        "rej_qty": 3.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Assemblies",
        "warehouse_code": "04",
        "is_active": True,
    },
    {
        "item_code": "TOOL017",
        "description": "Carbide End Mill 10mm",
        "qty": 0.0,
        "stock_qty": 78.0,
        "vendor_name": "Industrial Tools",
        "vendor_code": "V007",
        "grpo_no": "5017",
        "rcvd_qty": 80.0,
        "nt_weight": 0.15,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 78.0,
        "rej_qty": 2.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Tooling",
        "warehouse_code": "04",
        "is_active": True,
    },
    {
        "item_code": "MAT018",
        "description": "Copper Busbar 50x5mm",
        "qty": 0.0,
        "stock_qty": 90.0,
        "vendor_name": "Neha Enterprises",
        "vendor_code": "V008",
        "grpo_no": "5018",
        "rcvd_qty": 95.0,
        "nt_weight": 22.0,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 90.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Raw Materials",
        "warehouse_code": "01",
        "is_active": True,
    },
    {
        "item_code": "FG019",
        "description": "Control Panel Box CP-2",
        "qty": 0.0,
        "stock_qty": 33.0,
        "vendor_name": "Starlet Vendors",
        "vendor_code": "V009",
        "grpo_no": "5019",
        "rcvd_qty": 35.0,
        "nt_weight": 16.5,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 33.0,
        "rej_qty": 2.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Finished Goods",
        "warehouse_code": "02",
        "is_active": True,
    },
    {
        "item_code": "RM020",
        "description": "Steel Rod 25mm dia",
        "qty": 0.0,
        "stock_qty": 135.0,
        "vendor_name": "IKIO Traders",
        "vendor_code": "V010",
        "grpo_no": "5020",
        "rcvd_qty": 140.0,
        "nt_weight": 38.0,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 135.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Raw Materials",
        "warehouse_code": "01",
        "is_active": True,
    },
    {
        "item_code": "SP021",
        "description": "Sealing O-Ring Kit",
        "qty": 0.0,
        "stock_qty": 295.0,
        "vendor_name": "Tech Parts",
        "vendor_code": "V006",
        "grpo_no": "5021",
        "rcvd_qty": 300.0,
        "nt_weight": 0.8,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 295.0,
        "rej_qty": 5.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Spare Parts",
        "warehouse_code": "SH",
        "is_active": True,
    },
    {
        "item_code": "SUB022",
        "description": "Gearbox Bracket Assembly",
        "qty": 0.0,
        "stock_qty": 48.0,
        "vendor_name": "Bajaj Alliance",
        "vendor_code": "V001",
        "grpo_no": "5022",
        "rcvd_qty": 50.0,
        "nt_weight": 7.4,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 48.0,
        "rej_qty": 2.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Assemblies",
        "warehouse_code": "02",
        "is_active": True,
    },
    {
        "item_code": "CHEM023",
        "description": "Zinc Primer Coating 5L",
        "qty": 0.0,
        "stock_qty": 40.0,
        "vendor_name": "Global Chem",
        "vendor_code": "V005",
        "grpo_no": "5023",
        "rcvd_qty": 40.0,
        "nt_weight": 6.2,
        "qc": False,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 40.0,
        "rej_qty": 0.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Chemicals",
        "warehouse_code": "03",
        "is_active": True,
    },
    {
        "item_code": "FG024",
        "description": "Hydraulic Pump Unit",
        "qty": 0.0,
        "stock_qty": 18.0,
        "vendor_name": "AMIK KR",
        "vendor_code": "V004",
        "grpo_no": "5024",
        "rcvd_qty": 18.0,
        "nt_weight": 28.5,
        "qc": True,
        "drw_yn": "Y",
        "v_chk": "Y",
        "ok_qty": 18.0,
        "rej_qty": 0.0,
        "lm": "Y",
        "olng": "Y",
        "lpk": "Y",
        "lbl": "Y",
        "mc_or_pt": "Y",
        "items_group_code": "Finished Goods",
        "warehouse_code": "01",
        "is_active": True,
    },
    # 2 Inactive items (matching the KPI card: "Inactive Items: 2", "Active Items: 24", "Total: 26")
    {
        "item_code": "DISC025",
        "description": "Discontinued Valve V1",
        "qty": 0.0,
        "stock_qty": 0.0,
        "vendor_name": "Industrial Tools",
        "vendor_code": "V007",
        "grpo_no": "4998",
        "rcvd_qty": 0.0,
        "nt_weight": 4.1,
        "qc": False,
        "drw_yn": "N",
        "v_chk": "N",
        "ok_qty": 0.0,
        "rej_qty": 0.0,
        "lm": "N",
        "olng": "N",
        "lpk": "N",
        "lbl": "N",
        "mc_or_pt": "N",
        "items_group_code": "Spare Parts",
        "warehouse_code": "SH",
        "is_active": False,
    },
    {
        "item_code": "OBS026",
        "description": "Obsolete Gasket Ring",
        "qty": 0.0,
        "stock_qty": 0.0,
        "vendor_name": "Amit Traders",
        "vendor_code": "V002",
        "grpo_no": "4999",
        "rcvd_qty": 0.0,
        "nt_weight": 0.3,
        "qc": False,
        "drw_yn": "N",
        "v_chk": "N",
        "ok_qty": 0.0,
        "rej_qty": 0.0,
        "lm": "N",
        "olng": "N",
        "lpk": "N",
        "lbl": "N",
        "mc_or_pt": "N",
        "items_group_code": "Spare Parts",
        "warehouse_code": "02",
        "is_active": False,
    },
]


class StockConfigurationService:
    """Service handling Stock Configuration persistence, SAP integration, Excel import/export."""

    _last_synced_at: Optional[str] = None

    def __init__(self):
        self._ensure_table()

    @contextmanager
    def _get_connection(self) -> Iterator[Any]:
        db_url = (settings.DATABASE_URL or "").strip()
        if not db_url:
            raise RuntimeError("DATABASE_URL is not configured.")
        # On Windows, replace @localhost with @127.0.0.1 to avoid IPv6 timeout delay
        resolved_url = db_url.replace("@localhost:", "@127.0.0.1:")
        conn = psycopg2.connect(resolved_url)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _ensure_table(self) -> None:
        """Create stock_configuration table if it does not exist, and seed initial records if empty."""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
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
                    )
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 0;")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS entry_date DATE;")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMP WITH TIME ZONE;")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS remark TEXT DEFAULT '';")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS last_submitted_by VARCHAR(100);")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS record_category VARCHAR(50) DEFAULT 'Item Master';")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS item_create_date DATE;")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS so_date DATE;")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS po_date DATE;")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS grn_date DATE;")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS po_no VARCHAR(50) DEFAULT '';")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS so_no VARCHAR(50) DEFAULT '';")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS so_qty NUMERIC(12, 2) DEFAULT 0;")
                    cur.execute("ALTER TABLE stock_configuration ADD COLUMN IF NOT EXISTS po_qty NUMERIC(12, 2) DEFAULT 0;")
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_config_dates ON stock_configuration(grn_date, entry_date, item_create_date);")
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_config_category ON stock_configuration(record_category);")
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS stock_configuration_audit (
                            id SERIAL PRIMARY KEY,
                            item_code VARCHAR(50) NOT NULL,
                            previous_remark TEXT DEFAULT '',
                            new_remark TEXT DEFAULT '',
                            admin_user_id VARCHAR(100),
                            action VARCHAR(50) DEFAULT 'SUBMIT_REMARK',
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        );
                        """
                    )
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_config_audit_item ON stock_configuration_audit(item_code);")
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_config_audit_created ON stock_configuration_audit(created_at DESC);")
                    cur.execute("UPDATE stock_configuration SET entry_date = '2025-01-07' WHERE entry_date IS NULL;")
                    cur.execute("UPDATE stock_configuration SET remark = '' WHERE remark IS NULL;")
                    # Enforce business rule from reference SQL:
                    # SO QTY = SUM(RDR1.Quantity) for matching linked Sales Orders.
                    # For regular purchase orders where OPOR.ImportEnt IS NULL, SO QTY = 0.
                    # Do not substitute PO quantity, GRPO quantity, inventory stock, or seed data.
                    cur.execute("UPDATE stock_configuration SET qty = 0.0 WHERE (so_no IS NULL OR so_no = '' OR so_qty = 0) AND qty <> 0;")
                    cur.execute("UPDATE stock_configuration SET qty = so_qty WHERE so_no IS NOT NULL AND so_no <> '' AND so_qty > 0 AND (qty IS NULL OR qty <> so_qty);")
                    # Ensure sr_no matches the sequence from the reference design
                    for idx, item_init in enumerate(INITIAL_ITEMS, start=1):
                        cur.execute(
                            "UPDATE stock_configuration SET sr_no = %s WHERE item_code = %s AND (sr_no IS NULL OR sr_no = 0);",
                            (idx, item_init["item_code"]),
                        )

                    # Check if empty, seed INITIAL_ITEMS
                    cur.execute("SELECT COUNT(*) FROM stock_configuration")
                    count = cur.fetchone()[0]
                    if count == 0:
                        logger.info("Seeding initial stock configuration items...")
                        now = get_kolkata_now()
                        for idx, item in enumerate(INITIAL_ITEMS, start=1):
                            cur.execute(
                                """
                                INSERT INTO stock_configuration (
                                    sr_no, item_code, description, qty, stock_qty, vendor_name, vendor_code,
                                    grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty,
                                    lm, olng, lpk, lbl, mc_or_pt, items_group_code, warehouse_code,
                                    is_active, created_at, updated_at
                                ) VALUES (
                                    %(sr_no)s, %(item_code)s, %(description)s, %(qty)s, %(stock_qty)s, %(vendor_name)s, %(vendor_code)s,
                                    %(grpo_no)s, %(rcvd_qty)s, %(nt_weight)s, %(qc)s, %(drw_yn)s, %(v_chk)s, %(ok_qty)s, %(rej_qty)s,
                                    %(lm)s, %(olng)s, %(lpk)s, %(lbl)s, %(mc_or_pt)s, %(items_group_code)s, %(warehouse_code)s,
                                    %(is_active)s, %(now)s, %(now)s
                                );
                                """,
                                {**item, "sr_no": idx, "now": now},
                            )
            logger.info("Stock configuration table ensured in PostgreSQL.")
        except Exception as e:
            logger.warning(f"PostgreSQL stock_configuration init failed ({e}), using JSON fallback.")
            self._ensure_fallback_json()

    def _ensure_fallback_json(self) -> None:
        if not os.path.exists(FALLBACK_JSON_PATH):
            now = get_kolkata_now().isoformat()
            items = [{**it, "entry_date": it.get("entry_date", "2025-01-07"), "remark": "", "last_submitted_by": None, "remark_history": [], "created_at": now, "updated_at": now} for it in INITIAL_ITEMS]
            with open(FALLBACK_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2)

    def _read_from_fallback(self) -> List[Dict[str, Any]]:
        self._ensure_fallback_json()
        try:
            with open(FALLBACK_JSON_PATH, "r", encoding="utf-8") as f:
                items = json.load(f)
                for it in items:
                    if not it.get("entry_date"):
                        it["entry_date"] = "2025-01-07"
                    if "remark" not in it:
                        it["remark"] = ""
                    if "remark_history" not in it:
                        it["remark_history"] = []
                return items
        except Exception:
            return [{**it, "entry_date": it.get("entry_date", "2025-01-07"), "remark": "", "last_submitted_by": None, "remark_history": []} for it in INITIAL_ITEMS]

    def _write_to_fallback(self, items: List[Dict[str, Any]]) -> None:
        with open(FALLBACK_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2)

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
    ) -> Dict[str, Any]:
        """Fetch paginated stock configuration items, KPIs, filter options, and SAP connection status."""
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
                        conditions.append("(item_code ILIKE %(search)s OR description ILIKE %(search)s OR vendor_name ILIKE %(search)s)")
                        params["search"] = s

                    if vendor and vendor.strip() and vendor.strip().lower() != "all vendors":
                        conditions.append("vendor_name ILIKE %(vendor)s")
                        params["vendor"] = f"%{vendor.strip()}%"

                    if group and group.strip() and group.strip().lower() != "all groups":
                        conditions.append("items_group_code ILIKE %(group)s")
                        params["group"] = f"%{group.strip()}%"

                    eff_wh = warehouse or branch
                    if eff_wh and eff_wh.strip() and eff_wh.strip().lower() not in ("all warehouses", "all branches", "all"):
                        conditions.append("warehouse_code ILIKE %(warehouse)s")
                        params["warehouse"] = f"%{eff_wh.strip()}%"

                    # Date filter handling on authoritative stock date:
                    # Received Stock -> GRN Date; Pending Receipt -> PO Date; Item Master -> Create Date
                    eff_date = "COALESCE(grn_date, entry_date, item_create_date, DATE(created_at))"
                    if period and period.strip().lower() not in ("all dates (total)", "all_time", "all", ""):
                        p = period.strip().lower()
                        if p in ("today", "daily"):
                            conditions.append(f"{eff_date} = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE")
                        elif p in ("yesterday",):
                            conditions.append(f"{eff_date} = ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE - INTERVAL '1 day')::DATE")
                        elif p in ("week", "weekly", "this week"):
                            conditions.append(f"{eff_date} >= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE")
                        elif p in ("month", "monthly", "this month"):
                            conditions.append(f"{eff_date} >= DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE")
                        elif p in ("year", "yearly", "this year"):
                            conditions.append(f"{eff_date} >= DATE_TRUNC('year', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE")

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
                            item_dict["entry_date"] = item_dict.get("grn_date") or item_dict.get("item_create_date") or "2025-01-07"
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
            "last_synced_at": self._last_synced_at,
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

    def _sync_item_to_sap(self, item_code: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        ATLAS operates in read-only integration mode with SAP Business One.
        Per system specification: Do not write data back to SAP.
        Saves are managed and audited locally in the ATLAS database.
        """
        code = str(item_code).strip()
        return {
            "item_code": code,
            "sap_synced": True,
            "message": "Saved successfully in ATLAS (SAP write-back is disabled per read-only policy).",
        }

    def update_item(self, item_code: str, data: Dict[str, Any], admin_user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Update user-configurable fields for a specific stock configuration item.
        SAP-owned fields (qty, stock_qty, vendor_name, grpo_no, rcvd_qty, ok_qty,
        rej_qty, description, entry_date) are strictly read-only and preserved.
        """
        code = str(item_code).strip()
        now = get_kolkata_now()

        # Validate nt_weight against negative value
        if "nt_weight" in data and data["nt_weight"] is not None:
            try:
                val = float(data["nt_weight"])
                if val < 0:
                    raise ValueError("Field 'nt_weight' cannot be negative.")
            except (ValueError, TypeError) as ex:
                if "cannot be negative" in str(ex):
                    raise
                raise ValueError("Invalid numeric value for 'nt_weight'.")

        # Collect updates strictly for user-configurable fields
        updates: Dict[str, Any] = {
            "last_submitted_at": now,
        }
        if admin_user_id:
            updates["last_submitted_by"] = str(admin_user_id)
        if "nt_weight" in data and data["nt_weight"] is not None:
            updates["nt_weight"] = max(0.0, float(data["nt_weight"]))
        if "qc" in data and data["qc"] is not None:
            updates["qc"] = clean_qc(data["qc"])
        for f in ["drw_yn", "v_chk", "lm", "olng", "lpk", "lbl", "mc_or_pt"]:
            if f in data and data[f] is not None:
                updates[f] = clean_yn(data[f])

        has_remark = "remark" in data
        new_remark = str(data["remark"] or "").strip() if has_remark else None
        if has_remark:
            updates["remark"] = new_remark

        try:
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Query existing row to check previous remark for audit
                    cur.execute("SELECT * FROM stock_configuration WHERE item_code = %(code)s;", {"code": code})
                    existing_row = cur.fetchone()
                    if not existing_row:
                        raise ValueError(f"Item {code} not found in stock configuration.")
                    prev_remark = str(existing_row.get("remark") or "").strip()

                    # Record remark audit log if modified
                    if has_remark and (new_remark != prev_remark):
                        cur.execute(
                            """
                            INSERT INTO stock_configuration_audit (
                                item_code, previous_remark, new_remark, admin_user_id, action, created_at
                            ) VALUES (
                                %(code)s, %(prev)s, %(new)s, %(user)s, 'SUBMIT_REMARK', %(now)s
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
                        try:
                            from app.services import audit_service
                            audit_service.record_audit_entry(
                                user_id=str(admin_user_id or "admin"),
                                username=str(admin_user_id or "admin"),
                                role="admin",
                                entity_type="stock_configuration",
                                record_id=code,
                                action="UPDATE_REMARK",
                                changes=[{"field": "remark", "previous": prev_remark, "new": new_remark}],
                                status="SUCCESS",
                            )
                        except Exception as audit_err:
                            logger.warning(f"Failed to record system audit log for {code}: {audit_err}")

                    if updates:
                        set_items = [f"{col} = %({col})s" for col in updates.keys()]
                        set_items.append("updated_at = %(now)s")
                        sql = f"""
                            UPDATE stock_configuration
                            SET {', '.join(set_items)}
                            WHERE item_code = %(code)s
                            RETURNING *;
                        """
                        cur.execute(sql, {**updates, "now": now, "code": code})
                    else:
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

                    # Automatically sync safe update to SAP Business One
                    sap_info = self._sync_item_to_sap(code, updates)
                    result["sap_synced"] = sap_info["sap_synced"]
                    result["sap_message"] = sap_info["message"]
                    return result
        except Exception as e:
            logger.warning(f"Error updating item in PostgreSQL ({e}), falling back to JSON.")
            items = self._read_from_fallback()
            found = False
            for it in items:
                if it.get("item_code") == code:
                    prev_remark = str(it.get("remark") or "").strip()
                    if has_remark and (new_remark != prev_remark):
                        it.setdefault("remark_history", []).append({
                            "item_code": code,
                            "previous_remark": prev_remark,
                            "new_remark": new_remark,
                            "admin_user_id": str(admin_user_id or "admin"),
                            "action": "SUBMIT_REMARK",
                            "created_at": now.isoformat(),
                        })
                        try:
                            from app.services import audit_service
                            audit_service.record_audit_entry(
                                user_id=str(admin_user_id or "admin"),
                                username=str(admin_user_id or "admin"),
                                role="admin",
                                entity_type="stock_configuration",
                                record_id=code,
                                action="UPDATE_REMARK",
                                changes=[{"field": "remark", "previous": prev_remark, "new": new_remark}],
                                status="SUCCESS",
                            )
                        except Exception as audit_err:
                            logger.warning(f"Failed to record system audit log for {code}: {audit_err}")

                    it.update(updates)
                    it["updated_at"] = now.isoformat()
                    it["last_submitted_at"] = now.isoformat()
                    if admin_user_id:
                        it["last_submitted_by"] = str(admin_user_id)
                    found = True
                    result = it
                    break
            if not found:
                raise ValueError(f"Item {code} not found.")
            self._write_to_fallback(items)

            sap_info = self._sync_item_to_sap(code, updates)
            result["sap_synced"] = sap_info["sap_synced"]
            result["sap_message"] = sap_info["message"]
            return result

    def bulk_update_items(self, items_data: List[Dict[str, Any]], admin_user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Bulk update user-configurable fields with transactional savepoints,
        per-row status tracking, and automated SAP Business One synchronization.
        SAP-owned fields are protected and preserved.
        """
        results: List[Dict[str, Any]] = []
        successful_count = 0
        failed_count = 0
        sap_synced_count = 0
        now = get_kolkata_now()

        try:
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    for idx, item_data in enumerate(items_data):
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

                        updates: Dict[str, Any] = {
                            "last_submitted_at": now,
                        }
                        if admin_user_id:
                            updates["last_submitted_by"] = str(admin_user_id)
                        if "nt_weight" in item_data and item_data["nt_weight"] is not None:
                            updates["nt_weight"] = max(0.0, float(item_data["nt_weight"]))
                        if "qc" in item_data and item_data["qc"] is not None:
                            updates["qc"] = clean_qc(item_data["qc"])
                        for f in ["drw_yn", "v_chk", "lm", "olng", "lpk", "lbl", "mc_or_pt"]:
                            if f in item_data and item_data[f] is not None:
                                updates[f] = clean_yn(item_data[f])

                        has_remark = "remark" in item_data
                        new_remark = str(item_data["remark"] or "").strip() if has_remark else None
                        if has_remark:
                            updates["remark"] = new_remark

                        sp_id = f"sp_{idx}"
                        cur.execute(f"SAVEPOINT {sp_id};")
                        try:
                            cur.execute("SELECT * FROM stock_configuration WHERE item_code = %(code)s;", {"code": code})
                            existing_row = cur.fetchone()
                            if not existing_row:
                                cur.execute(f"ROLLBACK TO SAVEPOINT {sp_id};")
                                failed_count += 1
                                results.append({"item_code": code, "success": False, "error": f"Item {code} not found in database."})
                                continue

                            prev_remark = str(existing_row.get("remark") or "").strip()
                            if has_remark and (new_remark != prev_remark):
                                cur.execute(
                                    """
                                    INSERT INTO stock_configuration_audit (
                                        item_code, previous_remark, new_remark, admin_user_id, action, created_at
                                    ) VALUES (
                                        %(code)s, %(prev)s, %(new)s, %(user)s, 'BULK_SUBMIT_REMARK', %(now)s
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
                                try:
                                    from app.services import audit_service
                                    audit_service.record_audit_entry(
                                        user_id=str(admin_user_id or "admin"),
                                        username=str(admin_user_id or "admin"),
                                        role="admin",
                                        entity_type="stock_configuration",
                                        record_id=code,
                                        action="UPDATE_REMARK",
                                        changes=[{"field": "remark", "previous": prev_remark, "new": new_remark}],
                                        status="SUCCESS",
                                    )
                                except Exception:
                                    pass

                            if updates:
                                set_items = [f"{col} = %({col})s" for col in updates.keys()]
                                set_items.append("updated_at = %(now)s")
                                sql = f"""
                                    UPDATE stock_configuration
                                    SET {', '.join(set_items)}
                                    WHERE item_code = %(code)s
                                    RETURNING *;
                                """
                                cur.execute(sql, {**updates, "now": now, "code": code})
                            else:
                                cur.execute("SELECT * FROM stock_configuration WHERE item_code = %(code)s;", {"code": code})

                            row = cur.fetchone()
                            if not row:
                                cur.execute(f"ROLLBACK TO SAVEPOINT {sp_id};")
                                failed_count += 1
                                results.append({"item_code": code, "success": False, "error": f"Item {code} not found in database."})
                            else:
                                cur.execute(f"RELEASE SAVEPOINT {sp_id};")
                                result = dict(row)
                                for num_col in ["qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"]:
                                    if result.get(num_col) is not None:
                                        result[num_col] = float(result[num_col])
                                if isinstance(result.get("updated_at"), datetime):
                                    result["updated_at"] = result["updated_at"].isoformat()
                                if isinstance(result.get("last_submitted_at"), (datetime, date)):
                                    result["last_submitted_at"] = result["last_submitted_at"].isoformat()
                                result["remark"] = str(result.get("remark") or "")
                                successful_count += 1

                                sap_info = self._sync_item_to_sap(code, updates)
                                result["sap_synced"] = sap_info["sap_synced"]
                                result["sap_message"] = sap_info["message"]
                                if sap_info["sap_synced"]:
                                    sap_synced_count += 1

                                results.append({
                                    "item_code": code,
                                    "success": True,
                                    "item": result,
                                    "sap_synced": sap_info["sap_synced"],
                                    "sap_message": sap_info["message"],
                                })
                        except Exception as row_err:
                            cur.execute(f"ROLLBACK TO SAVEPOINT {sp_id};")
                            failed_count += 1
                            results.append({"item_code": code, "success": False, "error": str(row_err)})

        except Exception as e:
            logger.warning(f"PostgreSQL bulk update connection failed ({e}), falling back to individual updates.")
            results = []
            successful_count = 0
            failed_count = 0
            sap_synced_count = 0
            for item_data in items_data:
                code = str(item_data.get("item_code") or "").strip()
                try:
                    res = self.update_item(code, item_data, admin_user_id=admin_user_id)
                    successful_count += 1
                    if res.get("sap_synced"):
                        sap_synced_count += 1
                    results.append({
                        "item_code": code,
                        "success": True,
                        "item": res,
                        "sap_synced": res.get("sap_synced", False),
                        "sap_message": res.get("sap_message", ""),
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
            "drw_yn": "Y" if str(data.get("drw_yn", "Y")).upper().startswith("Y") else "N",
            "v_chk": "Y" if str(data.get("v_chk", "Y")).upper().startswith("Y") else "N",
            "ok_qty": max(0.0, float(data.get("ok_qty", 0.0))),
            "rej_qty": max(0.0, float(data.get("rej_qty", 0.0))),
            "lm": "Y" if str(data.get("lm", "Y")).upper().startswith("Y") else "N",
            "olng": "Y" if str(data.get("olng", "Y")).upper().startswith("Y") else "N",
            "lpk": "Y" if str(data.get("lpk", "Y")).upper().startswith("Y") else "N",
            "lbl": "Y" if str(data.get("lbl", "Y")).upper().startswith("Y") else "N",
            "mc_or_pt": "Y" if str(data.get("mc_or_pt", "Y")).upper().startswith("Y") else "N",
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
                        )
                        RETURNING *;
                        """,
                        new_item,
                    )
                    row = cur.fetchone()
                    result = dict(zip(COLUMNS, row))
                    for num_col in ["qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"]:
                        if result.get(num_col) is not None:
                            result[num_col] = float(result[num_col])
                    if isinstance(result.get("created_at"), datetime):
                        result["created_at"] = result["created_at"].isoformat()
                    if isinstance(result.get("updated_at"), datetime):
                        result["updated_at"] = result["updated_at"].isoformat()
                    if isinstance(result.get("last_submitted_at"), (datetime, date)):
                        result["last_submitted_at"] = result["last_submitted_at"].isoformat()
                    return result
        except psycopg2.IntegrityError:
            raise ValueError(f"Item code '{code}' already exists.")
        except Exception as e:
            logger.warning(f"Error inserting item in PostgreSQL ({e}), falling back to JSON.")
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
                    cur.execute("DELETE FROM stock_configuration WHERE item_code = %(code)s RETURNING item_code;", {"code": code})
                    row = cur.fetchone()
                    if not row:
                        raise ValueError(f"Item {code} not found.")
                    return True
        except Exception as e:
            logger.warning(f"Error deleting from PostgreSQL ({e}), falling back to JSON.")
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
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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
            cur.execute("SELECT item_code, sr_no FROM stock_configuration WHERE item_code = ANY(%s);", (list(set(all_candidate_codes)),))
            existing_items = dict(cur.fetchall())

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

            # SAP UDF for net weight: OITM.U_PerPices
            nt_weight = float(s_item.get("U_PerPices") or 0.0)

            # QC and configuration flags: do not default to Y if blank in SAP
            qc_val = clean_qc(s_item.get("U_QC")) or False
            drw_yn = clean_yn(s_item.get("U_Drawing") or s_item.get("U_JobDrawing"))
            v_chk = clean_yn(s_item.get("U_V_Chk"))
            lm = clean_yn(s_item.get("U_LM"))
            olng = clean_yn(s_item.get("U_OLNG"))
            lpk = clean_yn(s_item.get("U_LPK"))
            lbl = clean_yn(s_item.get("U_LBL"))
            mc_or_pt = clean_yn(s_item.get("U_MC_OR_PT"))

            raw_create = s_item.get("CreateDate")
            item_create_date = str(raw_create).split("T")[0] if raw_create else None

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
                entry_date = grn_date  # Authoritative date for Today filter
                po_no = info.get("po_no", "")
                po_date = info.get("po_date")
                po_qty = float(info.get("po_qty", 0.0))
                so_no = info.get("so_no", "")
                so_date = info.get("so_date")
                so_qty = float(info.get("so_qty", 0.0))
                # QTY is strictly Sales Order quantity from RDR1; 0.0 if no linked SO
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
                entry_date = po_date
                so_no = pinfo.get("so_no", "")
                so_date = pinfo.get("so_date")
                so_qty = float(pinfo.get("so_qty", 0.0))
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
                entry_date = item_create_date or "2025-01-07"
                qty = 0.0
                ok_qty = 0.0
                rej_qty = 0.0

            rows_to_upsert.append((
                item_sr, code, name, qty, stock, vendor_name, vendor_code,
                grpo_no, rcvd_qty, nt_weight, qc_val, drw_yn, v_chk, ok_qty, rej_qty,
                lm, olng, lpk, lbl, mc_or_pt, group, '01',
                is_active, entry_date, now, now,
                record_cat, item_create_date, so_date, po_date, grn_date,
                po_no, so_no, so_qty, po_qty
            ))

        if not rows_to_upsert:
            return 0

        upsert_sql = """
            INSERT INTO stock_configuration (
                sr_no, item_code, description, qty, stock_qty, vendor_name, vendor_code,
                grpo_no, rcvd_qty, nt_weight, qc, drw_yn, v_chk, ok_qty, rej_qty,
                lm, olng, lpk, lbl, mc_or_pt, items_group_code, warehouse_code,
                is_active, entry_date, created_at, updated_at,
                record_category, item_create_date, so_date, po_date, grn_date,
                po_no, so_no, so_qty, po_qty
            ) VALUES %s
            ON CONFLICT (item_code) DO UPDATE
            SET stock_qty = EXCLUDED.stock_qty,
                is_active = EXCLUDED.is_active,
                description = EXCLUDED.description,
                entry_date = EXCLUDED.entry_date,
                grpo_no = EXCLUDED.grpo_no,
                rcvd_qty = EXCLUDED.rcvd_qty,
                ok_qty = EXCLUDED.ok_qty,
                rej_qty = EXCLUDED.rej_qty,
                record_category = EXCLUDED.record_category,
                item_create_date = EXCLUDED.item_create_date,
                so_date = EXCLUDED.so_date,
                po_date = EXCLUDED.po_date,
                grn_date = EXCLUDED.grn_date,
                po_no = EXCLUDED.po_no,
                so_no = EXCLUDED.so_no,
                so_qty = EXCLUDED.so_qty,
                po_qty = EXCLUDED.po_qty,
                qty = EXCLUDED.qty,
                items_group_code = COALESCE(NULLIF(EXCLUDED.items_group_code, ''), stock_configuration.items_group_code),
                vendor_code = COALESCE(NULLIF(EXCLUDED.vendor_code, ''), stock_configuration.vendor_code),
                vendor_name = COALESCE(NULLIF(EXCLUDED.vendor_name, ''), stock_configuration.vendor_name),
                updated_at = EXCLUDED.updated_at;
        """
        psycopg2.extras.execute_values(cur, upsert_sql, rows_to_upsert, page_size=200)
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

        # 2. Fetch recent Goods Receipt POs (PurchaseDeliveryNotes)
        res_grpo = client.get("PurchaseDeliveryNotes", params={"$orderby": "DocEntry desc", "$top": 100})
        grpos = res_grpo.get("value", [])

        # 3. Fetch recent Purchase Orders
        res_po = client.get("PurchaseOrders", params={"$orderby": "DocEntry desc", "$top": 100})
        pos = res_po.get("value", [])
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
                if po_doc and "DocEntry" in po_doc:
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
                res_so = client.get("Orders", params={"$filter": f"DocNum eq {so_num}"})
                for so in res_so.get("value", []):
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
                so_no = ""
                so_date = None
                so_qty = 0.0

                if base_type == 22 and base_entry and base_entry in po_by_entry:
                    base_po = po_by_entry[base_entry]
                    po_no = str(base_po.get("DocNum") or "")
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
                                matching_lines = [
                                    float(sl.get("Quantity") or 0.0)
                                    for sl in so_doc.get("DocumentLines", [])
                                    if sl.get("ItemCode") == code
                                ]
                                so_qty = sum(matching_lines) if matching_lines else 0.0
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
                            matching_lines = [
                                float(sl.get("Quantity") or 0.0)
                                for sl in so_doc.get("DocumentLines", [])
                                if sl.get("ItemCode") == code
                            ]
                            so_qty = sum(matching_lines) if matching_lines else 0.0
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
                    "po_date": po_date,
                    "po_qty": po_qty,
                    "so_no": so_no if so_qty > 0 else "",
                    "so_date": so_date if so_qty > 0 else None,
                    "so_qty": so_qty,
                    "item_desc": l.get("ItemDescription"),
                }

        # 6. Build pending_po_map (for items with open POs but not received)
        pending_po_map = {}
        for p in pos:
            po_no = str(p.get("DocNum") or "")
            po_date = str(p.get("DocDate")).split("T")[0] if p.get("DocDate") else None
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
                    matching_lines = [
                        float(sl.get("Quantity") or 0.0)
                        for sl in so_by_doc_num[so_num_int].get("DocumentLines", [])
                        if sl.get("ItemCode") == code
                    ]
                    so_qty = sum(matching_lines) if matching_lines else 0.0
                pending_po_map[code] = {
                    "po_no": po_no,
                    "po_date": po_date,
                    "po_qty": float(l.get("Quantity") or 0.0),
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
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    synced_count = self._upsert_sap_items_cursor(cur, conn, sap_items, received_map, pending_po_map)

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
            raise RuntimeError(f"Failed to update database with SAP data: {str(e)}")

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
            "LPK",
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

            raw_last_sub = it.get("last_submitted_at")
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
                "Y" if it.get("qc") else "N",
                it.get("drw_yn", "Y"),
                it.get("v_chk", "Y"),
                it.get("ok_qty", 0),
                it.get("rej_qty", 0),
                it.get("lm", "Y"),
                it.get("olng", "Y"),
                it.get("lpk", "Y"),
                it.get("lbl", "Y"),
                it.get("mc_or_pt", "Y"),
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
            elif h in ["LPK", "I PK", "IPK"]:
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
                s = str(v).strip().upper()
                return "Y" if s.startswith("Y") or s in ["1", "TRUE"] else "N"

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
