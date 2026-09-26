import logging
from typing import Dict, List, Optional, Any
from uuid import UUID
from decimal import Decimal
from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.financial_transaction import FinancialTransaction
from app.services.astroform_adapter import (
    AstroformAdapterResult,
    AstroformSaleRecord,
    AstroformPurchaseRecord
)
from app.services.astroform_master_data import (
    AstroformMasterDataService,
    AstroformMasterDataResult
)
from app.services.currency import CurrencyService

logger = logging.getLogger(__name__)

@dataclass
class AstroformFinancialIngestionResult:
    sales_transactions_created: int = 0
    sales_transactions_matched: int = 0
    purchase_transactions_created: int = 0
    purchase_transactions_matched: int = 0
    margin_transactions_created: int = 0
    total_revenue_ingested: Decimal = Decimal("0.00")
    total_expenditure_ingested: Decimal = Decimal("0.00")
    total_sales_tax_ingested: Decimal = Decimal("0.00")
    total_purchase_tax_ingested: Decimal = Decimal("0.00")
    created_transaction_ids: List[UUID] = field(default_factory=list)
    errors: List[Dict[str, Any]] = field(default_factory=list)


class AstroformFinancialIngestionService:
    def __init__(self, db: Session, company_id: UUID):
        if not company_id:
            raise ValueError("company_id is required for financial transaction ingestion.")
        self.db = db
        self.company_id = company_id
        
        self.company = self.db.query(Company).filter(Company.id == self.company_id).first()
        if not self.company:
            raise ValueError(f"Company {company_id} not found.")
            
        self.master_data_service = AstroformMasterDataService(db, company_id)
        self.currency_service = CurrencyService(db)

    def ingest_financial_transactions(
        self,
        adapter_result: AstroformAdapterResult,
        master_data_result: Optional[AstroformMasterDataResult] = None
    ) -> AstroformFinancialIngestionResult:
        """
        Ingests authoritative sales ('revenue') and purchase ('expenditure') records
        into the FinancialTransaction model with tenant scoping and idempotency.
        Margin Report explicitly creates ZERO financial transactions.
        """
        result = AstroformFinancialIngestionResult()
        
        # 1. Resolve master data if not already provided
        if not master_data_result:
            master_data_result = self.master_data_service.process_adapter_result(adapter_result)
            
        new_transactions: List[FinancialTransaction] = []
        
        # 2. Ingest Sales from 'Sale Register Customer Wise' (Authoritative for Revenue)
        for s in adapter_result.sale_records:
            try:
                # Resolve Customer
                cust, _ = self.master_data_service.resolve_customer(s.customer_name)
                
                # Resolve Factory if location present
                factory_id = None
                if s.location:
                    fac = self.master_data_service.resolve_factory(s.location)
                    if fac:
                        factory_id = fac.id
                        
                # Tax Rate & Tax Amount
                effective_tax_rate = s.igst_rate if s.igst_rate > Decimal("0.00") else (s.cgst_rate + s.utgst_rate)
                total_tax_amount = s.igst_amount + s.cgst_amount + s.utgst_amount + s.freight_tax_amount
                
                description = f"Invoice: {s.document_number}"
                tx_currency = "INR"
                
                # Base currency conversion
                if self.company.currency_code == tx_currency:
                    amount_base = s.document_total
                    exchange_rate = Decimal("1.000000")
                else:
                    amount_base, exchange_rate = self.currency_service.convert_to_company_base(
                        company_id=self.company_id,
                        amount=s.document_total,
                        transaction_currency=tx_currency,
                        transaction_date=s.posting_date
                    )
                    
                # Application-level idempotency / duplicate check
                existing = self.db.query(FinancialTransaction).filter(
                    FinancialTransaction.company_id == self.company_id,
                    FinancialTransaction.transaction_type == "revenue",
                    FinancialTransaction.transaction_date == s.posting_date,
                    FinancialTransaction.amount == s.document_total,
                    FinancialTransaction.description == description
                ).first()
                
                if existing:
                    result.sales_transactions_matched += 1
                else:
                    tx = FinancialTransaction(
                        company_id=self.company_id,
                        factory_id=factory_id,
                        transaction_date=s.posting_date,
                        transaction_type="revenue",
                        amount=s.document_total,
                        currency_code=tx_currency,
                        description=description,
                        amount_base=amount_base,
                        exchange_rate=exchange_rate,
                        tax_rate=effective_tax_rate,
                        tax_amount=total_tax_amount,
                        is_tax_inclusive=False,
                        customer_id=cust.id,
                        vendor_id=None,
                        product_id=None
                    )
                    self.db.add(tx)
                    new_transactions.append(tx)
                    result.sales_transactions_created += 1
                    result.total_revenue_ingested += s.document_total
                    result.total_sales_tax_ingested += total_tax_amount
                    
            except Exception as e:
                result.errors.append({
                    "sheet_name": s.sheet_name,
                    "row_number": s.row_number,
                    "document_number": s.document_number,
                    "error": str(e)
                })
                raise
                
        # 3. Ingest Purchases from 'Purchase Register Vendor Wise' (Authoritative for Expenditure)
        for p in adapter_result.purchase_records:
            try:
                # Resolve Vendor
                vendor, _ = self.master_data_service.resolve_vendor(p.vendor_name)
                
                # Resolve Factory if location present
                factory_id = None
                loc_str = p.location or p.loc
                if loc_str:
                    fac = self.master_data_service.resolve_factory(loc_str)
                    if fac:
                        factory_id = fac.id
                        
                # Tax Rate & Tax Amount
                effective_tax_rate = p.igst_rate if p.igst_rate else ((p.cgst_rate or Decimal("0.00")) + (p.sgst_rate or Decimal("0.00")))
                total_tax_amount = p.cgst_amount + p.sgst_amount + p.igst_amount # TDS is withholding, NOT added to GST
                
                doc_ref = p.bill_no_and_dt or p.ap_inv_num or p.doc_internal_id or "UNKNOWN"
                description = f"Bill: {doc_ref}"
                tx_currency = "INR"
                
                if self.company.currency_code == tx_currency:
                    amount_base = p.total_amount
                    exchange_rate = Decimal("1.000000")
                else:
                    amount_base, exchange_rate = self.currency_service.convert_to_company_base(
                        company_id=self.company_id,
                        amount=p.total_amount,
                        transaction_currency=tx_currency,
                        transaction_date=p.date
                    )
                    
                # Application-level idempotency / duplicate check
                existing = self.db.query(FinancialTransaction).filter(
                    FinancialTransaction.company_id == self.company_id,
                    FinancialTransaction.transaction_type == "expenditure",
                    FinancialTransaction.transaction_date == p.date,
                    FinancialTransaction.amount == p.total_amount,
                    FinancialTransaction.description == description
                ).first()
                
                if existing:
                    result.purchase_transactions_matched += 1
                else:
                    tx = FinancialTransaction(
                        company_id=self.company_id,
                        factory_id=factory_id,
                        transaction_date=p.date,
                        transaction_type="expenditure",
                        amount=p.total_amount,
                        currency_code=tx_currency,
                        description=description,
                        amount_base=amount_base,
                        exchange_rate=exchange_rate,
                        tax_rate=effective_tax_rate,
                        tax_amount=total_tax_amount,
                        is_tax_inclusive=False,
                        customer_id=None,
                        vendor_id=vendor.id,
                        product_id=None
                    )
                    self.db.add(tx)
                    new_transactions.append(tx)
                    result.purchase_transactions_created += 1
                    result.total_expenditure_ingested += p.total_amount
                    result.total_purchase_tax_ingested += total_tax_amount
                    
            except Exception as e:
                result.errors.append({
                    "sheet_name": p.sheet_name,
                    "row_number": p.row_number,
                    "vendor_name": p.vendor_name,
                    "error": str(e)
                })
                raise

        # 4. Explicit Margin Report Boundary
        # Margin Report creates ZERO FinancialTransaction records
        result.margin_transactions_created = 0
        
        # Flush all pending inserts to retrieve generated IDs
        self.db.flush()
        result.created_transaction_ids = [tx.id for tx in new_transactions]
        
        return result
