import pytest
from uuid import uuid4
import datetime
from decimal import Decimal

from app.models.company import Company
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.services.astroform_adapter import (
    AstroformAdapterResult,
    AstroformMarginRecord,
    AstroformSaleRecord,
    AstroformPurchaseRecord
)
from app.services.astroform_financial_ingestion import (
    AstroformFinancialIngestionService,
    AstroformFinancialIngestionResult
)

def create_test_company(db_session, name="Test Company", currency_code="INR"):
    comp = Company(
        id=uuid4(),
        name=name,
        currency_code=currency_code,
        region="APAC",
        fiscal_year_start_month=4,
        status="active",
        country_code="IN"
    )
    db_session.add(comp)
    db_session.commit()
    return comp

# =========================================================================
# Step 6 — Financial Transaction Ingestion Tests
# =========================================================================

def test_sales_to_revenue_and_purchases_to_expenditure(db_session):
    """A & B. Sales create 'revenue' and Purchases create 'expenditure' transactions."""
    comp = create_test_company(db_session)
    service = AstroformFinancialIngestionService(db_session, comp.id)

    adapter_result = AstroformAdapterResult(
        sale_records=[
            AstroformSaleRecord(
                sheet_name="Sale Register Customer Wise",
                row_number=2,
                internal_number="2557",
                document_type="I",
                document_number="26270441",
                posting_date=datetime.date(2026, 9, 2),
                customer_name="WELD & CUT ENTERPRISES",
                bp_reference_no="Verbal",
                basic_value=Decimal("21600.00"),
                igst_rate=Decimal("18.00"),
                igst_amount=Decimal("3888.00"),
                cgst_rate=Decimal("0.00"),
                cgst_amount=Decimal("0.00"),
                utgst_rate=Decimal("0.00"),
                utgst_amount=Decimal("0.00"),
                freight_tax_amount=Decimal("252.00"),
                total_freight=Decimal("1400.00"),
                basic_plus_freight_minus_dis=Decimal("23000.00"),
                total_discount=Decimal("0.00"),
                document_total=Decimal("27140.00"),
                location=None
            )
        ],
        purchase_records=[
            AstroformPurchaseRecord(
                sheet_name="Purchase Register Vendor Wise",
                row_number=2,
                doc_internal_id="2793",
                ap_inv_num="26270072",
                date=datetime.date(2026, 8, 26),
                vendor_name="ZHEJIANG AOYU NEW MATERIAL",
                bill_no_and_dt="AY20260626",
                document_date=datetime.date(2026, 7, 16),
                gst_regn_no=None,
                bill_to="China",
                doc_status="Closed",
                group_code="101",
                group_name="Raw Material",
                distribution_rule=None,
                location="Delhi",
                loc="HO-Thane",
                base_amount=Decimal("1344507.90"),
                base_quantity=Decimal("70400.00"),
                cgst_amount=Decimal("0.00"),
                cgst_rate=None,
                cgst_rate_raw=None,
                sgst_amount=Decimal("0.00"),
                sgst_rate=None,
                sgst_rate_raw=None,
                igst_amount=Decimal("0.00"),
                igst_rate=Decimal("18.00"),
                igst_rate_raw="IGST@18",
                freight=Decimal("0.00"),
                tds_amount=Decimal("0.00"),
                total_amount=Decimal("1344507.90")
            )
        ]
    )

    res = service.ingest_financial_transactions(adapter_result)
    db_session.commit()

    assert res.sales_transactions_created == 1
    assert res.purchase_transactions_created == 1

    txs = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp.id).all()
    assert len(txs) == 2

    sale_tx = next(t for t in txs if t.transaction_type == "revenue")
    assert sale_tx.amount == Decimal("27140.00")
    assert sale_tx.tax_amount == Decimal("4140.00") # 3888 + 252
    assert sale_tx.description == "Invoice: 26270441"
    assert sale_tx.customer_id is not None
    assert sale_tx.vendor_id is None

    purch_tx = next(t for t in txs if t.transaction_type == "expenditure")
    assert purch_tx.amount == Decimal("1344507.90")
    assert purch_tx.description == "Bill: AY20260626"
    assert purch_tx.vendor_id is not None
    assert purch_tx.customer_id is None

