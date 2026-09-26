import re
import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field

MONEY_QUANTIZE = Decimal("0.01")
RATE_QUANTIZE = Decimal("0.01")

SUPPORTED_SHEETS = {
    "Margin Report",
    "Sale Register Customer Wise",
    "Purchase Register Vendor Wise"
}

REQUIRED_ASTROFORM_SHEETS = {
    "Margin Report",
    "Sale Register Customer Wise",
    "Purchase Register Vendor Wise"
}

def is_astroform_workbook(parsed_records: List[Dict[str, Any]]) -> bool:
    """
    Deterministically detects whether a parsed multi-sheet XLSX dataset
    contains the required Astroform worksheets.
    """
    if not parsed_records or not isinstance(parsed_records, list):
        return False
        
    found_sheets = {
        r.get("sheet_name") for r in parsed_records 
        if isinstance(r, dict) and r.get("sheet_name")
    }
    return REQUIRED_ASTROFORM_SHEETS.issubset(found_sheets)


@dataclass
class AstroformMarginRecord:
    sheet_name: str
    row_number: int
    invoice_no: str
    invoice_date: datetime.date
    customer_code: Optional[str]
    customer_name: str
    product_code: Optional[str]
    product_name: str
    sales_price: Decimal
    sales_quantity: Decimal
    net_sales: Decimal
    standard_rm: Decimal
    standard_rm_other: Decimal
    total_rm_cost: Decimal
    transport: Decimal
    discount: Decimal
    margin: Decimal
    margin_pct: Decimal
    location: Optional[str]
    raw_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AstroformSaleRecord:
    sheet_name: str
    row_number: int
    internal_number: Optional[str]
    document_type: Optional[str]
    document_number: str
    posting_date: datetime.date
    customer_name: str
    bp_reference_no: Optional[str]
    basic_value: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    utgst_rate: Decimal
    utgst_amount: Decimal
    freight_tax_amount: Decimal
    total_freight: Decimal
    basic_plus_freight_minus_dis: Decimal
    total_discount: Decimal
    document_total: Decimal
    location: Optional[str]
    raw_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AstroformPurchaseRecord:
    sheet_name: str
    row_number: int
    doc_internal_id: Optional[str]
    ap_inv_num: Optional[str]
    date: datetime.date
    vendor_name: str
    bill_no_and_dt: Optional[str]
    document_date: Optional[datetime.date]
    gst_regn_no: Optional[str]
    bill_to: Optional[str]
    doc_status: Optional[str]
    group_code: Optional[str]
    group_name: Optional[str]
    distribution_rule: Optional[str]
    location: Optional[str]
    loc: Optional[str]
    base_amount: Decimal
    base_quantity: Decimal
    cgst_amount: Decimal
    cgst_rate: Optional[Decimal]
    cgst_rate_raw: Optional[str]
    sgst_amount: Decimal
    sgst_rate: Optional[Decimal]
    sgst_rate_raw: Optional[str]
    igst_amount: Decimal
    igst_rate: Optional[Decimal]
    igst_rate_raw: Optional[str]
    freight: Decimal
    tds_amount: Decimal
    total_amount: Decimal
    raw_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AstroformAdapterResult:
    margin_records: List[AstroformMarginRecord] = field(default_factory=list)
    sale_records: List[AstroformSaleRecord] = field(default_factory=list)
    purchase_records: List[AstroformPurchaseRecord] = field(default_factory=list)
    cross_sheet_invoice_matches: List[str] = field(default_factory=list)
    validation_errors: List[Dict[str, Any]] = field(default_factory=list)
    validation_warnings: List[Dict[str, Any]] = field(default_factory=list)
    unknown_sheets: List[str] = field(default_factory=list)


