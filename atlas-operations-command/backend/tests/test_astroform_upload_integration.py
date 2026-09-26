import pytest
import io
import openpyxl
from decimal import Decimal
from uuid import UUID, uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.models.company import Company
from app.models.customer import Customer
from app.models.product import Product
from app.models.vendor import Vendor
from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.models.upload import FileUpload
from app.models.staging import StagedRecord
from app.services.ingestion import process_upload, IngestionError
from app.services.astroform_adapter import is_astroform_workbook
from tests.conftest import setup_auth

client = TestClient(app)

def create_mock_astroform_xlsx_bytes() -> bytes:
    """Builds a minimal valid multi-sheet Astroform Excel file in memory with exact header names."""
    wb = openpyxl.Workbook()
    # Sheet 1: Margin Report
    ws_margin = wb.active
    ws_margin.title = "Margin Report"
    ws_margin.append(["Invoice No.", "Invoice Date", "Customer Code", "Customer Name", "Product Code", "Product Name", "Sales Price", "Sales Quantity", "Net Sales", "Standard RM", "Standard RM Other", "Total RM Cost", "Transport", "Discount", "Margin", "Margin %", "Loc"])
    ws_margin.append([26270441, "2026-09-02", "C0070", "WELD & CUT ENTERPRISES", "FG0119", "Magic Wipe Sponge", 60, 360, 23000, 3267.65, 15967.29, 19234.94, 1400, 0, 3765.06, 15.43, "PUNE"])
    
    # Sheet 2: Sale Register Customer Wise
    ws_sale = wb.create_sheet(title="Sale Register Customer Wise")
    ws_sale.append(["Internal Number", "Document Type", "Document Number", "Posting Date", "Customer/Vendor Name", "BP Reference No.", "Basic Value", "IGST Rate", "IGSTAmt", "CGST Rate", "CGSTAmt", "UTGST Rate", "UTGSTAmt", "Freight Tax Amt", "Total Freight", "Basic+Freight-Dis", "Total Discount", "Document Total", "Loc"])
    ws_sale.append([2557, "I", 26270441, "2026-09-02", "WELD & CUT ENTERPRISES", "Verbal", 21600.00, 18.00, 3888.00, 0.00, 0.00, 0.00, 0.00, 252.00, 1400.00, 23000.00, 0.00, 27140.00, "PUNE"])
    
    # Sheet 3: Purchase Register Vendor Wise
    ws_purch = wb.create_sheet(title="Purchase Register Vendor Wise")
    ws_purch.append(["Document Internal ID", "AP Inv. #", "Date", "Vendor Name", "Bill No. & Dt.", "Document Date", "GST Regn No of BP", "Bill to", "Doc Status", "Group Code", "Group Name", "Distribution Rule", "Location", "loc", "Base Amt.(Rs.)", "Base Quantity", "CGST (Rs.)", "CGST(Rate)", "SGST (Rs.)", "SGST (Rate)", "IGST (Rs.)", "IGST (Rate)", "Freight (Rs.)", "TDS (Rs.)", "Total (Rs.)"])
    ws_purch.append([2793, 26270072, "2026-08-26", "ZHEJIANG AOYU NEW MATERIAL TECHNOLOGY CO. LTD.", "AY20260626", "2026-07-16", None, "No. 2 Xinggong Road", "Closed", 101, "Vendor - Raw Material", None, "Delhi", "HO-Thane", 1000.00, 100, 90.00, None, 90.00, None, 0.00, "IGST@18", 0.00, 10.00, 1180.00])
    
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()