def test_margin_report_creates_zero_transactions(db_session):
    """C & L. Margin Report creates ZERO FinancialTransactions, avoiding cross-sheet duplicate revenue."""
    comp = create_test_company(db_session)
    service = AstroformFinancialIngestionService(db_session, comp.id)

    adapter_result = AstroformAdapterResult(
        margin_records=[
            AstroformMarginRecord(
                sheet_name="Margin Report",
                row_number=2,
                invoice_no="26270441",
                invoice_date=datetime.date(2026, 9, 2),
                customer_code="C0070",
                customer_name="WELD & CUT ENTERPRISES",
                product_code="FG0119",
                product_name="Magic Wipe Sponge",
                sales_price=Decimal("60.00"),
                sales_quantity=Decimal("360.00"),
                net_sales=Decimal("23000.00"),
                standard_rm=Decimal("3267.65"),
                standard_rm_other=Decimal("15967.29"),
                total_rm_cost=Decimal("19234.94"),
                transport=Decimal("1400.00"),
                discount=Decimal("0.00"),
                margin=Decimal("3765.06"),
                margin_pct=Decimal("15.43"),
                location=None
            )
        ],
        sale_records=[], # No sales rows
        purchase_records=[]
    )

    res = service.ingest_financial_transactions(adapter_result)
    db_session.commit()

    assert res.margin_transactions_created == 0
    assert res.sales_transactions_created == 0
    assert res.purchase_transactions_created == 0

    tx_count = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp.id).count()
    assert tx_count == 0

def test_customer_and_vendor_fk_resolution(db_session):
    """D & E. Foreign keys link cleanly to resolved Customer and Vendor master records."""
    comp = create_test_company(db_session)
    service = AstroformFinancialIngestionService(db_session, comp.id)

    adapter_result = AstroformAdapterResult(
        sale_records=[
            AstroformSaleRecord(
                sheet_name="Sale Register Customer Wise",
                row_number=2,
                internal_number="1",
                document_type="I",
                document_number="INV-100",
                posting_date=datetime.date(2026, 3, 1),
                customer_name="Electra Engineering",
                bp_reference_no=None,
                basic_value=Decimal("50000.00"),
                igst_rate=Decimal("18.00"),
                igst_amount=Decimal("9000.00"),
                cgst_rate=Decimal("0.00"),
                cgst_amount=Decimal("0.00"),
                utgst_rate=Decimal("0.00"),
                utgst_amount=Decimal("0.00"),
                freight_tax_amount=Decimal("0.00"),
                total_freight=Decimal("0.00"),
                basic_plus_freight_minus_dis=Decimal("50000.00"),
                total_discount=Decimal("0.00"),
                document_total=Decimal("59000.00"),
                location=None
            )
        ]
    )

    service.ingest_financial_transactions(adapter_result)
    db_session.commit()

    cust = db_session.query(Customer).filter(Customer.company_id == comp.id, Customer.name == "Electra Engineering").first()
    assert cust is not None

    tx = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp.id).first()
    assert tx.customer_id == cust.id

def test_factory_null_behavior(db_session):
    """G. Unmatched factory location evaluates to factory_id = NULL without error."""
    comp = create_test_company(db_session)
    service = AstroformFinancialIngestionService(db_session, comp.id)

    adapter_result = AstroformAdapterResult(
        purchase_records=[
            AstroformPurchaseRecord(
                sheet_name="Purchase Register Vendor Wise",
                row_number=2,
                doc_internal_id="1",
                ap_inv_num="1",
                date=datetime.date(2026, 3, 1),
                vendor_name="Sample Vendor",
                bill_no_and_dt="B1",
                document_date=None,
                gst_regn_no=None,
                bill_to=None,
                doc_status="Closed",
                group_code=None,
                group_name=None,
                distribution_rule=None,
                location="Unmatched Unknown Location",
                loc=None,
                base_amount=Decimal("1000.00"),
                base_quantity=Decimal("1.00"),
                cgst_amount=Decimal("0.00"),
                cgst_rate=None,
                cgst_rate_raw=None,
                sgst_amount=Decimal("0.00"),
                sgst_rate=None,
                sgst_rate_raw=None,
                igst_amount=Decimal("0.00"),
                igst_rate=None,
                igst_rate_raw=None,
                freight=Decimal("0.00"),
                tds_amount=Decimal("0.00"),
                total_amount=Decimal("1000.00")
            )
        ]
    )

    service.ingest_financial_transactions(adapter_result)
    db_session.commit()

    tx = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp.id).first()
    assert tx.factory_id is None