def parse_decimal(
    val: Any,
    field_name: str,
    sheet_name: str,
    row_number: int,
    errors: List[Dict[str, Any]],
    default: Decimal = Decimal("0.00"),
    quantize: bool = True
) -> Decimal:
    """Safely converts numeric or string cell values to quantized Decimal without floating-point drift."""
    if val is None:
        return default
    if isinstance(val, (int, Decimal)):
        d = Decimal(val)
        return d.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP) if quantize else d
    if isinstance(val, float):
        d = Decimal(str(val))
        return d.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP) if quantize else d
        
    s = str(val).strip()
    if not s or s == "-" or s.lower() == "null" or s.lower() == "none" or s.lower() == "nan":
        return default
        
    if not re.search(r'\d', s):
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": field_name,
            "reason": f"Invalid numeric/Decimal value: '{val}'"
        })
        return default

    match = re.search(r'([-+]?\d[\d,]*(?:\.\d+)?)', s)
    if not match:
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": field_name,
            "reason": f"Invalid numeric/Decimal value: '{val}'"
        })
        return default
        
    clean_num = match.group(1).replace(",", "")
    try:
        d = Decimal(clean_num)
        if quantize:
            return d.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
        return d
    except (InvalidOperation, ValueError):
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": field_name,
            "reason": f"Invalid numeric/Decimal value: '{val}'"
        })
        return default


def parse_date(
    val: Any,
    field_name: str,
    sheet_name: str,
    row_number: int,
    errors: List[Dict[str, Any]],
    required: bool = True
) -> Optional[datetime.date]:
    """Parses date/datetime objects or ISO/Indian format strings into a Python datetime.date."""
    if val is None or str(val).strip() == "":
        if required:
            errors.append({
                "sheet_name": sheet_name,
                "row_number": row_number,
                "field": field_name,
                "reason": "Missing required date value"
            })
        return None
        
    if isinstance(val, datetime.date) and not isinstance(val, datetime.datetime):
        return val
        
    if isinstance(val, datetime.datetime):
        return val.date()
        
    s = str(val).strip()
    
    # Check ISO format YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
    if "T" in s:
        s = s.split("T")[0]
        
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y"]
    for fmt in formats:
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
            
    errors.append({
        "sheet_name": sheet_name,
        "row_number": row_number,
        "field": field_name,
        "reason": f"Invalid date format: '{val}'"
    })
    return None


def parse_tax_rate_string(
    val: Any,
    field_name: str,
    sheet_name: str,
    row_number: int,
    errors: List[Dict[str, Any]]
) -> tuple[Optional[Decimal], Optional[str]]:
    """
    Parses tax rate values which can be numeric (18, 9.0) or formatted strings ('CGST@9', 'SGST@9', 'IGST@18', '18%').
    Returns (normalized_decimal_rate, raw_rate_string).
    """
    if val is None:
        return None, None
    raw_str = str(val).strip()
    if not raw_str or raw_str.lower() == "none" or raw_str == "-":
        return None, None
        
    # Match patterns like CGST@9, SGST@9, IGST@18, 18%, 9
    match = re.search(r'(\d+(?:\.\d+)?)', raw_str)
    if match:
        try:
            rate_val = Decimal(match.group(1))
            # If rate is expressed as fraction 0.18, scale to 18.00
            if Decimal("0.0") < rate_val <= Decimal("1.0"):
                rate_val = rate_val * Decimal("100.0")
            return rate_val.quantize(RATE_QUANTIZE, rounding=ROUND_HALF_UP), raw_str
        except (InvalidOperation, ValueError):
            pass
            
    errors.append({
        "sheet_name": sheet_name,
        "row_number": row_number,
        "field": field_name,
        "reason": f"Invalid tax rate specification: '{val}'"
    })
    return None, raw_str