def create_mock_generic_xlsx_bytes() -> bytes:
    """Builds a generic multi-sheet XLSX file that is NOT Astroform."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Generic Data"
    ws.append(["name", "code", "location"])
    ws.append(["Generic Factory", "GF01", "Mumbai"])
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()

def test_astroform_detection_logic():
    """Verifies is_astroform_workbook accurately distinguishes Astroform workbooks."""
    astro_records = [
        {"sheet_name": "Margin Report", "row_number": 2, "data": {}},
        {"sheet_name": "Sale Register Customer Wise", "row_number": 2, "data": {}},
        {"sheet_name": "Purchase Register Vendor Wise", "row_number": 2, "data": {}}
    ]
    assert is_astroform_workbook(astro_records) is True
    
    # Missing one sheet
    partial_records = [
        {"sheet_name": "Margin Report", "row_number": 2, "data": {}},
        {"sheet_name": "Sale Register Customer Wise", "row_number": 2, "data": {}}
    ]
    assert is_astroform_workbook(partial_records) is False
    
    # Generic sheet
    generic_records = [
        {"sheet_name": "Sheet1", "row_number": 2, "data": {}}
    ]
    assert is_astroform_workbook(generic_records) is False

def test_astroform_upload_and_process_end_to_end(db_session):
    """Verifies full end-to-end upload and processing pipeline for Astroform Excel."""
    company_id, user_id, headers = setup_auth(db_session, client, email_prefix="admin_astro1", currency_code="INR")
    
    xlsx_bytes = create_mock_astroform_xlsx_bytes()
    files = {"file": ("Astroform_Mock.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    
    # 1. Upload
    resp = client.post("/api/v1/uploads", headers=headers, files=files)
    assert resp.status_code == 201
    upload_id = UUID(resp.json()["id"])
    assert resp.json()["status"] == "uploaded"
    assert resp.json()["file_type"] == "xlsx"
    
    # 2. Process synchronous execution
    db_session.commit()
    process_upload(db_session, upload_id, company_id)
    
    # Check upload status in DB
    upload = db_session.query(FileUpload).filter_by(id=upload_id).first()
    assert upload.status == "completed"
    assert upload.error_message is None
    
    # Check StagedRecords created
    staged = db_session.query(StagedRecord).filter_by(upload_id=upload_id).all()
    assert len(staged) == 3 # 1 margin, 1 sale, 1 purchase
    for s in staged:
        assert s.status == "imported"
        
    # Check FinancialTransactions created
    txs = db_session.query(FinancialTransaction).filter_by(company_id=company_id).all()
    assert len(txs) == 2 # 1 revenue, 1 expenditure, 0 margin
    
    rev_tx = next(t for t in txs if t.transaction_type == "revenue")
    assert rev_tx.amount == Decimal("27140.00")
    assert rev_tx.tax_amount == Decimal("4140.00") # 3888 + 252
    assert rev_tx.tax_rate == Decimal("18.00")
    assert "Invoice: 26270441" in rev_tx.description
    assert rev_tx.customer_id is not None
    
    exp_tx = next(t for t in txs if t.transaction_type == "expenditure")
    assert exp_tx.amount == Decimal("1180.00")
    assert exp_tx.tax_amount == Decimal("180.00") # 90 + 90
    assert exp_tx.tax_rate == Decimal("18.00")
    assert "Bill: AY20260626" in exp_tx.description
    assert exp_tx.vendor_id is not None
    
    # 3. Second run idempotency
    process_upload(db_session, upload_id, company_id)
    txs_run2 = db_session.query(FinancialTransaction).filter_by(company_id=company_id).all()
    assert len(txs_run2) == 2 # No new duplicates created

def test_generic_xlsx_regression(db_session):
    """Verifies that non-Astroform standard XLSX workbooks still follow the generic pipeline."""
    company_id, user_id, headers = setup_auth(db_session, client, email_prefix="admin_gen_xlsx")
    
    xlsx_bytes = create_mock_generic_xlsx_bytes()
    files = {"file": ("Generic_Data.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    
    resp = client.post("/api/v1/uploads", headers=headers, files=files)
    assert resp.status_code == 201
    upload_id = UUID(resp.json()["id"])
    
    # Process with target_entity="Factory"
    db_session.commit()
    process_upload(db_session, upload_id, company_id, target_entity="Factory")
    
    upload = db_session.query(FileUpload).filter_by(id=upload_id).first()
    assert upload.status == "completed"
    
    fac = db_session.query(Factory).filter_by(company_id=company_id).first()
    assert fac is not None
    assert fac.name == "Generic Factory"
    assert fac.code == "GF01"

def test_tenant_isolation_and_idor_protection(db_session):
    """Verifies that Company B cannot trigger processing on Company A's upload."""
    comp1_id, user1_id, headers1 = setup_auth(db_session, client, email_prefix="admin_t1", currency_code="INR")
    comp2_id, user2_id, headers2 = setup_auth(db_session, client, email_prefix="admin_t2", currency_code="INR")
    
    xlsx_bytes = create_mock_astroform_xlsx_bytes()
    files = {"file": ("Astro_T1.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    
    resp = client.post("/api/v1/uploads", headers=headers1, files=files)
    upload_id = resp.json()["id"]
    
    # Company 2 attempts to trigger processing on Company 1's upload
    idor_resp = client.post(f"/api/v1/uploads/{upload_id}/process", headers=headers2)
    assert idor_resp.status_code == 404
    
    # Verify Company 2 cannot see Company 1's upload
    get_resp = client.get(f"/api/v1/uploads/{upload_id}", headers=headers2)
    assert get_resp.status_code == 404

def test_rbac_non_admin_cannot_process(db_session):
    """Verifies standard users cannot process uploads."""
    comp_id, user_id, headers_admin = setup_auth(db_session, client, role="admin", email_prefix="admin_rbac", currency_code="INR")
    _, _, headers_user = setup_auth(db_session, client, role="user", email_prefix="user_rbac", currency_code="INR")
    
    xlsx_bytes = create_mock_astroform_xlsx_bytes()
    files = {"file": ("Astro_RBAC.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    
    resp = client.post("/api/v1/uploads", headers=headers_admin, files=files)
    upload_id = resp.json()["id"]
    
    # Standard user attempts to trigger processing
    proc_resp = client.post(f"/api/v1/uploads/{upload_id}/process", headers=headers_user)
    assert proc_resp.status_code == 403

def test_atomicity_and_rollback_on_failure(db_session, monkeypatch):
    """Verifies that when a failure occurs during financial ingestion, transactions are rolled back."""
    company_id, user_id, headers = setup_auth(db_session, client, email_prefix="admin_rollback", currency_code="INR")
    
    xlsx_bytes = create_mock_astroform_xlsx_bytes()
    files = {"file": ("Astro_Rollback.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    
    resp = client.post("/api/v1/uploads", headers=headers, files=files)
    upload_id = UUID(resp.json()["id"])
    
    # Force a failure during financial ingestion
    from app.services.astroform_financial_ingestion import AstroformFinancialIngestionService
    def mock_fail(*args, **kwargs):
        raise ValueError("Simulated fatal database error during financial ingestion")
    monkeypatch.setattr(AstroformFinancialIngestionService, "ingest_financial_transactions", mock_fail)
    
    db_session.commit()
    process_upload(db_session, upload_id, company_id)
    
    upload = db_session.query(FileUpload).filter_by(id=upload_id).first()
    assert upload.status == "failed"
    assert "Simulated fatal database error" in upload.error_message
    
    # Financial transactions must be 0 (rolled back)
    txs = db_session.query(FinancialTransaction).filter_by(company_id=company_id).all()
    assert len(txs) == 0
