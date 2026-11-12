"""Pydantic schemas for Google Sheets Integration"""

from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator


class GoogleSheetsConnectRequest(BaseModel):
    """Payload to initiate/test connection to a Google Sheet"""
    spreadsheet_url: Optional[str] = Field(None, description="Direct URL of the Google Sheet")
    spreadsheet_id: Optional[str] = Field(None, description="Google Spreadsheet ID")

    @field_validator("spreadsheet_url", "spreadsheet_id")
    @classmethod
    def strip_whitespace(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v.strip()
        return v


class GoogleSheetsTestRequest(BaseModel):
    """Diagnostic test connection request"""
    spreadsheet_id: Optional[str] = Field(None, description="Spreadsheet ID (defaults to saved)")
    spreadsheet_url: Optional[str] = Field(None, description="Spreadsheet URL (if provided, ID is extracted)")
    worksheet_name: Optional[str] = Field(None, description="Optional worksheet to test reading")
    header_row: Optional[int] = Field(1, ge=1, description="Header row to check")


class GoogleSheetsConfigRequest(BaseModel):
    """Configuration save request"""
    spreadsheet_url: Optional[str] = Field(None, description="Original spreadsheet URL")
    spreadsheet_id: str = Field(..., min_length=10, description="Spreadsheet ID")
    spreadsheet_name: Optional[str] = Field(None, description="Human readable spreadsheet title")
    worksheet_name: Optional[str] = Field(None, description="Selected worksheet name")
    header_row: int = Field(1, ge=1, description="Header row index (1-based)")
    data_start_row: int = Field(2, ge=2, description="Data start row index (1-based)")

    @field_validator("data_start_row")
    @classmethod
    def validate_data_start_row(cls, v: int, info) -> int:
        header_row = info.data.get("header_row", 1)
        if v <= header_row:
            raise ValueError(f"data_start_row ({v}) must be greater than header_row ({header_row})")
        return v


class WorksheetItem(BaseModel):
    """Worksheet metadata"""
    name: str
    index: int
    row_count: Optional[int] = None
    column_count: Optional[int] = None


class GoogleSheetsWorksheetsResponse(BaseModel):
    """Worksheets listing response"""
    spreadsheet_id: str
    spreadsheet_name: str
    worksheets: List[WorksheetItem]


class GoogleSheetsHeadersResponse(BaseModel):
    """Worksheet headers response"""
    spreadsheet_id: str
    worksheet_name: str
    header_row: int
    headers: List[str]
    total_columns: int
    total_rows: Optional[int] = None
    last_tested_at: Optional[str] = None


class GoogleSheetsStatusResponse(BaseModel):
    """
    Live Google Sheets integration connection status.
    connection_status can be:
    - connected
    - not_connected
    - authentication_failed
    - spreadsheet_not_found
    - permission_denied
    - worksheet_not_found
    - api_not_enabled
    - configuration_missing
    """
    configured: bool
    connection_status: str = Field(..., description="connected | not_connected | authentication_failed | spreadsheet_not_found | permission_denied | worksheet_not_found | api_not_enabled | configuration_missing")
    spreadsheet_id: Optional[str] = None
    spreadsheet_name: Optional[str] = None
    spreadsheet_url: Optional[str] = None
    worksheet_name: Optional[str] = None
    header_row: int = 1
    data_start_row: int = 2
    last_tested_at: Optional[str] = None
    last_successful_sync_at: Optional[str] = None
    service_account_configured: bool = False
    service_account_email: Optional[str] = None
    error_message: Optional[str] = None
    worksheets: List[str] = []
    activation_url: Optional[str] = None
    read_only: Optional[bool] = False
    permission_mode: Optional[str] = "not_verified"


class GoogleSheetsTestResponse(BaseModel):
    """Response returned by connection test / connect actions"""
    success: bool
    connection_status: str
    spreadsheet_name: Optional[str] = None
    spreadsheet_id: Optional[str] = None
    worksheets: List[str] = []
    service_account_email: Optional[str] = None
    message: str
    tested_at: str
    activation_url: Optional[str] = None


class StockConfigurationRecord(BaseModel):
    """Individual parsed Stock Configuration record from Google Sheets"""
    record_id: Optional[str] = None
    item_code: Optional[str] = None
    description: Optional[str] = None
    qty: Optional[float] = 0.0
    stock_qty: Optional[float] = 0.0
    vendor_name: Optional[str] = None
    grpo_no: Optional[str] = None
    rcvd_qty: Optional[float] = 0.0
    nt_weight: Optional[float] = 0.0
    qc: Optional[bool] = False
    drw_yn: Optional[str] = "Y"
    v_chk: Optional[str] = "Y"
    ok_qty: Optional[float] = 0.0
    rej_qty: Optional[float] = 0.0
    lm: Optional[str] = "Y"
    olng: Optional[str] = "Y"
    lpk: Optional[str] = "Y"
    lbl: Optional[str] = "Y"
    mc_or_pt: Optional[str] = "Y"
    entry_date: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


class GoogleSheetsStockRecordsResponse(BaseModel):
    """Response when retrieving Stock Configuration data from Google Sheets"""
    success: bool
    spreadsheet_id: str
    spreadsheet_name: Optional[str] = None
    worksheet_name: str
    header_row: int
    data_start_row: int
    headers: List[str]
    column_mapping: Dict[str, str] = Field(default_factory=dict, description="Mapped expected field to spreadsheet column")
    total_records: int
    records: List[StockConfigurationRecord] = Field(default_factory=list)
    unmapped_headers: List[str] = Field(default_factory=list)
    missing_expected_headers: List[str] = Field(default_factory=list)
    tested_at: str


class GoogleSheetsCreateStockRecordRequest(BaseModel):
    """Payload to create a new Stock Configuration record in Google Sheets"""
    item_code: str = Field(..., min_length=1, description="SAP Item Code or unique part number")
    record_id: Optional[str] = Field(None, description="Optional custom Record ID. If not supplied, ATLAS generates a stable ID.")
    description: Optional[str] = ""
    qty: Optional[float] = Field(0.0, ge=0.0, description="Planned or order quantity")
    stock_qty: Optional[float] = Field(0.0, ge=0.0, description="Current stock quantity")
    vendor_name: Optional[str] = ""
    grpo_no: Optional[str] = ""
    rcvd_qty: Optional[float] = Field(0.0, ge=0.0, description="Received quantity")
    nt_weight: Optional[float] = Field(0.0, ge=0.0, description="Net weight")
    qc: Optional[bool] = False
    drw_yn: Optional[str] = "Y"
    v_chk: Optional[str] = "Y"
    ok_qty: Optional[float] = Field(0.0, ge=0.0, description="Accepted/OK quantity")
    rej_qty: Optional[float] = Field(0.0, ge=0.0, description="Rejected quantity")
    lm: Optional[str] = "Y"
    olng: Optional[str] = "Y"
    lpk: Optional[str] = "Y"
    lbl: Optional[str] = "Y"
    mc_or_pt: Optional[str] = "Y"
    entry_date: Optional[str] = None


class GoogleSheetsUpdateStockRecordRequest(BaseModel):
    """Payload to update an existing Stock Configuration record in Google Sheets"""
    item_code: Optional[str] = None
    description: Optional[str] = None
    qty: Optional[float] = Field(None, ge=0.0)
    stock_qty: Optional[float] = Field(None, ge=0.0)
    vendor_name: Optional[str] = None
    grpo_no: Optional[str] = None
    rcvd_qty: Optional[float] = Field(None, ge=0.0)
    nt_weight: Optional[float] = Field(None, ge=0.0)
    qc: Optional[bool] = None
    drw_yn: Optional[str] = None
    v_chk: Optional[str] = None
    ok_qty: Optional[float] = Field(None, ge=0.0)
    rej_qty: Optional[float] = Field(None, ge=0.0)
    lm: Optional[str] = None
    olng: Optional[str] = None
    lpk: Optional[str] = None
    lbl: Optional[str] = None
    mc_or_pt: Optional[str] = None
    entry_date: Optional[str] = None
    expected_updated_at: Optional[str] = Field(None, description="Concurrency check: previous known updated_at ISO string")


class GoogleSheetsSingleRecordResponse(BaseModel):
    """Response returned when an individual record is created or updated in Google Sheets"""
    success: bool
    message: str
    item: StockConfigurationRecord
    spreadsheet_id: str
    worksheet_name: str
    source: str = "google_sheets"
    timestamp: str


class GoogleSheetsBulkItemResult(BaseModel):
    """Result for a single item in a bulk update operation"""
    record_id: str
    item_code: Optional[str] = None
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    item: Optional[StockConfigurationRecord] = None


class GoogleSheetsBulkStockResponse(BaseModel):
    """Response returned after bulk updating stock records in Google Sheets"""
    success: bool
    total: int
    successful: int
    failed: int
    source: str = "google_sheets"
    timestamp: str
    results: List[GoogleSheetsBulkItemResult] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)


class GoogleSheetsBulkUpdateStockRequest(BaseModel):
    """Payload to bulk update multiple stock configuration records in Google Sheets"""
    items: List[Dict[str, Any]] = Field(..., min_length=1, description="List of items to update")