def adapt_margin_row(
    record: Dict[str, Any],
    errors: List[Dict[str, Any]],
    warnings: List[Dict[str, Any]]
) -> Optional[AstroformMarginRecord]:
    sheet_name = record["sheet_name"]
    row_number = record["row_number"]
    data = record.get("data", {})
    
    raw_inv = data.get("Invoice No.")
    if raw_inv is None or str(raw_inv).strip() == "":
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": "Invoice No.",
            "reason": "Missing required Invoice No."
        })
        return None
    invoice_no = str(raw_inv).strip()
    
    invoice_date = parse_date(data.get("Invoice Date"), "Invoice Date", sheet_name, row_number, errors, required=True)
    if invoice_date is None:
        return None
        
    customer_name = str(data.get("Customer Name", "")).strip()
    if not customer_name:
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": "Customer Name",
            "reason": "Missing required Customer Name"
        })
        return None
        
    product_name = str(data.get("Product Name", "")).strip()
    if not product_name:
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": "Product Name",
            "reason": "Missing required Product Name"
        })
        return None
        
    customer_code = str(data["Customer Code"]).strip() if data.get("Customer Code") else None
    product_code = str(data["Product Code"]).strip() if data.get("Product Code") else None
    location = str(data["Loc"]).strip() if data.get("Loc") else None
    
    sales_price = parse_decimal(data.get("Sales Price"), "Sales Price", sheet_name, row_number, errors)
    sales_qty = parse_decimal(data.get("Sales Quantity"), "Sales Quantity", sheet_name, row_number, errors)
    net_sales = parse_decimal(data.get("Net Sales"), "Net Sales", sheet_name, row_number, errors)
    std_rm = parse_decimal(data.get("Standard RM"), "Standard RM", sheet_name, row_number, errors)
    std_rm_other = parse_decimal(data.get("Standard RM Other"), "Standard RM Other", sheet_name, row_number, errors)
    total_rm_cost = parse_decimal(data.get("Total RM Cost"), "Total RM Cost", sheet_name, row_number, errors)
    transport = parse_decimal(data.get("Transport"), "Transport", sheet_name, row_number, errors)
    discount = parse_decimal(data.get("Discount"), "Discount", sheet_name, row_number, errors)
    margin = parse_decimal(data.get("Margin"), "Margin", sheet_name, row_number, errors)
    margin_pct = parse_decimal(data.get("Margin %"), "Margin %", sheet_name, row_number, errors)
    
    return AstroformMarginRecord(
        sheet_name=sheet_name,
        row_number=row_number,
        invoice_no=invoice_no,
        invoice_date=invoice_date,
        customer_code=customer_code,
        customer_name=customer_name,
        product_code=product_code,
        product_name=product_name,
        sales_price=sales_price,
        sales_quantity=sales_qty,
        net_sales=net_sales,
        standard_rm=std_rm,
        standard_rm_other=std_rm_other,
        total_rm_cost=total_rm_cost,
        transport=transport,
        discount=discount,
        margin=margin,
        margin_pct=margin_pct,
        location=location,
        raw_data=data
    )


def adapt_sale_row(
    record: Dict[str, Any],
    errors: List[Dict[str, Any]],
    warnings: List[Dict[str, Any]]
) -> Optional[AstroformSaleRecord]:
    sheet_name = record["sheet_name"]
    row_number = record["row_number"]
    data = record.get("data", {})
    
    raw_doc_num = data.get("Document Number")
    if raw_doc_num is None or str(raw_doc_num).strip() == "":
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": "Document Number",
            "reason": "Missing required Document Number"
        })
        return None
    doc_number = str(raw_doc_num).strip()
    
    posting_date = parse_date(data.get("Posting Date"), "Posting Date", sheet_name, row_number, errors, required=True)
    if posting_date is None:
        return None
        
    customer_name = str(data.get("Customer/Vendor Name", "")).strip()
    if not customer_name:
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": "Customer/Vendor Name",
            "reason": "Missing required Customer/Vendor Name"
        })
        return None
        
    internal_number = str(data["Internal Number"]).strip() if data.get("Internal Number") is not None else None
    document_type = str(data["Document Type"]).strip() if data.get("Document Type") else None
    bp_ref = str(data["BP Reference No."]).strip() if data.get("BP Reference No.") else None
    location = str(data["Loc"]).strip() if data.get("Loc") else None
    
    basic_val = parse_decimal(data.get("Basic Value"), "Basic Value", sheet_name, row_number, errors)
    igst_rate = parse_decimal(data.get("IGST Rate"), "IGST Rate", sheet_name, row_number, errors)
    igst_amt = parse_decimal(data.get("IGSTAmt"), "IGSTAmt", sheet_name, row_number, errors)
    cgst_rate = parse_decimal(data.get("CGST Rate"), "CGST Rate", sheet_name, row_number, errors)
    cgst_amt = parse_decimal(data.get("CGSTAmt"), "CGSTAmt", sheet_name, row_number, errors)
    utgst_rate = parse_decimal(data.get("UTGST Rate"), "UTGST Rate", sheet_name, row_number, errors)
    utgst_amt = parse_decimal(data.get("UTGSTAmt"), "UTGSTAmt", sheet_name, row_number, errors)
    freight_tax_amt = parse_decimal(data.get("Freight Tax Amt"), "Freight Tax Amt", sheet_name, row_number, errors)
    total_freight = parse_decimal(data.get("Total Freight"), "Total Freight", sheet_name, row_number, errors)
    basic_freight_dis = parse_decimal(data.get("Basic+Freight-Dis"), "Basic+Freight-Dis", sheet_name, row_number, errors)
    total_discount = parse_decimal(data.get("Total Discount"), "Total Discount", sheet_name, row_number, errors)
    doc_total = parse_decimal(data.get("Document Total"), "Document Total", sheet_name, row_number, errors)
    
    return AstroformSaleRecord(
        sheet_name=sheet_name,
        row_number=row_number,
        internal_number=internal_number,
        document_type=document_type,
        document_number=doc_number,
        posting_date=posting_date,
        customer_name=customer_name,
        bp_reference_no=bp_ref,
        basic_value=basic_val,
        igst_rate=igst_rate,
        igst_amount=igst_amt,
        cgst_rate=cgst_rate,
        cgst_amount=cgst_amt,
        utgst_rate=utgst_rate,
        utgst_amount=utgst_amt,
        freight_tax_amount=freight_tax_amt,
        total_freight=total_freight,
        basic_plus_freight_minus_dis=basic_freight_dis,
        total_discount=total_discount,
        document_total=doc_total,
        location=location,
        raw_data=data
    )


