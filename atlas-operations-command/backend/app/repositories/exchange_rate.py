from typing import Optional, List
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from app.models.exchange_rate import ExchangeRate


class ExchangeRateRepository:
    def get_company_rate(
        self,
        db: Session,
        company_id: UUID,
        from_currency: str,
        to_currency: str,
        target_date: date
    ) -> Optional[ExchangeRate]:
        """
        Lookup the latest effective exchange rate explicitly scoped to the given company.
        Precedence filter: effective_date <= target_date ORDER BY effective_date DESC LIMIT 1.
        """
        return db.query(ExchangeRate).filter(
            ExchangeRate.company_id == company_id,
            ExchangeRate.from_currency == from_currency.upper(),
            ExchangeRate.to_currency == to_currency.upper(),
            ExchangeRate.effective_date <= target_date
        ).order_by(desc(ExchangeRate.effective_date)).first()

    def get_global_rate(
        self,
        db: Session,
        from_currency: str,
        to_currency: str,
        target_date: date
    ) -> Optional[ExchangeRate]:
        """
        Lookup the latest global fallback exchange rate (company_id IS NULL).
        Precedence filter: effective_date <= target_date ORDER BY effective_date DESC LIMIT 1.
        """
        return db.query(ExchangeRate).filter(
            ExchangeRate.company_id.is_(None),
            ExchangeRate.from_currency == from_currency.upper(),
            ExchangeRate.to_currency == to_currency.upper(),
            ExchangeRate.effective_date <= target_date
        ).order_by(desc(ExchangeRate.effective_date)).first()

    def find_exact_duplicate(
        self,
        db: Session,
        company_id: Optional[UUID],
        from_currency: str,
        to_currency: str,
        effective_date: date
    ) -> Optional[ExchangeRate]:
        """
        Checks if an exact exchange rate record already exists for the company/global scope,
        currency pair, and effective date.
        """
        query = db.query(ExchangeRate).filter(
            ExchangeRate.from_currency == from_currency.upper(),
            ExchangeRate.to_currency == to_currency.upper(),
            ExchangeRate.effective_date == effective_date
        )
        if company_id is None:
            query = query.filter(ExchangeRate.company_id.is_(None))
        else:
            query = query.filter(ExchangeRate.company_id == company_id)
        return query.first()

    def list_accessible_rates(
        self,
        db: Session,
        company_id: UUID,
        from_currency: Optional[str] = None,
        to_currency: Optional[str] = None,
        effective_date: Optional[date] = None
    ) -> List[ExchangeRate]:
        """
        List all exchange rates accessible to the company (company-specific rates plus global rates).
        """
        query = db.query(ExchangeRate).filter(
            or_(
                ExchangeRate.company_id == company_id,
                ExchangeRate.company_id.is_(None)
            )
        )
        if from_currency:
            query = query.filter(ExchangeRate.from_currency == from_currency.upper())
        if to_currency:
            query = query.filter(ExchangeRate.to_currency == to_currency.upper())
        if effective_date:
            query = query.filter(ExchangeRate.effective_date == effective_date)

        return query.order_by(
            ExchangeRate.from_currency,
            ExchangeRate.to_currency,
            desc(ExchangeRate.effective_date)
        ).all()

    def create(
        self,
        db: Session,
        company_id: Optional[UUID],
        from_currency: str,
        to_currency: str,
        rate: Decimal,
        effective_date: date
    ) -> ExchangeRate:
        """
        Persists a new ExchangeRate.
        """
        rate_obj = ExchangeRate(
            company_id=company_id,
            from_currency=from_currency.upper(),
            to_currency=to_currency.upper(),
            rate=rate,
            effective_date=effective_date
        )
        db.add(rate_obj)
        db.flush()
        return rate_obj


exchange_rate_repository = ExchangeRateRepository()
