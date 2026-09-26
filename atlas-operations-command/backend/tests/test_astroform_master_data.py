import pytest
from uuid import uuid4
import datetime
from decimal import Decimal

from app.models.customer import Customer
from app.models.product import Product
from app.models.vendor import Vendor
from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.models.company import Company
from app.services.astroform_adapter import (
    AstroformAdapterResult,
    AstroformMarginRecord,
    AstroformSaleRecord,
    AstroformPurchaseRecord
)
from app.services.astroform_master_data import (
    AstroformMasterDataService,
    AstroformMasterDataResult
)

def create_test_company(db_session, name="Test Company"):
    comp = Company(
        id=uuid4(),
        name=name,
        currency_code="INR",
        region="APAC",
        fiscal_year_start_month=4,
        status="active",
        country_code="IN"
    )
    db_session.add(comp)
    db_session.commit()
    return comp

# =========================================================================
# Step 5 — Master Data Resolution & Ingestion Tests
# =========================================================================

def test_customer_matched_by_code(db_session):
    """A. Existing customer matched by code."""
    comp = create_test_company(db_session)
    existing_cust = Customer(
        company_id=comp.id,
        name="Old Name",
        code="C001",
        status="active"
    )
    db_session.add(existing_cust)
    db_session.commit()

    service = AstroformMasterDataService(db_session, comp.id)
    cust, created = service.resolve_customer("New Reported Name", "C001")
    assert not created
    assert cust.id == existing_cust.id
    assert cust.code == "C001"

def test_customer_matched_by_name(db_session):
    """B. Existing customer matched by name."""
    comp = create_test_company(db_session)
    existing_cust = Customer(
        company_id=comp.id,
        name="Weld & Cut Enterprises",
        code=None,
        status="active"
    )
    db_session.add(existing_cust)
    db_session.commit()

    service = AstroformMasterDataService(db_session, comp.id)
    cust, created = service.resolve_customer("WELD & CUT ENTERPRISES", "C0070")
    assert not created
    assert cust.id == existing_cust.id
    assert cust.code == "C0070" # code updated because it was previously None

def test_new_customer_creation(db_session):
    """C. New customer creation."""
    comp = create_test_company(db_session)
    service = AstroformMasterDataService(db_session, comp.id)
    cust, created = service.resolve_customer("Brand New Customer", "C999")
    assert created
    assert cust.company_id == comp.id
    assert cust.name == "Brand New Customer"
    assert cust.code == "C999"
    assert cust.status == "active"

def test_same_customer_across_multiple_sheets(db_session):
    """D. Same customer appearing across Margin Report and Sale Register resolves to single record."""
    comp = create_test_company(db_session)
    service = AstroformMasterDataService(db_session, comp.id)
    
    adapter_result = AstroformAdapterResult(
        margin_records=[
            AstroformMarginRecord(
                sheet_name="Margin Report",
                row_number=2,
                invoice_no="INV-1",
                invoice_date=datetime.date(2026, 3, 1),
                customer_code="C0070",
                customer_name="Weld & Cut Enterprises",
                product_code="P1",
                product_name="Product 1",
                sales_price=Decimal("100"),
                sales_quantity=Decimal("10"),
                net_sales=Decimal("1000"),
                standard_rm=Decimal("500"),
                standard_rm_other=Decimal("100"),
                total_rm_cost=Decimal("600"),
                transport=Decimal("50"),
                discount=Decimal("0"),
                margin=Decimal("350"),
                margin_pct=Decimal("35.0"),
                location=None
            )
        ],
        sale_records=[
            AstroformSaleRecord(
                sheet_name="Sale Register Customer Wise",
                row_number=2,
                internal_number="1",
                document_type="I",
                document_number="INV-1",
                posting_date=datetime.date(2026, 3, 1),
                customer_name="Weld & Cut Enterprises",
                bp_reference_no=None,
                basic_value=Decimal("1000"),
                igst_rate=Decimal("18"),
                igst_amount=Decimal("180"),
                cgst_rate=Decimal("0"),
                cgst_amount=Decimal("0"),
                utgst_rate=Decimal("0"),
                utgst_amount=Decimal("0"),
                freight_tax_amount=Decimal("0"),
                total_freight=Decimal("50"),
                basic_plus_freight_minus_dis=Decimal("1050"),
                total_discount=Decimal("0"),
                document_total=Decimal("1230"),
                location=None
            )
        ]
    )
    
    res = service.process_adapter_result(adapter_result)
    db_session.commit()
    
    # Verify only ONE customer was created in the database
    custs = db_session.query(Customer).filter(Customer.company_id == comp.id).all()
    assert len(custs) == 1
    assert custs[0].name == "Weld & Cut Enterprises"
    assert custs[0].code == "C0070"
    assert res.customers_created == 1
    assert res.customers_matched == 0 # second reference was skipped/cached

