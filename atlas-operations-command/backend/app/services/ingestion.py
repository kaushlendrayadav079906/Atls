import logging
import traceback
from typing import List, Any
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.upload import FileUpload
from app.models.staging import StagedRecord
from app.services.storage import storage_service
from app.services.parsers import parse_file

# Import Phase 3 models for mapping
from app.models.factory import Factory
from app.models.product import Product
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.inventory_item import InventoryItem
from app.models.financial_transaction import FinancialTransaction
from app.models.kpi_snapshot import KpiSnapshot

from app.services.astroform_adapter import is_astroform_workbook, adapt_astroform_records
from app.services.astroform_master_data import AstroformMasterDataService
from app.services.astroform_financial_ingestion import AstroformFinancialIngestionService

logger = logging.getLogger(__name__)

class IngestionError(Exception):
    pass

def process_upload(db: Session, upload_id: Any, company_id: Any, target_entity: Any = None):
    """
    Background task to process an uploaded file.
    Validates company context, parses file, stages data, and imports transactionally.
    Supports deterministic Astroform multi-sheet ingestion and generic entity mapping.
    """
    if isinstance(upload_id, str):
        upload_id = UUID(upload_id)
    if isinstance(company_id, str):
        company_id = UUID(company_id)

    upload = db.query(FileUpload).filter(FileUpload.id == upload_id, FileUpload.company_id == company_id).first()
    if not upload:
        logger.error(f"Upload {upload_id} not found or tenant mismatch")
        return

    if upload.status not in ["uploaded", "failed"]:
        return

    upload.status = "processing"
    upload.error_message = None
    db.commit()

    try:
        # 1. Parse file using generic parser
        file_path = storage_service.get_file_path(upload.stored_filename)
        raw_records = parse_file(file_path, upload.file_type)
        
        # 2. Check if this is an Astroform workbook
        if upload.file_type == "xlsx" and is_astroform_workbook(raw_records):
            # Astroform specific pipeline
            _process_astroform_upload(db, upload, company_id, raw_records)
        else:
            # Generic ingestion pipeline
            _process_generic_upload(db, upload, company_id, target_entity, raw_records)
            
        upload.status = "completed"
        db.commit()

    except Exception as e:
        db.rollback()
        upload.status = "failed"
        upload.error_message = str(e)
        
        # Save the failure status on the upload record
        db.add(upload)
        db.commit()

def _process_astroform_upload(db: Session, upload: FileUpload, company_id: UUID, raw_records: List[Any]):
    """
    Executes the Astroform pipeline:
    1. Stage all raw parsed multi-sheet records
    2. Adapt records via AstroformAdapter
    3. Resolve & ingest Master Data (Customer, Product, Vendor, Factory lookup)
    4. Ingest authoritative Financial Transactions (Revenue from Sales, Expenditure from Purchases, 0 from Margin Report)
    All operations execute within the existing transaction boundary.
    """
    # 1. Stage records
    staged_items = []
    for raw in raw_records:
        sheet_name = raw.get("sheet_name") if isinstance(raw, dict) else None
        target_ent = "FinancialTransaction" if sheet_name in ["Sale Register Customer Wise", "Purchase Register Vendor Wise"] else "MarginReport"
        staged = StagedRecord(
            company_id=company_id,
            upload_id=upload.id,
            target_entity=target_ent,
            raw_data=raw,
            status="pending"
        )
        staged_items.append(staged)
        
    db.add_all(staged_items)
    db.flush()
    
    # 2. Astroform Adapter
    adapter_result = adapt_astroform_records(raw_records)
    if adapter_result.validation_errors:
        err_msg = f"Astroform adapter validation errors: {adapter_result.validation_errors[:3]}"
        raise IngestionError(err_msg)
        
    # 3. Master Data Resolution
    master_data_svc = AstroformMasterDataService(db, company_id)
    master_data_result = master_data_svc.process_adapter_result(adapter_result)
    
    # 4. Financial Transaction Ingestion
    financial_svc = AstroformFinancialIngestionService(db, company_id)
    fin_result = financial_svc.ingest_financial_transactions(adapter_result, master_data_result)
    if fin_result.errors:
        err_msg = f"Astroform financial ingestion errors: {fin_result.errors[:3]}"
        raise IngestionError(err_msg)
        
    # Mark staged records as imported
    for item in staged_items:
        item.status = "imported"
    db.flush()

