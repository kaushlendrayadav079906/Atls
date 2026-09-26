import pytest
import datetime
from decimal import Decimal

from app.services.astroform_adapter import (
    adapt_astroform_records,
    parse_decimal,
    parse_date,
    parse_tax_rate_string,
    AstroformMarginRecord,
    AstroformSaleRecord,
    AstroformPurchaseRecord,
    AstroformAdapterResult
)

# =========================================================================
# Step 4 — Astroform Adapter Unit Tests
# =========================================================================

def test_margin_report_normalization():
    """A. Verify Margin Report normalization converts fields to typed dataclass with Decimal & dates."""
    records = [{
        "sheet_name": "Margin Report",
        "row_number": 2,
        "data": {
            "Invoice No.": 26270441,
            "Invoice Date": "2026-09-02",
            "Customer Code": "C0070",
            "Customer Name": "WELD & CUT ENTERPRISES",
            "Product Code": "FG0119",
            "Product Name": "Magic Wipe Sponge",
            "Sales Price": 60,
            "Sales Quantity": 360,
            "Net Sales": 23000,
            "Standard RM": 3267.65,
            "Standard RM Other": 15967.29,
            "Total RM Cost": 19234.94,
            "Transport": 1400,
            "Discount": 0,
            "Margin": 3765.06,
            "Margin %": 15.43,
            "Loc": "PUNE"
        }
    }]
    
    result = adapt_astroform_records(records)
    assert len(result.validation_errors) == 0
    assert len(result.margin_records) == 1
    
    m = result.margin_records[0]
    assert m.sheet_name == "Margin Report"
    assert m.row_number == 2
    assert m.invoice_no == "26270441"
    assert m.invoice_date == datetime.date(2026, 9, 2)
    assert m.customer_code == "C0070"
    assert m.customer_name == "WELD & CUT ENTERPRISES"
    assert m.product_code == "FG0119"
    assert m.product_name == "Magic Wipe Sponge"
    assert m.sales_price == Decimal("60.00")
    assert m.sales_quantity == Decimal("360.00")
    assert m.net_sales == Decimal("23000.00")
    assert m.standard_rm == Decimal("3267.65")
    assert m.standard_rm_other == Decimal("15967.29")
    assert m.total_rm_cost == Decimal("19234.94")
    assert m.transport == Decimal("1400.00")
    assert m.discount == Decimal("0.00")
    assert m.margin == Decimal("3765.06")
    assert m.margin_pct == Decimal("15.43")
    assert m.location == "PUNE"
    assert "Net Sales" in m.raw_data

def test_sale_register_normalization():
    """B. Verify Sale Register Customer Wise normalization."""
    records = [{
        "sheet_name": "Sale Register Customer Wise",
        "row_number": 2,
        "data": {
            "Internal Number": 2557,
            "Document Type": "I",
            "Document Number": 26270441,
            "Posting Date": "2026-09-02",
            "Customer/Vendor Name": "WELD & CUT ENTERPRISES",
            "BP Reference No.": "Verbal",
            "Basic Value": 21600,
            "IGST Rate": 18,
            "IGSTAmt": 3888,
            "CGST Rate": 0,
            "CGSTAmt": 0,
            "UTGST Rate": 0,
            "UTGSTAmt": 0,
            "Freight Tax Amt": 252,
            "Total Freight": 1400,
            "Basic+Freight-Dis": 23000,
            "Total Discount": 0,
            "Document Total": 27140,
            "Loc": "PUNE"
        }
    }]
    
    result = adapt_astroform_records(records)
    assert len(result.validation_errors) == 0
    assert len(result.sale_records) == 1
    
    s = result.sale_records[0]
    assert s.sheet_name == "Sale Register Customer Wise"
    assert s.row_number == 2
    assert s.internal_number == "2557"
    assert s.document_type == "I"
    assert s.document_number == "26270441"
    assert s.posting_date == datetime.date(2026, 9, 2)
    assert s.customer_name == "WELD & CUT ENTERPRISES"
    assert s.bp_reference_no == "Verbal"
    assert s.basic_value == Decimal("21600.00")
    assert s.igst_rate == Decimal("18.00")
    assert s.igst_amount == Decimal("3888.00")
    assert s.cgst_rate == Decimal("0.00")
    assert s.cgst_amount == Decimal("0.00")
    assert s.freight_tax_amount == Decimal("252.00")
    assert s.total_freight == Decimal("1400.00")
    assert s.basic_plus_freight_minus_dis == Decimal("23000.00")
    assert s.total_discount == Decimal("0.00")
    assert s.document_total == Decimal("27140.00")
    assert s.location == "PUNE"