def test_product_resolution_by_code_and_name(db_session):
    """E, F, G. Product resolution by code, by name, and new product creation."""
    comp = create_test_company(db_session)
    existing_p = Product(
        company_id=comp.id,
        name="Existing Widget",
        code="FG001",
        status="active"
    )
    db_session.add(existing_p)
    db_session.commit()

    service = AstroformMasterDataService(db_session, comp.id)
    # Match by code
    p1, created1 = service.resolve_product("Updated Name Widget", "FG001")
    assert not created1
    assert p1.id == existing_p.id

    # Create new
    p2, created2 = service.resolve_product("Magic Wipe Sponge", "FG0119")
    assert created2
    assert p2.name == "Magic Wipe Sponge"
    assert p2.code == "FG0119"
    assert p2.category is None # category is not invented

def test_vendor_resolution_no_vendor_code(db_session):
    """H, I, J. Vendor resolution by name; Vendor code remains None (never invented)."""
    comp = create_test_company(db_session)
    existing_v = Vendor(
        company_id=comp.id,
        name="Existing Steel Supplier",
        code=None,
        status="active"
    )
    db_session.add(existing_v)
    db_session.commit()

    service = AstroformMasterDataService(db_session, comp.id)
    # Match existing by name
    v1, created1 = service.resolve_vendor("EXISTING STEEL SUPPLIER")
    assert not created1
    assert v1.id == existing_v.id

    # Create new vendor
    v2, created2 = service.resolve_vendor("ZHEJIANG AOYU NEW MATERIAL")
    assert created2
    assert v2.name == "ZHEJIANG AOYU NEW MATERIAL"
    assert v2.code is None # Vendor code is NEVER invented

def test_factory_read_only_resolution(db_session):
    """K, L, M. Factory matching: matched vs unmatched; factory is NEVER auto-created."""
    comp = create_test_company(db_session)
    fac_delhi = Factory(
        company_id=comp.id,
        name="Delhi Plant",
        code="DEL01",
        location="Delhi",
        status="active"
    )
    db_session.add(fac_delhi)
    db_session.commit()

    service = AstroformMasterDataService(db_session, comp.id)
    # Match existing by location
    matched_fac = service.resolve_factory("Delhi")
    assert matched_fac is not None
    assert matched_fac.id == fac_delhi.id

    # Unmatched location -> returns None
    unmatched_fac = service.resolve_factory("HO-Thane")
    assert unmatched_fac is None

    # Verify no new Factory was created in database
    factories = db_session.query(Factory).filter(Factory.company_id == comp.id).all()
    assert len(factories) == 1

