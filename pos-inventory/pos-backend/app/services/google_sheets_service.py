"""Google Sheets Integration Service

This service manages:
1. Google Cloud Service Account authentication
2. Spreadsheet URL and ID validation
3. Connection testing and worksheet/header retrieval
4. Dynamic column mapping & stock configuration record retrieval
5. Company-isolated integration configuration storage (MySQL with PyMySQL, PostgreSQL, or resilient JSON fallback)
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional, Tuple
from urllib.parse import urlparse

from app.core.config import settings

logger = logging.getLogger(__name__)

# Scopes
READONLY_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
FULL_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def col_idx_to_letter(col_idx: int) -> str:
    """Convert 0-based column index to spreadsheet letter (0 -> 'A', 25 -> 'Z', 26 -> 'AA', etc.)."""
    result = ""
    col_idx += 1
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        result = chr(65 + remainder) + result
    return result

FALLBACK_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "_google_sheets_config.json"
)

# Regex to extract Spreadsheet ID from various Google Sheets URL formats
SHEET_URL_REGEX = re.compile(
    r"/spreadsheets/(?:u/\d+/)?d/([a-zA-Z0-9-_]+)",
    re.IGNORECASE,
)
SHEET_ID_REGEX = re.compile(r"^[a-zA-Z0-9-_]{20,100}$")

# Column alias dictionary for dynamic header resolution of the 22 Stock Configuration fields
EXPECTED_STOCK_COLUMNS: Dict[str, List[str]] = {
    "record_id": ["record id", "record_id", "recordid", "id", "rec id", "rec_id", "serial id"],
    "item_code": ["sap item code", "sap code", "item code", "item_code", "itemcode", "sap_code", "code"],
    "description": ["description", "item description", "item_description", "item name", "item_name"],
    "qty": ["quantity", "qty", "planned qty", "order qty"],
    "stock_qty": ["stock quantity", "stock qty", "stock_qty", "in stock", "in_stock"],
    "vendor_name": ["vendor name", "vendor_name", "vendor", "supplier", "supplier name"],
    "grpo_no": ["grpo number", "grpo no", "grpo no.", "grpo_no", "grponumber", "grpo"],
    "rcvd_qty": ["received quantity", "rcvd qty", "rcvd. qty", "rcvd_qty", "received qty", "rcv_qty"],
    "nt_weight": ["net weight", "nt weight", "nt. weight", "nt_weight", "net_weight", "weight"],
    "qc": ["qc", "quality check", "qc passed", "qc_status"],
    "drw_yn": ["drawing", "drawing yn", "drw yn", "drw_yn", "drawing_yn", "drw. y/n", "drw.y/n", "drawing (y/n)"],
    "v_chk": ["v check", "v chk", "v_chk", "vendor check", "v check (y/n)", "v chk (y/n)"],
    "ok_qty": ["ok quantity", "ok qty", "ok. qty", "ok_qty", "accepted qty", "passed qty"],
    "rej_qty": ["rejected quantity", "rej qty", "rej. qty", "rej_qty", "reject qty"],
    "lm": ["lm", "laser marking", "line marking"],
    "olng": ["olng", "oiling", "loading"],
    "lpk": ["lpk", "loose packing", "line packing"],
    "lbl": ["lbl", "label", "labeling"],
    "mc_or_pt": ["mc or pt", "mc_or_pt", "mc/pt", "mc", "pt", "machining", "part test"],
    "entry_date": ["entry date", "entry_date", "date", "created date"],
    "updated_at": ["updated at", "updated_at", "last updated"],
    "updated_by": ["updated by", "updated_by", "modified by"],
}


class GoogleSheetsServiceError(Exception):
    """Base exception for Google Sheets integration errors."""
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        connection_status: str = "error",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.connection_status = connection_status
        self.details = details or {}


def extract_spreadsheet_id(url_or_id: str) -> str:
    """
    Extract and validate a Google Spreadsheet ID from either:
    1. A complete Google Sheets URL (e.g. https://docs.google.com/spreadsheets/d/1Bxi.../edit#gid=0)
    2. A bare Spreadsheet ID (e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)
    """
    if not url_or_id or not isinstance(url_or_id, str):
        raise GoogleSheetsServiceError("Spreadsheet URL or ID is required.", status_code=400, connection_status="configuration_missing")

    cleaned = url_or_id.strip()

    # Try matching URL pattern
    match = SHEET_URL_REGEX.search(cleaned)
    if match:
        extracted = match.group(1)
        if SHEET_ID_REGEX.match(extracted):
            return extracted

    # Try matching direct ID pattern
    if SHEET_ID_REGEX.match(cleaned):
        return cleaned

    raise GoogleSheetsServiceError(
        "Invalid Google Sheets URL or Spreadsheet ID format. "
        "Expected a valid Google Sheets URL (e.g. 'https://docs.google.com/spreadsheets/d/<ID>/edit') "
        "or a 20-100 character alphanumeric spreadsheet ID.",
        status_code=400,
        connection_status="configuration_missing",
    )


class GoogleSheetsService:
    """Service handling Google Sheets API connections, configurations, and records retrieval."""

    def __init__(self):
        self._ensure_table()

    # --------------------------------------------------------------------------
    # Database Persistence (MySQL with PyMySQL / PostgreSQL / JSON Fallback)
    # --------------------------------------------------------------------------

    def _get_db_type(self) -> str:
        db_url = (settings.DATABASE_URL or "").strip().lower()
        if db_url.startswith("mysql:") or db_url.startswith("mysql+pymysql:"):
            return "mysql"
        if db_url.startswith("postgresql:") or db_url.startswith("postgres:"):
            return "postgres"
        if db_url.startswith("sqlite:"):
            return "sqlite"
        return "none"

    @contextmanager
    def _get_connection(self) -> Iterator[Tuple[Any, str]]:
        db_url = (settings.DATABASE_URL or "").strip()
        db_type = self._get_db_type()

        if db_type == "mysql":
            import pymysql
            import pymysql.cursors

            parsed = urlparse(db_url)
            conn = pymysql.connect(
                host=parsed.hostname or "localhost",
                port=parsed.port or 3306,
                user=parsed.username or "root",
                password=parsed.password or "",
                database=parsed.path.lstrip("/"),
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=False,
            )
            try:
                yield conn, "mysql"
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

        elif db_type == "postgres":
            import psycopg2
            timeout = 1 if (os.environ.get("TESTING") == "True" or "PYTEST_CURRENT_TEST" in os.environ) else int(getattr(settings, "DB_CONNECT_TIMEOUT", 2))
            conn = psycopg2.connect(db_url, connect_timeout=timeout)
            try:
                yield conn, "postgres"
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        else:
            raise RuntimeError(f"Database type '{db_type}' not directly configured. Using JSON fallback.")

    def _ensure_table(self) -> None:
        """Create integration_configurations table in MySQL/PostgreSQL if available, else JSON fallback."""
        try:
            with self._get_connection() as (conn, db_type):
                with conn.cursor() as cur:
                    if db_type == "mysql":
                        cur.execute(
                            """
                            CREATE TABLE IF NOT EXISTS integration_configurations (
                                id VARCHAR(100) PRIMARY KEY,
                                company_id VARCHAR(100) NOT NULL,
                                integration_type VARCHAR(50) NOT NULL DEFAULT 'google_sheets',
                                spreadsheet_id VARCHAR(100),
                                spreadsheet_name VARCHAR(255),
                                spreadsheet_url TEXT,
                                worksheet_name VARCHAR(255),
                                header_row INT DEFAULT 1,
                                data_start_row INT DEFAULT 2,
                                connection_status VARCHAR(50) DEFAULT 'not_connected',
                                last_tested_at DATETIME,
                                last_successful_sync_at DATETIME,
                                last_error TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                UNIQUE KEY uq_company_integration (company_id, integration_type)
                            );
                            """
                        )
                        logger.info("integration_configurations table verified in MySQL.")
                    elif db_type == "postgres":
                        cur.execute(
                            """
                            CREATE TABLE IF NOT EXISTS integration_configurations (
                                id VARCHAR(100) PRIMARY KEY,
                                company_id VARCHAR(100) NOT NULL,
                                integration_type VARCHAR(50) NOT NULL DEFAULT 'google_sheets',
                                spreadsheet_id VARCHAR(100),
                                spreadsheet_name VARCHAR(255),
                                spreadsheet_url TEXT,
                                worksheet_name VARCHAR(255),
                                header_row INTEGER DEFAULT 1,
                                data_start_row INTEGER DEFAULT 2,
                                connection_status VARCHAR(50) DEFAULT 'not_connected',
                                last_tested_at TIMESTAMP,
                                last_successful_sync_at TIMESTAMP,
                                last_error TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                CONSTRAINT uq_company_integration UNIQUE (company_id, integration_type)
                            );
                            """
                        )
                        logger.info("integration_configurations table verified in PostgreSQL.")
        except Exception as e:
            logger.warning("Database integration_configurations check skipped (%s), using JSON fallback.", e)
            self._ensure_fallback_json()

    def _ensure_fallback_json(self) -> None:
        if not os.path.exists(FALLBACK_CONFIG_PATH):
            try:
                with open(FALLBACK_CONFIG_PATH, "w", encoding="utf-8") as f:
                    json.dump({}, f, indent=2)
            except Exception as e:
                logger.warning("Could not initialize fallback JSON config file: %s", e)

    def _read_from_fallback(self) -> Dict[str, Any]:
        self._ensure_fallback_json()
        try:
            with open(FALLBACK_CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _write_to_fallback(self, data: Dict[str, Any]) -> None:
        self._ensure_fallback_json()
        try:
            with open(FALLBACK_CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            logger.error("Failed to write to fallback JSON: %s", e)

    def get_configuration(self, company_id: str = "default") -> Dict[str, Any]:
        """Fetch saved configuration for this company."""
        comp_id = (company_id or "default").strip()
        try:
            with self._get_connection() as (conn, db_type):
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id, company_id, integration_type, spreadsheet_id, spreadsheet_name,
                               spreadsheet_url, worksheet_name, header_row, data_start_row,
                               connection_status, last_tested_at, last_successful_sync_at,
                               last_error, created_at, updated_at
                        FROM integration_configurations
                        WHERE company_id = %s AND integration_type = 'google_sheets'
                        LIMIT 1;
                        """,
                        (comp_id,),
                    )
                    row = cur.fetchone()
                    if row:
                        if isinstance(row, dict):
                            res = dict(row)
                        else:
                            import psycopg2.extras
                            cols = [desc[0] for desc in cur.description]
                            res = dict(zip(cols, row))
                        for dt_col in ("last_tested_at", "last_successful_sync_at", "created_at", "updated_at"):
                            if res.get(dt_col) and hasattr(res[dt_col], "isoformat"):
                                res[dt_col] = res[dt_col].isoformat()
                        return res
        except Exception:
            pass

        # Fallback to JSON
        fallback_data = self._read_from_fallback()
        config = fallback_data.get(comp_id) or fallback_data.get("default")
        if config:
            return config

        # Handle spreadsheet ID / URL from environment
        env_raw_sheet = (getattr(settings, "GOOGLE_SPREADSHEET_ID", "") or "").strip()
        env_sheet_id = None
        env_sheet_url = None
        if env_raw_sheet:
            try:
                env_sheet_id = extract_spreadsheet_id(env_raw_sheet)
                if env_raw_sheet.startswith("http"):
                    env_sheet_url = env_raw_sheet
            except Exception:
                env_sheet_id = env_raw_sheet

        # Return default config initialized from environment
        return {
            "id": f"gs_{comp_id}",
            "company_id": comp_id,
            "integration_type": "google_sheets",
            "spreadsheet_id": env_sheet_id,
            "spreadsheet_name": getattr(settings, "GOOGLE_SHEET_NAME", "Stock Configuration") or None,
            "spreadsheet_url": env_sheet_url,
            "worksheet_name": getattr(settings, "GOOGLE_SHEET_NAME", "Stock Configuration") or None,
            "header_row": getattr(settings, "GOOGLE_SHEET_HEADER_ROW", 1) or 1,
            "data_start_row": getattr(settings, "GOOGLE_SHEET_DATA_START_ROW", 2) or 2,
            "connection_status": "not_connected",
            "last_tested_at": None,
            "last_successful_sync_at": None,
            "last_error": None,
            "created_at": None,
            "updated_at": None,
        }

    def save_configuration(self, company_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Persist or update Google Sheets configuration for the company."""
        comp_id = (company_id or "default").strip()
        now = datetime.utcnow()
        config_id = f"gs_{comp_id}"

        raw_sheet_id = payload.get("spreadsheet_id")
        spreadsheet_id = raw_sheet_id.strip() if isinstance(raw_sheet_id, str) and raw_sheet_id.strip() else None
        spreadsheet_url = (payload.get("spreadsheet_url") or "").strip() or None
        spreadsheet_name = (payload.get("spreadsheet_name") or "").strip() or None
        worksheet_name = (payload.get("worksheet_name") or "").strip() or None

        raw_header = payload.get("header_row")
        header_row = int(raw_header) if raw_header is not None else 1

        raw_start = payload.get("data_start_row")
        data_start_row = int(raw_start) if raw_start is not None else (header_row + 1)

        connection_status = payload.get("connection_status") or "not_connected"
        last_tested_at = payload.get("last_tested_at") or None
        last_error = payload.get("last_error") or None

        if header_row < 1:
            raise GoogleSheetsServiceError("header_row must be greater than or equal to 1.", status_code=400)
        if data_start_row <= header_row:
            raise GoogleSheetsServiceError(
                f"data_start_row ({data_start_row}) must be strictly greater than header_row ({header_row}).",
                status_code=400,
            )

        saved_data = {
            "id": config_id,
            "company_id": comp_id,
            "integration_type": "google_sheets",
            "spreadsheet_id": spreadsheet_id,
            "spreadsheet_name": spreadsheet_name,
            "spreadsheet_url": spreadsheet_url,
            "worksheet_name": worksheet_name,
            "header_row": header_row,
            "data_start_row": data_start_row,
            "connection_status": connection_status,
            "last_tested_at": last_tested_at,
            "last_successful_sync_at": payload.get("last_successful_sync_at"),
            "last_error": last_error,
            "updated_at": now.isoformat(),
        }

        # Try MySQL or PostgreSQL
        try:
            with self._get_connection() as (conn, db_type):
                with conn.cursor() as cur:
                    if db_type == "mysql":
                        cur.execute(
                            """
                            INSERT INTO integration_configurations (
                                id, company_id, integration_type, spreadsheet_id, spreadsheet_name,
                                spreadsheet_url, worksheet_name, header_row, data_start_row,
                                connection_status, last_tested_at, last_error, created_at, updated_at
                            ) VALUES (
                                %(id)s, %(company_id)s, %(integration_type)s, %(spreadsheet_id)s, %(spreadsheet_name)s,
                                %(spreadsheet_url)s, %(worksheet_name)s, %(header_row)s, %(data_start_row)s,
                                %(connection_status)s, %(last_tested_at)s, %(last_error)s, %(now)s, %(now)s
                            )
                            ON DUPLICATE KEY UPDATE
                                spreadsheet_id = VALUES(spreadsheet_id),
                                spreadsheet_name = COALESCE(VALUES(spreadsheet_name), spreadsheet_name),
                                spreadsheet_url = COALESCE(VALUES(spreadsheet_url), spreadsheet_url),
                                worksheet_name = COALESCE(VALUES(worksheet_name), worksheet_name),
                                header_row = VALUES(header_row),
                                data_start_row = VALUES(data_start_row),
                                connection_status = VALUES(connection_status),
                                last_tested_at = COALESCE(VALUES(last_tested_at), last_tested_at),
                                last_error = VALUES(last_error),
                                updated_at = VALUES(updated_at);
                            """,
                            {**saved_data, "now": now},
                        )
                    elif db_type == "postgres":
                        cur.execute(
                            """
                            INSERT INTO integration_configurations (
                                id, company_id, integration_type, spreadsheet_id, spreadsheet_name,
                                spreadsheet_url, worksheet_name, header_row, data_start_row,
                                connection_status, last_tested_at, last_error, created_at, updated_at
                            ) VALUES (
                                %(id)s, %(company_id)s, %(integration_type)s, %(spreadsheet_id)s, %(spreadsheet_name)s,
                                %(spreadsheet_url)s, %(worksheet_name)s, %(header_row)s, %(data_start_row)s,
                                %(connection_status)s, %(last_tested_at)s, %(last_error)s, %(now)s, %(now)s
                            )
                            ON CONFLICT (company_id, integration_type) DO UPDATE SET
                                spreadsheet_id = EXCLUDED.spreadsheet_id,
                                spreadsheet_name = COALESCE(EXCLUDED.spreadsheet_name, integration_configurations.spreadsheet_name),
                                spreadsheet_url = COALESCE(EXCLUDED.spreadsheet_url, integration_configurations.spreadsheet_url),
                                worksheet_name = COALESCE(EXCLUDED.worksheet_name, integration_configurations.worksheet_name),
                                header_row = EXCLUDED.header_row,
                                data_start_row = EXCLUDED.data_start_row,
                                connection_status = EXCLUDED.connection_status,
                                last_tested_at = COALESCE(EXCLUDED.last_tested_at, integration_configurations.last_tested_at),
                                last_error = EXCLUDED.last_error,
                                updated_at = EXCLUDED.updated_at;
                            """,
                            {**saved_data, "now": now},
                        )
        except Exception as e:
            logger.warning("Database save skipped (%s), writing to JSON fallback.", e)
            fallback = self._read_from_fallback()
            existing = fallback.get(comp_id, {})
            saved_data["created_at"] = existing.get("created_at") or now.isoformat()
            fallback[comp_id] = saved_data
            self._write_to_fallback(fallback)

        return saved_data

    def update_connection_status(
        self,
        company_id: str,
        status: str,
        error: Optional[str] = None,
        spreadsheet_name: Optional[str] = None,
        spreadsheet_id: Optional[str] = None,
    ) -> None:
        """Update just the connection status and timestamp."""
        comp_id = (company_id or "default").strip()
        now = datetime.utcnow().isoformat()
        current = self.get_configuration(comp_id)
        current["connection_status"] = status
        current["last_tested_at"] = now
        current["last_error"] = error
        if spreadsheet_name:
            current["spreadsheet_name"] = spreadsheet_name
        if spreadsheet_id:
            current["spreadsheet_id"] = spreadsheet_id
        self.save_configuration(comp_id, current)

    def disconnect(self, company_id: str = "default") -> Dict[str, Any]:
        """Clear connection configuration and set status to not_connected."""
        comp_id = (company_id or "default").strip()
        current = self.get_configuration(comp_id)
        current["connection_status"] = "not_connected"
        current["spreadsheet_id"] = None
        current["spreadsheet_name"] = None
        current["spreadsheet_url"] = None
        current["worksheet_name"] = None
        current["last_error"] = None
        current["last_tested_at"] = datetime.utcnow().isoformat()
        return self.save_configuration(comp_id, current)

    # --------------------------------------------------------------------------
    # Google API Authentication & Credentials
    # --------------------------------------------------------------------------

    def get_service_account_credentials(self, read_only: bool = True) -> Any:
        """
        Load Google Service Account credentials securely from:
        1. Environment variable GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON string)
        2. File path GOOGLE_SERVICE_ACCOUNT_FILE (JSON key file)
        """
        from google.oauth2 import service_account

        scopes = READONLY_SCOPES if read_only else FULL_SCOPES

        # Option 1: Raw JSON string in environment variable
        raw_json = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_JSON", "") or ""
        if raw_json.strip():
            try:
                info = json.loads(raw_json)
                return service_account.Credentials.from_service_account_info(info, scopes=scopes)
            except Exception as e:
                raise GoogleSheetsServiceError(
                    f"Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: {str(e)}",
                    status_code=500,
                    connection_status="authentication_failed",
                )

        # Option 2: File path
        cred_path = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", None)
        if cred_path is None or str(cred_path).strip() == "":
            cred_path = "./secrets/google-service-account.json"
        
        backend_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        candidates = [
            cred_path,
            os.path.abspath(cred_path),
            os.path.join(backend_root, cred_path.lstrip("./")),
        ]
        if cred_path in ("./secrets/google-service-account.json", "secrets/google-service-account.json"):
            candidates.append(os.path.join(backend_root, "secrets", "google-service-account.json"))

        resolved_path = None
        for p in candidates:
            if os.path.exists(p) and os.path.isfile(p) and os.path.getsize(p) > 0:
                resolved_path = p
                break

        if not resolved_path:
            raise GoogleSheetsServiceError(
                f"Google Service Account credentials file not found or empty. "
                f"Expected at '{cred_path}'. "
                f"Please ensure your Google Cloud service account JSON key is placed in pos-backend/secrets/google-service-account.json.",
                status_code=500,
                connection_status="authentication_failed",
            )

        try:
            return service_account.Credentials.from_service_account_file(resolved_path, scopes=scopes)
        except Exception as e:
            raise GoogleSheetsServiceError(
                f"Invalid Google Service Account JSON file at '{resolved_path}': {str(e)}",
                status_code=500,
                connection_status="authentication_failed",
            )

    def get_service_account_email(self) -> Optional[str]:
        """Safely extract the Service Account email address to show to the admin."""
        try:
            creds = self.get_service_account_credentials()
            return getattr(creds, "service_account_email", None)
        except Exception:
            return None

    def is_service_account_configured(self) -> bool:
        """Check if service account credentials can be located, loaded, and non-empty."""
        try:
            creds = self.get_service_account_credentials()
            return creds is not None
        except Exception:
            return False

    def _build_sheets_client(self, read_only: bool = True) -> Any:
        """Construct Google Sheets v4 API client."""
        from googleapiclient.discovery import build

        if not read_only:
            is_ro = getattr(settings, "GOOGLE_SHEETS_READ_ONLY", False)
            if is_ro is True:
                raise GoogleSheetsServiceError(
                    "Google Sheets write-back is disabled (GOOGLE_SHEETS_READ_ONLY=true). "
                    "Set GOOGLE_SHEETS_READ_ONLY=false in pos-backend/.env to enable live write operations.",
                    status_code=403,
                    connection_status="permission_denied",
                )

        credentials = self.get_service_account_credentials(read_only=read_only)
        return build("sheets", "v4", credentials=credentials, cache_discovery=False)

    # --------------------------------------------------------------------------
    # Error Handling & Status Classification
    # --------------------------------------------------------------------------

    def _handle_google_api_error(self, err: Exception, spreadsheet_id: Optional[str] = None) -> None:
        """Convert Google API HttpError into structured user-friendly exceptions with accurate status."""
        from googleapiclient.errors import HttpError

        if isinstance(err, HttpError):
            status_code = err.resp.status
            content_str = err.content.decode("utf-8") if hasattr(err, "content") and err.content else str(err)
            sa_email = self.get_service_account_email() or "your service account email"

            # Parse JSON content to detect API Not Enabled (SERVICE_DISABLED)
            error_data = {}
            try:
                error_data = json.loads(content_str).get("error", {})
            except Exception:
                pass

            err_msg = error_data.get("message", content_str)
            details_list = error_data.get("details", [])
            reason = ""
            activation_url = None
            for item in details_list:
                if item.get("reason"):
                    reason = item.get("reason")
                if item.get("activationUrl"):
                    activation_url = item.get("activationUrl")
                if not activation_url and item.get("links"):
                    for link in item.get("links", []):
                        if link.get("url"):
                            activation_url = link.get("url")

            # Case A: Google Sheets API is not enabled on the GCP Project
            if reason == "SERVICE_DISABLED" or "Google Sheets API has not been used in project" in err_msg or "is disabled" in err_msg:
                if not activation_url:
                    url_match = re.search(r"https?://[^\s\"']+", err_msg)
                    if url_match:
                        activation_url = url_match.group(0).rstrip(".")
                act_url = activation_url or "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview"
                raise GoogleSheetsServiceError(
                    f"Google Sheets API is not enabled in your Google Cloud Project. "
                    f"Please enable it by visiting: {act_url} and retry.",
                    status_code=403,
                    connection_status="api_not_enabled",
                    details={
                        "activation_url": act_url,
                        "service_account_email": sa_email,
                    },
                )

            # Case B: Spreadsheet not shared with service account
            if status_code == 403:
                raise GoogleSheetsServiceError(
                    f"Permission denied (HTTP 403). The spreadsheet is not accessible by ATLAS. "
                    f"Please share your Google Sheet with the Service Account email: '{sa_email}' "
                    f"giving it at least 'Viewer' permission.",
                    status_code=403,
                    connection_status="permission_denied",
                    details={"service_account_email": sa_email},
                )

            # Case C: Spreadsheet not found (404)
            if status_code == 404:
                raise GoogleSheetsServiceError(
                    f"Spreadsheet not found (HTTP 404). Please verify that the Spreadsheet ID '{spreadsheet_id}' is correct.",
                    status_code=404,
                    connection_status="spreadsheet_not_found",
                )

            # Case D: Quota exceeded (429)
            if status_code == 429:
                raise GoogleSheetsServiceError(
                    "Google Sheets API quota exceeded (HTTP 429). Please wait a moment and try again.",
                    status_code=429,
                    connection_status="error",
                )

            # Case E: Document is an uploaded Excel (.xlsx) file in Google Drive, not a native Google Spreadsheet
            if "Office file" in err_msg or "not supported for this document" in err_msg:
                raise GoogleSheetsServiceError(
                    "The selected file is an uploaded Excel (.xlsx) file, not a native Google Spreadsheet. "
                    "Google Sheets API only supports native Google Sheets. "
                    "To fix this: Open the spreadsheet in Google Sheets, click 'File' > 'Save as Google Sheets', "
                    f"share the new Google Sheet with '{sa_email}' as Editor, and paste the new URL/ID into ATLAS.",
                    status_code=400,
                    connection_status="not_a_google_sheet",
                    details={
                        "spreadsheet_id": spreadsheet_id,
                        "service_account_email": sa_email,
                        "help": "Open in Google Sheets, click File -> Save as Google Sheets, then copy the new URL."
                    },
                )

            # Other HttpError
            raise GoogleSheetsServiceError(
                f"Google Sheets API error (HTTP {status_code}): {err_msg}",
                status_code=status_code,
                connection_status="error",
            )

        if isinstance(err, GoogleSheetsServiceError):
            raise err

        raise GoogleSheetsServiceError(
            f"Failed to communicate with Google Sheets: {str(err)}",
            status_code=500,
            connection_status="error",
        )

    # --------------------------------------------------------------------------
    # Google Sheets API Operations
    # --------------------------------------------------------------------------

    def test_connection(
        self,
        company_id: str,
        spreadsheet_id: Optional[str] = None,
        worksheet_name: Optional[str] = None,
        header_row: int = 1,
    ) -> Dict[str, Any]:
        """
        Verify that Google Sheets credentials are valid and the specified spreadsheet is accessible.
        Updates connection_status in database accordingly.
        """
        comp_id = (company_id or "default").strip()
        cfg = self.get_configuration(comp_id)
        target_id = spreadsheet_id or cfg.get("spreadsheet_id")

        if not target_id:
            raise GoogleSheetsServiceError(
                "No spreadsheet ID provided or configured. Enter a valid Google Sheets URL to connect.",
                status_code=400,
                connection_status="configuration_missing",
            )

        now = datetime.utcnow().isoformat()
        sa_email = self.get_service_account_email()

        try:
            client = self._build_sheets_client()
            spreadsheet = (
                client.spreadsheets()
                .get(spreadsheetId=target_id, fields="properties.title,sheets.properties(sheetId,title,gridProperties)")
                .execute()
            )

            title = spreadsheet.get("properties", {}).get("title", "Untitled Spreadsheet")
            sheets = spreadsheet.get("sheets", [])
            sheet_names = [s.get("properties", {}).get("title") for s in sheets if s.get("properties", {}).get("title")]

            # If worksheet_name specified, verify it exists
            if worksheet_name and worksheet_name not in sheet_names:
                raise GoogleSheetsServiceError(
                    f"Worksheet '{worksheet_name}' was not found in spreadsheet '{title}'. "
                    f"Available worksheets: {', '.join(sheet_names)}.",
                    status_code=404,
                    connection_status="worksheet_not_found",
                )

            # Record success
            self.update_connection_status(
                company_id=comp_id,
                status="connected",
                error=None,
                spreadsheet_name=title,
                spreadsheet_id=target_id,
            )

            return {
                "success": True,
                "connection_status": "connected",
                "spreadsheet_id": target_id,
                "spreadsheet_name": title,
                "worksheets": sheet_names,
                "service_account_email": sa_email,
                "message": f"Successfully connected to '{title}'. Found {len(sheet_names)} worksheet(s).",
                "tested_at": now,
            }

        except Exception as e:
            try:
                self._handle_google_api_error(e, target_id)
            except GoogleSheetsServiceError as gse:
                self.update_connection_status(
                    company_id=comp_id,
                    status=gse.connection_status,
                    error=gse.message,
                    spreadsheet_id=target_id,
                )
                raise gse
            except Exception as other_e:
                self.update_connection_status(
                    company_id=comp_id,
                    status="error",
                    error=str(other_e),
                    spreadsheet_id=target_id,
                )
                raise other_e

    def get_worksheets(self, spreadsheet_id: str) -> List[Dict[str, Any]]:
        """List all worksheet tabs in the spreadsheet with grid dimensions."""
        if not spreadsheet_id:
            raise GoogleSheetsServiceError("Spreadsheet ID is required to fetch worksheets.", status_code=400, connection_status="configuration_missing")

        try:
            client = self._build_sheets_client()
            spreadsheet = (
                client.spreadsheets()
                .get(spreadsheetId=spreadsheet_id, fields="sheets.properties(sheetId,title,index,gridProperties)")
                .execute()
            )

            results: List[Dict[str, Any]] = []
            for sheet in spreadsheet.get("sheets", []):
                props = sheet.get("properties", {})
                grid = props.get("gridProperties", {})
                results.append({
                    "name": props.get("title", "Sheet"),
                    "index": props.get("index", 0),
                    "row_count": grid.get("rowCount"),
                    "column_count": grid.get("columnCount"),
                })
            return results

        except Exception as e:
            self._handle_google_api_error(e, spreadsheet_id)

    def get_headers(
        self,
        spreadsheet_id: str,
        worksheet_name: str,
        header_row: int = 1,
    ) -> Dict[str, Any]:
        """Fetch column headers from the selected worksheet at the specified header row."""
        if not spreadsheet_id:
            raise GoogleSheetsServiceError("Spreadsheet ID is required.", status_code=400, connection_status="configuration_missing")
        if not worksheet_name:
            raise GoogleSheetsServiceError("Worksheet name is required.", status_code=400)
        if header_row < 1:
            raise GoogleSheetsServiceError("header_row must be >= 1.", status_code=400)

        try:
            client = self._build_sheets_client()

            meta = (
                client.spreadsheets()
                .get(spreadsheetId=spreadsheet_id, fields="sheets.properties(title,gridProperties)")
                .execute()
            )
            target_sheet = next(
                (s["properties"] for s in meta.get("sheets", []) if s.get("properties", {}).get("title") == worksheet_name),
                None
            )
            if not target_sheet:
                raise GoogleSheetsServiceError(
                    f"Worksheet '{worksheet_name}' not found in the spreadsheet.",
                    status_code=404,
                    connection_status="worksheet_not_found",
                )

            total_rows = target_sheet.get("gridProperties", {}).get("rowCount")

            safe_sheet_name = f"'{worksheet_name}'" if " " in worksheet_name or "'" in worksheet_name else worksheet_name
            range_expr = f"{safe_sheet_name}!A{header_row}:ZZ{header_row}"

            result = (
                client.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=range_expr)
                .execute()
            )

            raw_values = result.get("values", [])
            headers: List[str] = []
            if raw_values and len(raw_values) > 0:
                row_items = raw_values[0]
                while row_items and (row_items[-1] is None or str(row_items[-1]).strip() == ""):
                    row_items.pop()
                headers = [str(col).strip() if col is not None else "" for col in row_items]

            if not headers:
                raise GoogleSheetsServiceError(
                    f"Worksheet '{worksheet_name}' has no headers on row {header_row}. "
                    f"The specified row appears to be empty.",
                    status_code=400,
                )

            return {
                "spreadsheet_id": spreadsheet_id,
                "worksheet_name": worksheet_name,
                "header_row": header_row,
                "headers": headers,
                "total_columns": len(headers),
                "total_rows": total_rows,
                "last_tested_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            self._handle_google_api_error(e, spreadsheet_id)

    # --------------------------------------------------------------------------
    # Dynamic Stock Configuration Records Retrieval (Read-Only)
    # --------------------------------------------------------------------------

    def get_stock_configuration_records(
        self,
        spreadsheet_id: str,
        worksheet_name: str = "Stock Configuration",
        header_row: int = 1,
        data_start_row: int = 2,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """
        Dynamically map spreadsheet headers to the 22 Stock Configuration fields and fetch data records.
        Strictly Read-Only: does NOT alter Google Sheets or overwrite SAP records.
        """
        if not spreadsheet_id:
            raise GoogleSheetsServiceError("Spreadsheet ID is required.", status_code=400, connection_status="configuration_missing")
        if not worksheet_name:
            raise GoogleSheetsServiceError("Worksheet name is required.", status_code=400)
        if header_row < 1:
            raise GoogleSheetsServiceError("header_row must be >= 1.", status_code=400)
        if data_start_row <= header_row:
            raise GoogleSheetsServiceError(f"data_start_row ({data_start_row}) must be greater than header_row ({header_row}).", status_code=400)

        try:
            client = self._build_sheets_client()

            # Verify spreadsheet & worksheet existence
            meta = (
                client.spreadsheets()
                .get(spreadsheetId=spreadsheet_id, fields="properties.title,sheets.properties(title,gridProperties)")
                .execute()
            )
            title = meta.get("properties", {}).get("title", "Untitled")
            target_sheet = next(
                (s["properties"] for s in meta.get("sheets", []) if s.get("properties", {}).get("title") == worksheet_name),
                None
            )
            if not target_sheet:
                available = [s.get("properties", {}).get("title") for s in meta.get("sheets", [])]
                raise GoogleSheetsServiceError(
                    f"Worksheet '{worksheet_name}' not found in '{title}'. Available: {', '.join(available)}",
                    status_code=404,
                    connection_status="worksheet_not_found",
                )

            safe_sheet_name = f"'{worksheet_name}'" if " " in worksheet_name or "'" in worksheet_name else worksheet_name

            # Read headers
            header_range = f"{safe_sheet_name}!A{header_row}:ZZ{header_row}"
            header_res = client.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=header_range).execute()
            raw_headers = header_res.get("values", [[]])[0] if header_res.get("values") else []

            # Clean trailing empty columns
            while raw_headers and (raw_headers[-1] is None or str(raw_headers[-1]).strip() == ""):
                raw_headers.pop()

            headers = [str(h).strip() for h in raw_headers]
            if not headers:
                raise GoogleSheetsServiceError(f"Row {header_row} contains no headers.", status_code=400)

            # Build dynamic column mapping: index -> field_name
            col_idx_to_field: Dict[int, str] = {}
            matched_fields: Dict[str, str] = {}
            unmapped_headers: List[str] = []

            for idx, raw_h in enumerate(headers):
                normalized = raw_h.strip().lower()
                field_found = None
                for field_key, aliases in EXPECTED_STOCK_COLUMNS.items():
                    if normalized in aliases or normalized == field_key:
                        field_found = field_key
                        break
                if field_found:
                    col_idx_to_field[idx] = field_found
                    matched_fields[field_found] = f"Col {idx + 1} ({raw_h})"
                else:
                    unmapped_headers.append(raw_h)

            missing_expected = [
                field_key for field_key in EXPECTED_STOCK_COLUMNS.keys()
                if field_key not in matched_fields
            ]

            # Fetch rows from data_start_row up to limit
            end_row = data_start_row + limit - 1
            data_range = f"{safe_sheet_name}!A{data_start_row}:ZZ{end_row}"
            data_res = client.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=data_range).execute()
            raw_rows = data_res.get("values", [])

            parsed_records: List[Dict[str, Any]] = []

            for row_idx, row in enumerate(raw_rows):
                if not any(bool(cell and str(cell).strip()) for cell in row):
                    continue

                row_dict: Dict[str, Any] = {}
                raw_data_dict: Dict[str, Any] = {}

                for c_idx, cell_value in enumerate(row):
                    header_name = headers[c_idx] if c_idx < len(headers) else f"Col_{c_idx+1}"
                    raw_data_dict[header_name] = cell_value

                    field_name = col_idx_to_field.get(c_idx)
                    if field_name:
                        val = str(cell_value).strip() if cell_value is not None else ""

                        # Parse types
                        if field_name in ("qty", "stock_qty", "rcvd_qty", "ok_qty", "rej_qty", "nt_weight"):
                            try:
                                row_dict[field_name] = float(val) if val else 0.0
                            except (ValueError, TypeError):
                                row_dict[field_name] = 0.0
                        elif field_name == "qc":
                            row_dict[field_name] = val.lower() in ("true", "1", "yes", "y", "pass", "ok")
                        else:
                            row_dict[field_name] = val

                # Identify unique ID: record_id or verified SAP item_code
                unique_id = row_dict.get("record_id") or row_dict.get("item_code")
                if not unique_id:
                    # Skip rows that have neither record_id nor item_code
                    continue

                record_item = {
                    "record_id": unique_id,
                    "item_code": row_dict.get("item_code", unique_id),
                    "description": row_dict.get("description", ""),
                    "qty": row_dict.get("qty", 0.0),
                    "stock_qty": row_dict.get("stock_qty", 0.0),
                    "vendor_name": row_dict.get("vendor_name", ""),
                    "grpo_no": row_dict.get("grpo_no", ""),
                    "rcvd_qty": row_dict.get("rcvd_qty", 0.0),
                    "nt_weight": row_dict.get("nt_weight", 0.0),
                    "qc": row_dict.get("qc", False),
                    "drw_yn": row_dict.get("drw_yn", "Y"),
                    "v_chk": row_dict.get("v_chk", "Y"),
                    "ok_qty": row_dict.get("ok_qty", 0.0),
                    "rej_qty": row_dict.get("rej_qty", 0.0),
                    "lm": row_dict.get("lm", "Y"),
                    "olng": row_dict.get("olng", "Y"),
                    "lpk": row_dict.get("lpk", "Y"),
                    "lbl": row_dict.get("lbl", "Y"),
                    "mc_or_pt": row_dict.get("mc_or_pt", "Y"),
                    "entry_date": row_dict.get("entry_date", ""),
                    "updated_at": row_dict.get("updated_at", ""),
                    "updated_by": row_dict.get("updated_by", ""),
                    "raw_data": raw_data_dict,
                }
                parsed_records.append(record_item)

            return {
                "success": True,
                "spreadsheet_id": spreadsheet_id,
                "spreadsheet_name": title,
                "worksheet_name": worksheet_name,
                "header_row": header_row,
                "data_start_row": data_start_row,
                "headers": headers,
                "column_mapping": matched_fields,
                "total_records": len(parsed_records),
                "records": parsed_records,
                "unmapped_headers": unmapped_headers,
                "missing_expected_headers": missing_expected,
                "tested_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            self._handle_google_api_error(e, spreadsheet_id)

    # --------------------------------------------------------------------------
    # Phase 2: Stock Configuration Write-Back Operations (Strictly Google Sheets)
    # --------------------------------------------------------------------------

    def _get_sheet_headers_and_mapping(
        self,
        client: Any,
        spreadsheet_id: str,
        worksheet_name: str,
        header_row: int = 1,
    ) -> Tuple[str, str, List[str], Dict[int, str], Dict[str, int], str]:
        """
        Validate worksheet existence, read headers at header_row, and build two-way mapping.
        Returns: (safe_sheet_name, title, headers, col_idx_to_field, field_to_col_idx, end_col_letter)
        """
        meta = (
            client.spreadsheets()
            .get(spreadsheetId=spreadsheet_id, fields="properties.title,sheets.properties(title,gridProperties)")
            .execute()
        )
        title = meta.get("properties", {}).get("title", "Untitled")
        target_sheet = next(
            (s["properties"] for s in meta.get("sheets", []) if s.get("properties", {}).get("title") == worksheet_name),
            None,
        )
        if not target_sheet:
            available = [s.get("properties", {}).get("title") for s in meta.get("sheets", [])]
            raise GoogleSheetsServiceError(
                f"Worksheet '{worksheet_name}' not found in '{title}'. Available: {', '.join(available)}",
                status_code=404,
                connection_status="worksheet_not_found",
            )

        safe_sheet_name = f"'{worksheet_name}'" if " " in worksheet_name or "'" in worksheet_name else worksheet_name

        header_range = f"{safe_sheet_name}!A{header_row}:ZZ{header_row}"
        header_res = client.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=header_range).execute()
        raw_headers = header_res.get("values", [[]])[0] if header_res.get("values") else []

        while raw_headers and (raw_headers[-1] is None or str(raw_headers[-1]).strip() == ""):
            raw_headers.pop()

        headers = [str(h).strip() for h in raw_headers]
        if not headers:
            raise GoogleSheetsServiceError(f"Row {header_row} contains no headers.", status_code=400)

        col_idx_to_field: Dict[int, str] = {}
        field_to_col_idx: Dict[str, int] = {}

        for idx, raw_h in enumerate(headers):
            normalized = raw_h.strip().lower()
            field_found = None
            for field_key, aliases in EXPECTED_STOCK_COLUMNS.items():
                if normalized in aliases or normalized == field_key:
                    field_found = field_key
                    break
            if field_found:
                col_idx_to_field[idx] = field_found
                field_to_col_idx[field_found] = idx

        end_col_letter = col_idx_to_letter(len(headers) - 1)
        return safe_sheet_name, title, headers, col_idx_to_field, field_to_col_idx, end_col_letter

    def _parse_single_row_dict(
        self,
        row: List[Any],
        headers: List[str],
        col_idx_to_field: Dict[int, str],
    ) -> Dict[str, Any]:
        """Convert a Google Sheet row array into a standard StockConfigurationRecord dict."""
        row_dict: Dict[str, Any] = {}
        raw_data: Dict[str, Any] = {}
        for c_idx, cell_value in enumerate(row):
            h_name = headers[c_idx] if c_idx < len(headers) else f"Col_{c_idx+1}"
            raw_data[h_name] = cell_value

            field_name = col_idx_to_field.get(c_idx)
            if field_name:
                val = str(cell_value).strip() if cell_value is not None else ""
                if field_name in ("qty", "stock_qty", "rcvd_qty", "ok_qty", "rej_qty", "nt_weight"):
                    try:
                        row_dict[field_name] = float(val) if val else 0.0
                    except (ValueError, TypeError):
                        row_dict[field_name] = 0.0
                elif field_name == "qc":
                    row_dict[field_name] = val.lower() in ("true", "1", "yes", "y", "pass", "ok")
                else:
                    row_dict[field_name] = val

        unique_id = row_dict.get("record_id") or row_dict.get("item_code") or ""
        return {
            "record_id": unique_id,
            "item_code": row_dict.get("item_code", unique_id),
            "description": row_dict.get("description", ""),
            "qty": row_dict.get("qty", 0.0),
            "stock_qty": row_dict.get("stock_qty", 0.0),
            "vendor_name": row_dict.get("vendor_name", ""),
            "grpo_no": row_dict.get("grpo_no", ""),
            "rcvd_qty": row_dict.get("rcvd_qty", 0.0),
            "nt_weight": row_dict.get("nt_weight", 0.0),
            "qc": row_dict.get("qc", False),
            "drw_yn": row_dict.get("drw_yn", "Y"),
            "v_chk": row_dict.get("v_chk", "Y"),
            "ok_qty": row_dict.get("ok_qty", 0.0),
            "rej_qty": row_dict.get("rej_qty", 0.0),
            "lm": row_dict.get("lm", "Y"),
            "olng": row_dict.get("olng", "Y"),
            "lpk": row_dict.get("lpk", "Y"),
            "lbl": row_dict.get("lbl", "Y"),
            "mc_or_pt": row_dict.get("mc_or_pt", "Y"),
            "entry_date": row_dict.get("entry_date", ""),
            "updated_at": row_dict.get("updated_at", ""),
            "updated_by": row_dict.get("updated_by", ""),
            "raw_data": raw_data,
        }

    def create_stock_configuration_record(
        self,
        company_id: str = "default",
        data: Optional[Dict[str, Any]] = None,
        current_user: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Append a new Stock Configuration record to the connected Google Sheet.
        Generates a stable Record ID if missing and prevents duplicates.
        Strictly writes to Google Sheets only; never writes to SAP.
        """
        data = data or {}
        comp_id = (company_id or "default").strip()
        cfg = self.get_configuration(comp_id)
        spreadsheet_id = cfg.get("spreadsheet_id")
        if not spreadsheet_id:
            raise GoogleSheetsServiceError(
                "No spreadsheet configured. Please connect Google Sheets in Settings first.",
                status_code=400,
                connection_status="configuration_missing",
            )

        worksheet_name = cfg.get("worksheet_name") or "Stock Configuration"
        header_row = cfg.get("header_row", 1)
        data_start_row = cfg.get("data_start_row", 2)

        # Validate required item_code
        item_code = str(data.get("item_code") or "").strip()
        if not item_code:
            raise GoogleSheetsServiceError("Item Code ('item_code') is required.", status_code=400)

        # Validate non-negative quantities and weights
        for num_f in ["qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"]:
            if num_f in data and data[num_f] is not None:
                try:
                    val = float(data[num_f])
                    if val < 0:
                        raise GoogleSheetsServiceError(f"Field '{num_f}' cannot be negative.", status_code=400)
                except (ValueError, TypeError):
                    raise GoogleSheetsServiceError(f"Invalid numeric value for field '{num_f}'.", status_code=400)

        # Generate stable unique Record ID if not supplied
        record_id = str(data.get("record_id") or "").strip()
        if not record_id:
            record_id = f"REC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

        try:
            client = self._build_sheets_client(read_only=False)
            safe_sheet_name, title, headers, col_idx_to_field, field_to_col_idx, end_col_letter = (
                self._get_sheet_headers_and_mapping(client, spreadsheet_id, worksheet_name, header_row)
            )

            # Check duplicates: fetch existing records to ensure record_id is unique
            existing_range = f"{safe_sheet_name}!A{data_start_row}:{end_col_letter}"
            existing_res = client.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=existing_range).execute()
            existing_rows = existing_res.get("values", [])

            rec_col_idx = field_to_col_idx.get("record_id")
            if rec_col_idx is not None:
                for r in existing_rows:
                    if len(r) > rec_col_idx and str(r[rec_col_idx]).strip() == record_id:
                        raise GoogleSheetsServiceError(
                            f"Record ID '{record_id}' already exists in worksheet '{worksheet_name}'. Record IDs must be unique.",
                            status_code=400,
                        )

            now_iso = datetime.utcnow().isoformat()
            username = (current_user.get("username") if current_user else None) or "admin"
            entry_date = str(data.get("entry_date") or datetime.utcnow().strftime("%Y-%m-%d")).strip()

            new_row: List[Any] = ["" for _ in range(len(headers))]

            for c_idx, field_key in col_idx_to_field.items():
                if field_key == "record_id":
                    new_row[c_idx] = record_id
                elif field_key == "item_code":
                    new_row[c_idx] = item_code
                elif field_key == "entry_date":
                    new_row[c_idx] = entry_date
                elif field_key == "updated_at":
                    new_row[c_idx] = now_iso
                elif field_key == "updated_by":
                    new_row[c_idx] = username
                elif field_key == "qc":
                    raw_qc = data.get("qc")
                    if isinstance(raw_qc, bool):
                        new_row[c_idx] = "PASS" if raw_qc else "NO"
                    elif raw_qc is not None:
                        new_row[c_idx] = "PASS" if str(raw_qc).lower() in ("true", "1", "yes", "y", "pass", "ok") else "NO"
                    else:
                        new_row[c_idx] = "NO"
                elif field_key in data and data[field_key] is not None:
                    val = data[field_key]
                    if field_key in ("qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"):
                        new_row[c_idx] = float(val) if val != "" else 0.0
                    else:
                        new_row[c_idx] = str(val).strip()

            # Append to Google Sheet
            append_range = f"{safe_sheet_name}!A{data_start_row}:{end_col_letter}"
            client.spreadsheets().values().append(
                spreadsheetId=spreadsheet_id,
                range=append_range,
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [new_row]},
            ).execute()

            # Update last_successful_sync_at
            cfg["last_successful_sync_at"] = now_iso
            self.save_configuration(comp_id, cfg)

            record_item = self._parse_single_row_dict(new_row, headers, col_idx_to_field)

            return {
                "success": True,
                "message": f"Stock item '{item_code}' added to Google Sheets with Record ID '{record_id}'.",
                "item": record_item,
                "spreadsheet_id": spreadsheet_id,
                "worksheet_name": worksheet_name,
                "source": "google_sheets",
                "timestamp": now_iso,
            }

        except Exception as e:
            self._handle_google_api_error(e, spreadsheet_id)

    def update_stock_configuration_record(
        self,
        company_id: str = "default",
        record_id: str = "",
        data: Optional[Dict[str, Any]] = None,
        current_user: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Update an existing row in Google Sheets identified by its stable Record ID (or item_code).
        Enforces optimistic concurrency checks and updates only permitted fields.
        Strictly writes to Google Sheets; never writes to SAP.
        """
        data = data or {}
        comp_id = (company_id or "default").strip()
        cfg = self.get_configuration(comp_id)
        spreadsheet_id = cfg.get("spreadsheet_id")
        if not spreadsheet_id:
            raise GoogleSheetsServiceError(
                "No spreadsheet configured.",
                status_code=400,
                connection_status="configuration_missing",
            )

        worksheet_name = cfg.get("worksheet_name") or "Stock Configuration"
        header_row = cfg.get("header_row", 1)
        data_start_row = cfg.get("data_start_row", 2)

        target_id = str(record_id or data.get("record_id") or data.get("item_code") or "").strip()
        if not target_id:
            raise GoogleSheetsServiceError("Record ID is required to update a stock configuration record.", status_code=400)

        # Validate numeric fields
        for num_f in ["qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"]:
            if num_f in data and data[num_f] is not None:
                try:
                    val = float(data[num_f])
                    if val < 0:
                        raise GoogleSheetsServiceError(f"Field '{num_f}' cannot be negative.", status_code=400)
                except (ValueError, TypeError):
                    raise GoogleSheetsServiceError(f"Invalid numeric value for field '{num_f}'.", status_code=400)

        try:
            client = self._build_sheets_client(read_only=False)
            safe_sheet_name, title, headers, col_idx_to_field, field_to_col_idx, end_col_letter = (
                self._get_sheet_headers_and_mapping(client, spreadsheet_id, worksheet_name, header_row)
            )

            # Fetch existing rows to locate target row
            existing_range = f"{safe_sheet_name}!A{data_start_row}:{end_col_letter}"
            existing_res = client.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=existing_range).execute()
            existing_rows = existing_res.get("values", [])

            rec_col_idx = field_to_col_idx.get("record_id")
            code_col_idx = field_to_col_idx.get("item_code")

            found_row_idx = None
            found_row_values: List[Any] = []

            for r_idx, row in enumerate(existing_rows):
                r_id = str(row[rec_col_idx]).strip() if (rec_col_idx is not None and len(row) > rec_col_idx and row[rec_col_idx] is not None) else ""
                i_code = str(row[code_col_idx]).strip() if (code_col_idx is not None and len(row) > code_col_idx and row[code_col_idx] is not None) else ""

                if r_id == target_id or (not r_id and i_code == target_id) or (r_id and i_code == target_id):
                    found_row_idx = data_start_row + r_idx
                    found_row_values = list(row)
                    break

            if found_row_idx is None:
                raise GoogleSheetsServiceError(
                    f"Record '{target_id}' was not found in worksheet '{worksheet_name}'.",
                    status_code=404,
                )

            while len(found_row_values) < len(headers):
                found_row_values.append("")

            # Concurrency check
            expected_updated_at = data.get("expected_updated_at")
            upd_col_idx = field_to_col_idx.get("updated_at")
            if expected_updated_at and upd_col_idx is not None and len(found_row_values) > upd_col_idx:
                current_sheet_updated_at = str(found_row_values[upd_col_idx] or "").strip()
                if current_sheet_updated_at and current_sheet_updated_at > str(expected_updated_at).strip():
                    raise GoogleSheetsServiceError(
                        f"Record '{target_id}' has been modified in Google Sheets since it was loaded "
                        f"(Current in Sheets: {current_sheet_updated_at}, Loaded: {expected_updated_at}). "
                        f"Please refresh before submitting updates.",
                        status_code=409,
                    )

            now_iso = datetime.utcnow().isoformat()
            username = (current_user.get("username") if current_user else None) or "admin"

            # Overlay permitted fields (preserve Record ID)
            for c_idx, field_key in col_idx_to_field.items():
                if field_key == "record_id":
                    continue
                elif field_key == "updated_at":
                    found_row_values[c_idx] = now_iso
                elif field_key == "updated_by":
                    found_row_values[c_idx] = username
                elif field_key == "qc" and "qc" in data and data["qc"] is not None:
                    raw_qc = data["qc"]
                    if isinstance(raw_qc, bool):
                        found_row_values[c_idx] = "PASS" if raw_qc else "NO"
                    else:
                        found_row_values[c_idx] = "PASS" if str(raw_qc).lower() in ("true", "1", "yes", "y", "pass", "ok") else "NO"
                elif field_key in data and data[field_key] is not None:
                    val = data[field_key]
                    if field_key in ("qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"):
                        found_row_values[c_idx] = float(val) if val != "" else 0.0
                    else:
                        found_row_values[c_idx] = str(val).strip()

            # Execute update for that row
            update_range = f"{safe_sheet_name}!A{found_row_idx}:{end_col_letter}{found_row_idx}"
            client.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=update_range,
                valueInputOption="USER_ENTERED",
                body={"values": [found_row_values]},
            ).execute()

            # Update last_successful_sync_at
            cfg["last_successful_sync_at"] = now_iso
            self.save_configuration(comp_id, cfg)

            updated_record = self._parse_single_row_dict(found_row_values, headers, col_idx_to_field)

            return {
                "success": True,
                "message": f"Record '{target_id}' updated successfully in Google Sheets.",
                "item": updated_record,
                "spreadsheet_id": spreadsheet_id,
                "worksheet_name": worksheet_name,
                "source": "google_sheets",
                "timestamp": now_iso,
            }

        except Exception as e:
            self._handle_google_api_error(e, spreadsheet_id)

    def bulk_update_stock_configuration_records(
        self,
        company_id: str = "default",
        items: Optional[List[Dict[str, Any]]] = None,
        current_user: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Bulk update multiple stock configuration rows in Google Sheets.
        Uses a single batchUpdate API call for all valid items to minimize quota usage.
        Accurately reports per-record success and errors without silently discarding failures.
        Strictly writes to Google Sheets; never writes to SAP.
        """
        items = items or []
        comp_id = (company_id or "default").strip()
        cfg = self.get_configuration(comp_id)
        spreadsheet_id = cfg.get("spreadsheet_id")
        if not spreadsheet_id:
            raise GoogleSheetsServiceError(
                "No spreadsheet configured.",
                status_code=400,
                connection_status="configuration_missing",
            )

        worksheet_name = cfg.get("worksheet_name") or "Stock Configuration"
        header_row = cfg.get("header_row", 1)
        data_start_row = cfg.get("data_start_row", 2)

        if not items:
            raise GoogleSheetsServiceError("No items provided for bulk update.", status_code=400)

        try:
            client = self._build_sheets_client(read_only=False)
            safe_sheet_name, title, headers, col_idx_to_field, field_to_col_idx, end_col_letter = (
                self._get_sheet_headers_and_mapping(client, spreadsheet_id, worksheet_name, header_row)
            )

            existing_range = f"{safe_sheet_name}!A{data_start_row}:{end_col_letter}"
            existing_res = client.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=existing_range).execute()
            existing_rows = existing_res.get("values", [])

            rec_col_idx = field_to_col_idx.get("record_id")
            code_col_idx = field_to_col_idx.get("item_code")
            upd_col_idx = field_to_col_idx.get("updated_at")

            row_map_by_rec_id: Dict[str, Tuple[int, List[Any]]] = {}
            row_map_by_code: Dict[str, Tuple[int, List[Any]]] = {}

            for r_idx, r in enumerate(existing_rows):
                sheet_row_num = data_start_row + r_idx
                if rec_col_idx is not None and len(r) > rec_col_idx and r[rec_col_idx]:
                    r_id = str(r[rec_col_idx]).strip()
                    if r_id:
                        row_map_by_rec_id[r_id] = (sheet_row_num, list(r))
                if code_col_idx is not None and len(r) > code_col_idx and r[code_col_idx]:
                    i_code = str(r[code_col_idx]).strip()
                    if i_code:
                        row_map_by_code[i_code] = (sheet_row_num, list(r))

            results: List[Dict[str, Any]] = []
            batch_updates: List[Dict[str, Any]] = []
            now_iso = datetime.utcnow().isoformat()
            username = (current_user.get("username") if current_user else None) or "admin"

            for item_data in items:
                rec_id = str(item_data.get("record_id") or item_data.get("item_code") or "").strip()
                item_code = str(item_data.get("item_code") or "").strip()

                if not rec_id:
                    results.append({
                        "record_id": rec_id,
                        "item_code": item_code,
                        "success": False,
                        "error": "Missing record_id or item_code.",
                    })
                    continue

                target_match = row_map_by_rec_id.get(rec_id) or row_map_by_code.get(rec_id) or (row_map_by_code.get(item_code) if item_code else None)
                if not target_match:
                    results.append({
                        "record_id": rec_id,
                        "item_code": item_code,
                        "success": False,
                        "error": f"Record '{rec_id}' not found in Google Sheets.",
                    })
                    continue

                row_num, row_vals = target_match

                while len(row_vals) < len(headers):
                    row_vals.append("")

                # Validate numeric non-negative
                neg_field = None
                for num_f in ["qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"]:
                    if num_f in item_data and item_data[num_f] is not None:
                        try:
                            if float(item_data[num_f]) < 0:
                                neg_field = num_f
                                break
                        except (ValueError, TypeError):
                            neg_field = num_f
                            break
                if neg_field:
                    results.append({
                        "record_id": rec_id,
                        "item_code": item_code,
                        "success": False,
                        "error": f"Field '{neg_field}' cannot be negative or is invalid.",
                    })
                    continue

                # Concurrency check
                expected_updated = item_data.get("expected_updated_at")
                if expected_updated and upd_col_idx is not None and len(row_vals) > upd_col_idx:
                    cur_upd = str(row_vals[upd_col_idx] or "").strip()
                    if cur_upd and cur_upd > str(expected_updated).strip():
                        results.append({
                            "record_id": rec_id,
                            "item_code": item_code,
                            "success": False,
                            "error": f"Conflict: Record modified in Google Sheets since loaded ({cur_upd}).",
                        })
                        continue

                updated_row = list(row_vals)
                for c_idx, field_key in col_idx_to_field.items():
                    if field_key == "record_id":
                        continue
                    elif field_key == "updated_at":
                        updated_row[c_idx] = now_iso
                    elif field_key == "updated_by":
                        updated_row[c_idx] = username
                    elif field_key == "qc" and "qc" in item_data and item_data["qc"] is not None:
                        raw_qc = item_data["qc"]
                        if isinstance(raw_qc, bool):
                            updated_row[c_idx] = "PASS" if raw_qc else "NO"
                        else:
                            updated_row[c_idx] = "PASS" if str(raw_qc).lower() in ("true", "1", "yes", "y", "pass", "ok") else "NO"
                    elif field_key in item_data and item_data[field_key] is not None:
                        val = item_data[field_key]
                        if field_key in ("qty", "stock_qty", "rcvd_qty", "nt_weight", "ok_qty", "rej_qty"):
                            updated_row[c_idx] = float(val) if val != "" else 0.0
                        else:
                            updated_row[c_idx] = str(val).strip()

                batch_updates.append({
                    "range": f"{safe_sheet_name}!A{row_num}:{end_col_letter}{row_num}",
                    "values": [updated_row],
                })

                parsed_updated = self._parse_single_row_dict(updated_row, headers, col_idx_to_field)
                results.append({
                    "record_id": rec_id,
                    "item_code": item_code or parsed_updated.get("item_code"),
                    "success": True,
                    "message": "Updated in Google Sheets.",
                    "item": parsed_updated,
                })

            if batch_updates:
                client.spreadsheets().values().batchUpdate(
                    spreadsheetId=spreadsheet_id,
                    body={"valueInputOption": "USER_ENTERED", "data": batch_updates},
                ).execute()

                cfg["last_successful_sync_at"] = now_iso
                self.save_configuration(comp_id, cfg)

            successful = sum(1 for r in results if r["success"])
            failed = len(results) - successful

            return {
                "success": failed == 0,
                "total": len(items),
                "successful": successful,
                "failed": failed,
                "source": "google_sheets",
                "timestamp": now_iso,
                "results": results,
                "errors": [r for r in results if not r["success"]],
            }

        except Exception as e:
            self._handle_google_api_error(e, spreadsheet_id)

    def refresh_stock_configuration_records(
        self,
        company_id: str = "default",
        current_user: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Refresh and return the latest records directly from Google Sheets.
        Updates last_successful_sync_at.
        """
        comp_id = (company_id or "default").strip()
        cfg = self.get_configuration(comp_id)
        spreadsheet_id = cfg.get("spreadsheet_id")
        if not spreadsheet_id:
            raise GoogleSheetsServiceError(
                "No spreadsheet configured.",
                status_code=400,
                connection_status="configuration_missing",
            )

        worksheet_name = cfg.get("worksheet_name") or "Stock Configuration"
        header_row = cfg.get("header_row", 1)
        data_start_row = cfg.get("data_start_row", 2)

        data = self.get_stock_configuration_records(
            spreadsheet_id=spreadsheet_id,
            worksheet_name=worksheet_name,
            header_row=header_row,
            data_start_row=data_start_row,
            limit=1000,
        )

        now_iso = datetime.utcnow().isoformat()
        cfg["last_successful_sync_at"] = now_iso
        self.save_configuration(comp_id, cfg)

        return {
            "success": True,
            "timestamp": now_iso,
            "total_records": data.get("total_records", 0),
            "records": data.get("records", []),
            "source": "google_sheets",
        }


# Global singleton instance
google_sheets_service = GoogleSheetsService()
