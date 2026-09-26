import pytest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from tests.conftest import setup_auth
from app.models.company import Company
from app.models.financial_transaction import FinancialTransaction
from app.models.staging import StagedRecord
from app.models.upload import FileUpload
from app.services.ingestion import _map_to_business_entities, IngestionError
from app.services.currency import CurrencyService


def create_staged_tx(db_session, client, raw_data):
    company_id, user_id, headers = setup_auth(db_session, client)
    company = db_session.query(Company).filter(Company.id == company_id).first()
    company.currency_code = "USD"
    db_session.commit()

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
        target_entity="FinancialTransaction",
        raw_data=raw_data
    )
    return staged, company_id


def test_ingestion_with_currency_conversion(db_session, client):
    # Setup company with USD base currency
    staged_usd, company_id = create_staged_tx(
        db_session, client,
        {"amount": "100.00", "type": "revenue", "transaction_date": "2026-09-02", "currency_code": "USD"}
    )
    
    # Add rate for EUR -> USD
    currency_svc = CurrencyService(db_session)
    currency_svc.create_rate(
        company_id=company_id,
        from_currency="EUR",
        to_currency="USD",
        rate=Decimal("1.100000"),
        effective_date=date(2026, 9, 1)
    )

    staged_eur = StagedRecord(
        company_id=company_id,
        upload_id=staged_usd.upload_id,
        target_entity="FinancialTransaction",
        raw_data={"amount": "200.00", "type": "revenue", "transaction_date": "2026-09-02", "currency_code": "EUR"}
    )

    # Map staged entities
    _map_to_business_entities(db_session, company_id, "FinancialTransaction", [staged_usd, staged_eur])
    db_session.commit()

    # Verify transactions in DB
    txs = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == company_id).all()
    assert len(txs) == 2

    tx_usd = next(t for t in txs if t.currency_code == "USD")
    assert tx_usd.amount == Decimal("100.00")
    assert tx_usd.amount_base == Decimal("100.00")
    assert tx_usd.exchange_rate == Decimal("1.000000")

    tx_eur = next(t for t in txs if t.currency_code == "EUR")
    assert tx_eur.amount == Decimal("200.00")
    assert tx_eur.amount_base == Decimal("220.00") # 200 * 1.10
    assert tx_eur.exchange_rate == Decimal("1.100000")


def test_ingestion_foreign_currency_missing_rate_rollback(db_session, client):
    # Foreign currency (NZD) with NO configured rate
    staged, company_id = create_staged_tx(
        db_session, client,
        {"amount": "500.00", "type": "revenue", "transaction_date": "2026-09-02", "currency_code": "NZD"}
    )

    # Ingestion mapping MUST raise IngestionError due to missing exchange rate
    with pytest.raises(IngestionError) as exc_info:
        _map_to_business_entities(db_session, company_id, "FinancialTransaction", [staged])

    assert "Currency conversion failed" in str(exc_info.value)
    assert "No exchange rate found for NZD->USD" in str(exc_info.value)

    # Ensure no partial financial transactions were saved
    tx_count = db_session.query(FinancialTransaction).filter(FinancialTransaction.company_id == company_id).count()
    assert tx_count == 0