def _process_generic_upload(db: Session, upload: FileUpload, company_id: UUID, target_entity: Any, raw_records: List[Any]):
    """
    Generic pipeline for CSV/JSON/XML/TXT and standard XLSX.
    """
    staged_items = []
    for raw in raw_records:
        staged = StagedRecord(
            company_id=company_id,
            upload_id=upload.id,
            target_entity=str(target_entity) if target_entity else None,
            raw_data=raw,
            status="pending"
        )
        staged_items.append(staged)
        
    db.add_all(staged_items)
    db.flush() # flush to get staged IDs
    
    # Transactional mapping (if target_entity is supported)
    if target_entity:
        _map_to_business_entities(db, company_id, str(target_entity), staged_items)


def _map_to_business_entities(db: Session, company_id: UUID, target_entity: str, staged_items: List[StagedRecord]):
    """
    Validates and maps staged items to target Phase 3 entities.
    Raises exception if validation fails to rollback transaction.
    """
    mapped_objects = []
    
    for item in staged_items:
        raw_val = item.raw_data
        data = raw_val.get("data") if isinstance(raw_val, dict) and "data" in raw_val and isinstance(raw_val["data"], dict) else raw_val
        
        if target_entity == "Factory":
            # Map basic factory fields
            if "name" not in data or "code" not in data:
                raise IngestionError(f"Missing required fields for Factory in row: {data}")
            
            obj = Factory(
                company_id=company_id,
                name=str(data["name"]),
                code=str(data["code"]),
                location=str(data.get("location", ""))
            )
            mapped_objects.append(obj)
            item.status = "imported"
            
        elif target_entity == "FinancialTransaction":
            # Map transaction
            if "amount" not in data or "transaction_date" not in data or "type" not in data:
                raise IngestionError(f"Missing required fields for FinancialTransaction in row: {data}")
                
            # Requires parsing amounts securely with Decimal
            from decimal import Decimal, InvalidOperation
            try:
                raw_amt = str(data["amount"]).strip()
                amount_decimal = Decimal(raw_amt)
            except (InvalidOperation, TypeError, ValueError):
                raise IngestionError(f"Invalid amount format: {data['amount']}")
                
            from datetime import datetime
            try:
                # expecting YYYY-MM-DD
                t_date = datetime.strptime(str(data["transaction_date"]).split("T")[0], "%Y-%m-%d").date()
            except ValueError:
                raise IngestionError(f"Invalid date format: {data['transaction_date']}")
            
            # Map factory_id safely if present
            factory_id = data.get("factory_id")
            if factory_id:
                try:
                    factory_uuid = UUID(str(factory_id))
                    # verify factory belongs to company
                    fac = db.query(Factory).filter(Factory.id == factory_uuid, Factory.company_id == company_id).first()
                    if not fac:
                        raise IngestionError(f"Factory {factory_id} not found or doesn't belong to company.")
                except ValueError:
                    raise IngestionError(f"Invalid factory_id UUID: {factory_id}")
            else:
                factory_uuid = None
                
            tx_currency = str(data.get("currency_code", "USD")).strip().upper()

            # Phase 7B Currency conversion for base-currency amounts
            from app.services.currency import CurrencyService
            from app.core.exceptions import CurrencyRateNotFoundError
            
            currency_svc = CurrencyService(db)
            try:
                amount_base, exchange_rate = currency_svc.convert_to_company_base(
                    company_id=company_id,
                    amount=amount_decimal,
                    transaction_currency=tx_currency,
                    transaction_date=t_date
                )
            except CurrencyRateNotFoundError as e:
                raise IngestionError(f"Currency conversion failed: {e.detail}")
            except Exception as e:
                raise IngestionError(f"Currency conversion error: {str(e)}")
                
            obj = FinancialTransaction(
                company_id=company_id,
                factory_id=factory_uuid,
                amount=amount_decimal,
                amount_base=amount_base,
                exchange_rate=exchange_rate,
                transaction_type=str(data["type"]),
                currency_code=tx_currency,
                description=str(data.get("description", "")),
                transaction_date=t_date
            )
            mapped_objects.append(obj)
            item.status = "imported"
            
        else:
            # We don't fail the upload if it's an unsupported entity to map, we just stage it
            # But prompt says: "Only implement mappings that are explicitly supported... Unknown columns must not silently overwrite data."
            # So if target_entity is provided but not supported for mapping, we raise an error.
            raise IngestionError(f"Unsupported target_entity mapping: {target_entity}")
            
    if mapped_objects:
        db.add_all(mapped_objects)