def test_purchase_register_normalization():
    """C & I. Verify Purchase Register Vendor Wise normalization with string rate parsing."""
    records = [{
        "sheet_name": "Purchase Register Vendor Wise",
        "row_number": 2,
        "data": {
            "Document Internal ID": 2793,
            "AP Inv. #": 26270072,
            "Date": "2026-08-26",
            "Vendor Name": "ZHEJIANG AOYU NEW MATERIAL TECHNOLOGY CO. LTD.",
            "Bill No. & Dt.": "AY20260626",
            "Document Date": "2026-07-16",
            "GST Regn No of BP": None,
            "Bill to": "No. 2 Xinggong No. 10 Road Zhejiang Province CHINA",
            "Doc Status": "Closed",
            "Group Code": 101,
            "Group Name": "Vendor - Raw Material",
            "Distribution Rule": None,
            "Location": "Delhi",
            "loc": "HO-Thane",
            "Base Amt.(Rs.)": 1344507.90,
            "Base Quantity": 70400,
            "CGST (Rs.)": 0,
            "CGST(Rate)": None,
            "SGST (Rs.)": 0,
            "SGST (Rate)": None,
            "IGST (Rs.)": 0,
            "IGST (Rate)": "IGST@18",
            "Freight (Rs.)": 0,
            "TDS (Rs.)": 0,
            "Total (Rs.)": 1344507.90
        }
    }]
    
    result = adapt_astroform_records(records)
    assert len(result.validation_errors) == 0
    assert len(result.purchase_records) == 1
    
    p = result.purchase_records[0]
    assert p.sheet_name == "Purchase Register Vendor Wise"
    assert p.row_number == 2
    assert p.doc_internal_id == "2793"
    assert p.ap_inv_num == "26270072"
    assert p.date == datetime.date(2026, 8, 26)
    assert p.document_date == datetime.date(2026, 7, 16)
    assert p.vendor_name == "ZHEJIANG AOYU NEW MATERIAL TECHNOLOGY CO. LTD."
    assert p.bill_no_and_dt == "AY20260626"
    assert p.gst_regn_no is None
    assert p.bill_to == "No. 2 Xinggong No. 10 Road Zhejiang Province CHINA"
    assert p.group_name == "Vendor - Raw Material"
    assert p.distribution_rule is None
    assert p.base_amount == Decimal("1344507.90")
    assert p.base_quantity == Decimal("70400.00")
    assert p.cgst_rate is None
    assert p.igst_rate == Decimal("18.00")
    assert p.igst_rate_raw == "IGST@18"
    assert p.total_amount == Decimal("1344507.90")

def test_exact_sheet_recognition_and_unknown_sheet_handling():
    """D & E. Verify only supported sheets are adapted and unknown sheets are skipped safely."""
    records = [
        {"sheet_name": "Margin Report", "row_number": 2, "data": {"Invoice No.": "INV-1", "Invoice Date": "2026-03-01", "Customer Name": "C1", "Product Name": "P1"}},
        {"sheet_name": "Random Other Sheet", "row_number": 2, "data": {"Col1": "Val1"}},
        {"sheet_name": "Sheet4", "row_number": 2, "data": {"Col2": "Val2"}}
    ]
    
    result = adapt_astroform_records(records)
    assert len(result.margin_records) == 1
    assert len(result.sale_records) == 0
    assert len(result.purchase_records) == 0
    assert result.unknown_sheets == ["Random Other Sheet", "Sheet4"]
    assert len(result.validation_warnings) == 2

