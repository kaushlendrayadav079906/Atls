import logging
from typing import Optional, Tuple, List
from uuid import UUID
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session

from app.models.exchange_rate import ExchangeRate
from app.models.company import Company
from app.repositories.exchange_rate import exchange_rate_repository, ExchangeRateRepository
from app.core.exceptions import CurrencyRateNotFoundError, DuplicateExchangeRateError

logger = logging.getLogger(__name__)

SAME_CURRENCY_RATE = Decimal("1.000000")
MONEY_QUANTIZE = Decimal("0.01")


class CurrencyService:
    def __init__(self, db: Session, repo: Optional[ExchangeRateRepository] = None):
        self.db = db
        self.repo = repo or exchange_rate_repository

    def get_exchange_rate(
        self,
        company_id: UUID,
        from_currency: str,
        to_currency: str,
        target_date: Optional[date] = None
    ) -> Decimal:
        """
        Resolves the deterministic direct exchange rate for a currency pair using Scope-First Precedence:
        1. Same currency identity returns 1.000000 without database lookup.
        2. Direct pair only: from_currency -> to_currency. (No automatic inversion).
        3. Search company-specific rates first (effective_date <= target_date ORDER BY effective_date DESC LIMIT 1).
        4. If no company-specific rate exists, search global fallback rates (company_id IS NULL).
        5. If neither exists on or before target_date, raises CurrencyRateNotFoundError (HTTP 422).
        """
        from_curr = from_currency.strip().upper()
        to_curr = to_currency.strip().upper()

        # Rule 1: Same currency identity
        if from_curr == to_curr:
            return SAME_CURRENCY_RATE

        t_date = target_date or date.today()

        # Rule 2 & 3: Direct pair lookup in Company Scope First
        company_rate = self.repo.get_company_rate(
            self.db,
            company_id=company_id,
            from_currency=from_curr,
            to_currency=to_curr,
            target_date=t_date
        )
        if company_rate is not None:
            return Decimal(str(company_rate.rate))

        # Rule 4: Global Fallback Rate Lookup (only if no company-specific rate exists)
        global_rate = self.repo.get_global_rate(
            self.db,
            from_currency=from_curr,
            to_currency=to_curr,
            target_date=t_date
        )
        if global_rate is not None:
            return Decimal(str(global_rate.rate))

        # Rule 5: Missing direct rate failure
        raise CurrencyRateNotFoundError(
            detail=f"No exchange rate found for {from_curr}->{to_curr} effective on or before {t_date}"
        )

    def convert_currency(
        self,
        company_id: UUID,
        amount: Decimal,
        from_currency: str,
        to_currency: str,
        target_date: Optional[date] = None
    ) -> Tuple[Decimal, Decimal]:
        """
        Converts a monetary amount using the resolved direct rate.
        Calculations use exact Decimal arithmetic with ROUND_HALF_UP to 0.01.
        Returns: (converted_amount, exchange_rate)
        """
        rate = self.get_exchange_rate(
            company_id=company_id,
            from_currency=from_currency,
            to_currency=to_currency,
            target_date=target_date
        )
        raw_converted = Decimal(str(amount)) * rate
        converted_amount = raw_converted.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
        return converted_amount, rate

    def convert_to_company_base(
        self,
        company_id: UUID,
        amount: Decimal,
        transaction_currency: str,
        transaction_date: date
    ) -> Tuple[Decimal, Decimal]:
        """
        Converts a transaction amount in its native currency to the company's base reporting currency.
        Returns: (amount_base, exchange_rate)
        """
        company = self.db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise ValueError(f"Company {company_id} not found")

        base_currency = company.currency_code
        return self.convert_currency(
            company_id=company_id,
            amount=amount,
            from_currency=transaction_currency,
            to_currency=base_currency,
            target_date=transaction_date
        )

    def create_rate(
        self,
        company_id: UUID,
        from_currency: str,
        to_currency: str,
        rate: Decimal,
        effective_date: date
    ) -> ExchangeRate:
        """
        Creates an explicit company-scoped exchange rate.
        Duplicate (company_id, from_currency, to_currency, effective_date) raises DuplicateExchangeRateError (HTTP 409).
        """
        from_curr = from_currency.strip().upper()
        to_curr = to_currency.strip().upper()

        if from_curr == to_curr:
            raise ValueError("from_currency and to_currency must be different for explicit exchange rate creation")

        # Check for duplicate
        existing = self.repo.find_exact_duplicate(
            self.db,
            company_id=company_id,
            from_currency=from_curr,
            to_currency=to_curr,
            effective_date=effective_date
        )
        if existing:
            raise DuplicateExchangeRateError(
                detail=f"Exchange rate for {from_curr}->{to_curr} effective {effective_date} already exists for this company."
            )

        new_rate = self.repo.create(
            self.db,
            company_id=company_id,
            from_currency=from_curr,
            to_currency=to_curr,
            rate=rate,
            effective_date=effective_date
        )
        self.db.commit()
        self.db.refresh(new_rate)
        return new_rate