def adapt_purchase_row(
    record: Dict[str, Any],
    errors: List[Dict[str, Any]],
    warnings: List[Dict[str, Any]]
) -> Optional[AstroformPurchaseRecord]:
    sheet_name = record["sheet_name"]
    row_number = record["row_number"]
    data = record.get("data", {})
    
    vendor_name = str(data.get("Vendor Name", "")).strip()
    if not vendor_name:
        errors.append({
            "sheet_name": sheet_name,
            "row_number": row_number,
            "field": "Vendor Name",
            "reason": "Missing required Vendor Name"
        })
        return None
        
    date_val = parse_date(data.get("Date"), "Date", sheet_name, row_number, errors, required=True)
    if date_val is None:
        return None
        
    doc_date = parse_date(data.get("Document Date"), "Document Date", sheet_name, row_number, errors, required=False)
    
    doc_internal_id = str(data["Document Internal ID"]).strip() if data.get("Document Internal ID") is not None else None
    ap_inv_num = str(data["AP Inv. #"]).strip() if data.get("AP Inv. #") is not None else None
    bill_no_and_dt = str(data["Bill No. & Dt."]).strip() if data.get("Bill No. & Dt.") is not None else None
    gst_regn_no = str(data["GST Regn No of BP"]).strip() if data.get("GST Regn No of BP") is not None else None
    bill_to = str(data["Bill to"]).strip() if data.get("Bill to") is not None else None
    doc_status = str(data["Doc Status"]).strip() if data.get("Doc Status") is not None else None
    group_code = str(data["Group Code"]).strip() if data.get("Group Code") is not None else None
    group_name = str(data["Group Name"]).strip() if data.get("Group Name") is not None else None
    distribution_rule = str(data["Distribution Rule"]).strip() if data.get("Distribution Rule") is not None else None
    location = str(data["Location"]).strip() if data.get("Location") is not None else None
    loc = str(data["loc"]).strip() if data.get("loc") else None
    
    base_amount = parse_decimal(data.get("Base Amt.(Rs.)"), "Base Amt.(Rs.)", sheet_name, row_number, errors)
    base_qty = parse_decimal(data.get("Base Quantity"), "Base Quantity", sheet_name, row_number, errors)
    
    cgst_amount = parse_decimal(data.get("CGST (Rs.)"), "CGST (Rs.)", sheet_name, row_number, errors)
    cgst_rate, cgst_rate_raw = parse_tax_rate_string(data.get("CGST(Rate)"), "CGST(Rate)", sheet_name, row_number, errors)
    
    sgst_amount = parse_decimal(data.get("SGST (Rs.)"), "SGST (Rs.)", sheet_name, row_number, errors)
    sgst_rate, sgst_rate_raw = parse_tax_rate_string(data.get("SGST (Rate)"), "SGST (Rate)", sheet_name, row_number, errors)
    
    igst_amount = parse_decimal(data.get("IGST (Rs.)"), "IGST (Rs.)", sheet_name, row_number, errors)
    igst_rate, igst_rate_raw = parse_tax_rate_string(data.get("IGST (Rate)"), "IGST (Rate)", sheet_name, row_number, errors)
    
    freight = parse_decimal(data.get("Freight (Rs.)"), "Freight (Rs.)", sheet_name, row_number, errors)
    tds_amount = parse_decimal(data.get("TDS (Rs.)"), "TDS (Rs.)", sheet_name, row_number, errors)
    total_amount = parse_decimal(data.get("Total (Rs.)"), "Total (Rs.)", sheet_name, row_number, errors)
    
    return AstroformPurchaseRecord(
        sheet_name=sheet_name,
        row_number=row_number,
        doc_internal_id=doc_internal_id,
        ap_inv_num=ap_inv_num,
        date=date_val,
        vendor_name=vendor_name,
        bill_no_and_dt=bill_no_and_dt,
        document_date=doc_date,
        gst_regn_no=gst_regn_no,
        bill_to=bill_to,
        doc_status=doc_status,
        group_code=group_code,
        group_name=group_name,
        distribution_rule=distribution_rule,
        location=location,
        loc=loc,
        base_amount=base_amount,
        base_quantity=base_qty,
        cgst_amount=cgst_amount,
        cgst_rate=cgst_rate,
        cgst_rate_raw=cgst_rate_raw,
        sgst_amount=sgst_amount,
        sgst_rate=sgst_rate,
        sgst_rate_raw=sgst_rate_raw,
        igst_amount=igst_amount,
        igst_rate=igst_rate,
        igst_rate_raw=igst_rate_raw,
        freight=freight,
        tds_amount=tds_amount,
        total_amount=total_amount,
        raw_data=data
    )