def test_decimal_conversion_and_formatting():
    """F. Verify Decimal conversion handles formatted numbers with currency symbols and commas."""
    errors = []
    assert parse_decimal("1,500.50", "f1", "s1", 1, errors) == Decimal("1500.50")
    assert parse_decimal("₹ 25,000.00", "f2", "s1", 1, errors) == Decimal("25000.00")
    assert parse_decimal("Rs. 450.75", "f3", "s1", 1, errors) == Decimal("450.75")
    assert parse_decimal("-", "f4", "s1", 1, errors) == Decimal("0.00")
    assert parse_decimal(None, "f5", "s1", 1, errors) == Decimal("0.00")
    assert parse_decimal(100, "f6", "s1", 1, errors) == Decimal("100.00")
    assert len(errors) == 0

def test_date_normalization_formats():
    """G. Verify date normalization handles varied date formats."""
    errors = []
    assert parse_date("2026-09-02", "d1", "s1", 1, errors) == datetime.date(2026, 9, 2)
    assert parse_date("02/09/2026", "d2", "s1", 1, errors) == datetime.date(2026, 9, 2)
    assert parse_date("02-09-2026", "d3", "s1", 1, errors) == datetime.date(2026, 9, 2)
    assert parse_date("2026-09-02T14:30:00", "d4", "s1", 1, errors) == datetime.date(2026, 9, 2)
    assert len(errors) == 0

def test_null_and_optional_values_handling():
    """H. Verify optional fields evaluate to None without inserting fake values."""
    records = [{
        "sheet_name": "Purchase Register Vendor Wise",
        "row_number": 3,
        "data": {
            "Date": "2026-08-01",
            "Vendor Name": "Sample Vendor",
            "GST Regn No of BP": None,
            "Bill to": None,
            "Distribution Rule": None,
            "CGST(Rate)": None,
            "SGST (Rate)": None,
            "IGST (Rate)": None,
            "Base Amt.(Rs.)": 5000,
            "Total (Rs.)": 5000
        }
    }]
    
    result = adapt_astroform_records(records)
    p = result.purchase_records[0]
    assert p.gst_regn_no is None
    assert p.bill_to is None
    assert p.distribution_rule is None
    assert p.cgst_rate is None
    assert p.sgst_rate is None
    assert p.igst_rate is None

def test_gst_rate_string_parsing():
    """I & O. Verify various GST rate string variations and malformed inputs."""
    errors = []
    r1, raw1 = parse_tax_rate_string("CGST@9", "r1", "s1", 1, errors)
    assert r1 == Decimal("9.00")
    assert raw1 == "CGST@9"
    
    r2, raw2 = parse_tax_rate_string("SGST@9", "r2", "s1", 1, errors)
    assert r2 == Decimal("9.00")
    assert raw2 == "SGST@9"
    
    r3, raw3 = parse_tax_rate_string("IGST@18", "r3", "s1", 1, errors)
    assert r3 == Decimal("18.00")
    assert raw3 == "IGST@18"
    
    r4, raw4 = parse_tax_rate_string("18%", "r4", "s1", 1, errors)
    assert r4 == Decimal("18.00")
    
    r5, raw5 = parse_tax_rate_string("0.18", "r5", "s1", 1, errors)
    assert r5 == Decimal("18.00")
    
    r6, raw6 = parse_tax_rate_string(None, "r6", "s1", 1, errors)
    assert r6 is None
    assert raw6 is None
    assert len(errors) == 0
    
    # Malformed rate string
    r_bad, _ = parse_tax_rate_string("INVALID_RATE_STRING_NO_DIGITS", "r_bad", "s1", 1, errors)
    assert r_bad is None
    assert len(errors) == 1
    assert "Invalid tax rate specification" in errors[0]["reason"]

def test_source_row_and_sheet_tracking():
    """J. Verify source row number and sheet name tracking."""
    records = [
        {"sheet_name": "Margin Report", "row_number": 42, "data": {"Invoice No.": "INV-42", "Invoice Date": "2026-03-01", "Customer Name": "C42", "Product Name": "P42"}},
        {"sheet_name": "Sale Register Customer Wise", "row_number": 108, "data": {"Document Number": "INV-108", "Posting Date": "2026-03-01", "Customer/Vendor Name": "C108"}}
    ]
    result = adapt_astroform_records(records)
    assert result.margin_records[0].row_number == 42
    assert result.sale_records[0].row_number == 108