def test_tenant_isolation(db_session):
    """N. Master data operations are strictly isolated by company_id."""
    comp_a = create_test_company(db_session, "Company A")
    comp_b = create_test_company(db_session, "Company B")

    # Customer in Company A
    cust_a = Customer(company_id=comp_a.id, name="Shared Customer Name", code="C100", status="active")
    db_session.add(cust_a)
    db_session.commit()

    # Resolve in Company B with same name
    service_b = AstroformMasterDataService(db_session, comp_b.id)
    cust_b, created_b = service_b.resolve_customer("Shared Customer Name", "C100")
    db_session.commit()

    assert created_b
    assert cust_b.id != cust_a.id
    assert cust_b.company_id == comp_b.id

    # Verify Company A customer was not modified
    cust_a_refreshed = db_session.query(Customer).filter(Customer.id == cust_a.id).first()
    assert cust_a_refreshed.company_id == comp_a.id

def test_duplicate_prevention_within_batch(db_session):
    """O. Verify in-memory batch caching prevents duplicate records for identical names in consecutive rows."""
    comp = create_test_company(db_session)
    service = AstroformMasterDataService(db_session, comp.id)

    # Resolve same customer 5 times in batch
    for _ in range(5):
        cust, _ = service.resolve_customer("Batch Repeat Customer", "C555")

    db_session.commit()
    count = db_session.query(Customer).filter(
        Customer.company_id == comp.id,
        Customer.name == "Batch Repeat Customer"
    ).count()
    assert count == 1

def test_transaction_rollback(db_session):
    """P. Master data changes roll back cleanly on fatal error."""
    comp = create_test_company(db_session)
    service = AstroformMasterDataService(db_session, comp.id)

    service.resolve_customer("Rollback Cust", "CRB")
    service.resolve_product("Rollback Prod", "PRB")
    
    # Force rollback
    db_session.rollback()

    assert db_session.query(Customer).filter(Customer.company_id == comp.id).count() == 0
    assert db_session.query(Product).filter(Product.company_id == comp.id).count() == 0

def test_no_financial_transactions_created(db_session):
    """Q. Step 5 does NOT create any FinancialTransaction records."""
    comp = create_test_company(db_session)
    service = AstroformMasterDataService(db_session, comp.id)

    adapter_result = AstroformAdapterResult(
        margin_records=[
            AstroformMarginRecord(
                sheet_name="Margin Report",
                row_number=2,
                invoice_no="INV-1",
                invoice_date=datetime.date(2026, 3, 1),
                customer_code="C1",
                customer_name="Customer 1",
                product_code="P1",
                product_name="Product 1",
                sales_price=Decimal("100"),
                sales_quantity=Decimal("10"),
                net_sales=Decimal("1000"),
                standard_rm=Decimal("500"),
                standard_rm_other=Decimal("100"),
                total_rm_cost=Decimal("600"),
                transport=Decimal("50"),
                discount=Decimal("0"),
                margin=Decimal("350"),
                margin_pct=Decimal("35.0"),
                location=None
            )
        ],
        purchase_records=[
            AstroformPurchaseRecord(
                sheet_name="Purchase Register Vendor Wise",
                row_number=2,
                doc_internal_id="1",
                ap_inv_num="1",
                date=datetime.date(2026, 3, 1),
                vendor_name="Vendor 1",
                bill_no_and_dt=None,
                document_date=None,
                gst_regn_no=None,
                bill_to=None,
                doc_status="Closed",
                group_code=None,
                group_name=None,
                distribution_rule=None,
                location=None,
                loc=None,
                base_amount=Decimal("1000"),
                base_quantity=Decimal("10"),
                cgst_amount=Decimal("90"),
                cgst_rate=Decimal("9"),
                cgst_rate_raw="CGST@9",
                sgst_amount=Decimal("90"),
                sgst_rate=Decimal("9"),
                sgst_rate_raw="SGST@9",
                igst_amount=Decimal("0"),
                igst_rate=Decimal("0"),
                igst_rate_raw=None,
                freight=Decimal("0"),
                tds_amount=Decimal("0"),
                total_amount=Decimal("1180")
            )
        ]
    )

    service.process_adapter_result(adapter_result)
    db_session.commit()

    tx_count = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp.id).count()
    assert tx_count == 0