def adapt_astroform_records(parsed_records: List[Dict[str, Any]]) -> AstroformAdapterResult:
    """
    Transforms generic multi-sheet parser output into normalized, validated Astroform domain structures.
    Performs zero database operations.
    """
    result = AstroformAdapterResult()
    seen_sheets: Set[str] = set()
    
    for rec in parsed_records:
        sheet_name = rec.get("sheet_name")
        if not sheet_name:
            continue
            
        seen_sheets.add(sheet_name)
        
        if sheet_name == "Margin Report":
            adapted = adapt_margin_row(rec, result.validation_errors, result.validation_warnings)
            if adapted:
                result.margin_records.append(adapted)
                
        elif sheet_name == "Sale Register Customer Wise":
            adapted = adapt_sale_row(rec, result.validation_errors, result.validation_warnings)
            if adapted:
                result.sale_records.append(adapted)
                
        elif sheet_name == "Purchase Register Vendor Wise":
            adapted = adapt_purchase_row(rec, result.validation_errors, result.validation_warnings)
            if adapted:
                result.purchase_records.append(adapted)
                
        else:
            if sheet_name not in result.unknown_sheets:
                result.unknown_sheets.append(sheet_name)
                result.validation_warnings.append({
                    "sheet_name": sheet_name,
                    "row_number": rec.get("row_number", 0),
                    "field": "sheet_name",
                    "reason": f"Unknown worksheet '{sheet_name}' was skipped safely without conversion."
                })
                
    # Cross-sheet reconciliation identification
    margin_invs = {r.invoice_no for r in result.margin_records if r.invoice_no}
    sale_invs = {r.document_number for r in result.sale_records if r.document_number}
    
    common_invs = margin_invs.intersection(sale_invs)
    result.cross_sheet_invoice_matches = sorted(list(common_invs))
    
    return result