def test_cross_sheet_invoice_matching():
    """K. Verify cross-sheet invoice reconciliation identification."""
    records = [
        # Margin records
        {"sheet_name": "Margin Report", "row_number": 2, "data": {"Invoice No.": "INV-101", "Invoice Date": "2026-03-01", "Customer Name": "C1", "Product Name": "P1"}},
        {"sheet_name": "Margin Report", "row_number": 3, "data": {"Invoice No.": "INV-102", "Invoice Date": "2026-03-01", "Customer Name": "C1", "Product Name": "P1"}},
        {"sheet_name": "Margin Report", "row_number": 4, "data": {"Invoice No.": "INV-103", "Invoice Date": "2026-03-01", "Customer Name": "C1", "Product Name": "P1"}},
        # Sales records
        {"sheet_name": "Sale Register Customer Wise", "row_number": 2, "data": {"Document Number": "INV-102", "Posting Date": "2026-03-01", "Customer/Vendor Name": "C1"}},
        {"sheet_name": "Sale Register Customer Wise", "row_number": 3, "data": {"Document Number": "INV-103", "Posting Date": "2026-03-01", "Customer/Vendor Name": "C1"}},
        {"sheet_name": "Sale Register Customer Wise", "row_number": 4, "data": {"Document Number": "INV-104", "Posting Date": "2026-03-01", "Customer/Vendor Name": "C1"}}
    ]
    
    result = adapt_astroform_records(records)
    assert result.cross_sheet_invoice_matches == ["INV-102", "INV-103"]

def test_validation_missing_required_fields():
    """L. Verify missing required fields produce clear errors."""
    records = [
        # Missing Invoice No.
        {"sheet_name": "Margin Report", "row_number": 5, "data": {"Invoice Date": "2026-03-01", "Customer Name": "C1", "Product Name": "P1"}},
        # Missing Customer Name
        {"sheet_name": "Margin Report", "row_number": 6, "data": {"Invoice No.": "INV-6", "Invoice Date": "2026-03-01", "Product Name": "P1"}},
        # Missing Vendor Name
        {"sheet_name": "Purchase Register Vendor Wise", "row_number": 7, "data": {"Date": "2026-03-01"}}
    ]
    
    result = adapt_astroform_records(records)
    assert len(result.validation_errors) == 3
    assert result.validation_errors[0]["field"] == "Invoice No."
    assert result.validation_errors[1]["field"] == "Customer Name"
    assert result.validation_errors[2]["field"] == "Vendor Name"

def test_validation_invalid_date():
    """M. Verify invalid date string produces clear validation error."""
    records = [
        {"sheet_name": "Margin Report", "row_number": 8, "data": {"Invoice No.": "INV-8", "Invoice Date": "NOT_A_DATE", "Customer Name": "C1", "Product Name": "P1"}}
    ]
    result = adapt_astroform_records(records)
    assert len(result.validation_errors) == 1
    assert result.validation_errors[0]["field"] == "Invoice Date"
    assert "Invalid date format" in result.validation_errors[0]["reason"]

def test_validation_invalid_numeric():
    """N. Verify invalid numeric value produces clear validation error."""
    errors = []
    val = parse_decimal("INVALID_NUM", "sales_price", "Margin Report", 10, errors)
    assert val == Decimal("0.00")
    assert len(errors) == 1
    assert errors[0]["field"] == "sales_price"
    assert "Invalid numeric/Decimal" in errors[0]["reason"]

def test_no_database_interaction():
    """P. Verify adapter executes purely in-memory with zero database dependencies."""
    import sys
    # Verify app.services.astroform_adapter does not import sqlalchemy Session
    import app.services.astroform_adapter as adapter_mod
    assert not hasattr(adapter_mod, "Session")
    assert not hasattr(adapter_mod, "db")
    assert not hasattr(adapter_mod, "Base")
