import pytest
from uuid import uuid4
from decimal import Decimal
from app.models.staging import StagedRecord
from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.models.upload import FileUpload
from app.services.ingestion import _map_to_business_entities, IngestionError
from tests.conftest import setup_auth
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def create_staged_record(db_session, target_entity, raw_data):
    company_id, user_id, headers = setup_auth(db_session, client)
    upload = FileUpload(
        id=uuid4(),
        company_id=company_id,
        uploaded_by_user_id=user_id,
        original_filename="test.csv",
        stored_filename=str(uuid4()),
        file_type="csv",
        content_type="text/csv",
        file_size=100,
        file_hash=str(uuid4())
    )
    db_session.add(upload)
    db_session.commit()
    
    staged = StagedRecord(
        company_id=company_id,
        upload_id=upload.id,
        target_entity=target_entity,
        raw_data=raw_data
    )
    return staged, company_id

def test_map_factory_success(db_session):
    staged, company_id = create_staged_record(db_session, "Factory", {"name": "Test Factory", "code": "TF1", "location": "NYC"})
    
    _map_to_business_entities(db_session, company_id, "Factory", [staged])
    db_session.commit()
    
    fac = db_session.query(Factory).filter_by(company_id=company_id).first()
    assert fac is not None
    assert fac.name == "Test Factory"
    assert fac.code == "TF1"

def test_map_factory_missing_fields(db_session):
    staged, company_id = create_staged_record(db_session, "Factory", {"name": "Test Factory"}) # missing code
    
    with pytest.raises(IngestionError):
        _map_to_business_entities(db_session, company_id, "Factory", [staged])
        
def test_map_financial_transaction_success(db_session):
    staged, company_id = create_staged_record(db_session, "FinancialTransaction", {"amount": "150.50", "type": "revenue", "transaction_date": "2026-09-04"})
    
    _map_to_business_entities(db_session, company_id, "FinancialTransaction", [staged])
    db_session.commit()
    
    tx = db_session.query(FinancialTransaction).filter_by(company_id=company_id).first()
    assert tx is not None
    assert float(tx.amount) == 150.50
    assert tx.transaction_type == "revenue"

def test_map_financial_transaction_invalid_amount(db_session):
    staged, company_id = create_staged_record(db_session, "FinancialTransaction", {"amount": "invalid", "type": "revenue", "transaction_date": "2026-09-04"})
    
    with pytest.raises(IngestionError):
        _map_to_business_entities(db_session, company_id, "FinancialTransaction", [staged])