def test_second_run_idempotency(db_session):
    """M. Running ingestion a second time creates 0 duplicate financial transactions."""
    comp = create_test_company(db_session)
    service = AstroformFinancialIngestionService(db_session, comp.id)

    adapter_result = AstroformAdapterResult(
        sale_records=[
            AstroformSaleRecord(
                sheet_name="Sale Register Customer Wise",
                row_number=2,
                internal_number="1",
                document_type="I",
                document_number="INV-IDEMP",
                posting_date=datetime.date(2026, 3, 1),
                customer_name="Idempotent Customer",
                bp_reference_no=None,
                basic_value=Decimal("1000.00"),
                igst_rate=Decimal("18.00"),
                igst_amount=Decimal("180.00"),
                cgst_rate=Decimal("0.00"),
                cgst_amount=Decimal("0.00"),
                utgst_rate=Decimal("0.00"),
                utgst_amount=Decimal("0.00"),
                freight_tax_amount=Decimal("0.00"),
                total_freight=Decimal("0.00"),
                basic_plus_freight_minus_dis=Decimal("1000.00"),
                total_discount=Decimal("0.00"),
                document_total=Decimal("1180.00"),
                location=None
            )
        ]
    )

    # First run
    res1 = service.ingest_financial_transactions(adapter_result)
    db_session.commit()
    assert res1.sales_transactions_created == 1
    assert res1.sales_transactions_matched == 0

    # Second run
    res2 = service.ingest_financial_transactions(adapter_result)
    db_session.commit()
    assert res2.sales_transactions_created == 0
    assert res2.sales_transactions_matched == 1

    count = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp.id).count()
    assert count == 1

def test_no_tds_added_to_gst(db_session):
    """P. Verifies TDS withholding is NOT erroneously added to statutory GST tax_amount."""
    comp = create_test_company(db_session)
    service = AstroformFinancialIngestionService(db_session, comp.id)

    adapter_result = AstroformAdapterResult(
        purchase_records=[
            AstroformPurchaseRecord(
                sheet_name="Purchase Register Vendor Wise",
                row_number=2,
                doc_internal_id="1",
                ap_inv_num="1",
                date=datetime.date(2026, 3, 1),
                vendor_name="TDS Vendor",
                bill_no_and_dt="BILL-TDS",
                document_date=None,
                gst_regn_no=None,
                bill_to=None,
                doc_status="Closed",
                group_code=None,
                group_name=None,
                distribution_rule=None,
                location=None,
                loc=None,
                base_amount=Decimal("10000.00"),
                base_quantity=Decimal("10.00"),
                cgst_amount=Decimal("900.00"),
                cgst_rate=Decimal("9.00"),
                cgst_rate_raw="CGST@9",
                sgst_amount=Decimal("900.00"),
                sgst_rate=Decimal("9.00"),
                sgst_rate_raw="SGST@9",
                igst_amount=Decimal("0.00"),
                igst_rate=None,
                igst_rate_raw=None,
                freight=Decimal("0.00"),
                tds_amount=Decimal("100.00"), # TDS withholding
                total_amount=Decimal("11800.00")
            )
        ]
    )

    service.ingest_financial_transactions(adapter_result)
    db_session.commit()

    tx = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp.id).first()
    assert tx.tax_amount == Decimal("1800.00") # 900 + 900, NOT 1900!

def test_tenant_isolation_financial(db_session):
    """N. Financial transactions are strictly isolated by company_id."""
    comp_a = create_test_company(db_session, "Company A")
    comp_b = create_test_company(db_session, "Company B")

    service_a = AstroformFinancialIngestionService(db_session, comp_a.id)
    adapter_result = AstroformAdapterResult(
        sale_records=[
            AstroformSaleRecord(
                sheet_name="Sale Register Customer Wise",
                row_number=2,
                internal_number="1",
                document_type="I",
                document_number="INV-TENANT",
                posting_date=datetime.date(2026, 3, 1),
                customer_name="Tenant Customer",
                bp_reference_no=None,
                basic_value=Decimal("1000.00"),
                igst_rate=Decimal("18.00"),
                igst_amount=Decimal("180.00"),
                cgst_rate=Decimal("0.00"),
                cgst_amount=Decimal("0.00"),
                utgst_rate=Decimal("0.00"),
                utgst_amount=Decimal("0.00"),
                freight_tax_amount=Decimal("0.00"),
                total_freight=Decimal("0.00"),
                basic_plus_freight_minus_dis=Decimal("1000.00"),
                total_discount=Decimal("0.00"),
                document_total=Decimal("1180.00"),
                location=None
            )
        ]
    )

    service_a.ingest_financial_transactions(adapter_result)
    db_session.commit()

    # Company A has 1 transaction, Company B has 0
    assert db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp_a.id).count() == 1
    assert db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == comp_b.id).count() == 0
