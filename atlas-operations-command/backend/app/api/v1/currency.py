from typing import List, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user_context
from app.api.rbac import RequireRole
from app.schemas.auth import AuthContext
from app.schemas.currency import (
    ExchangeRateCreate,
    ExchangeRateResponse,
    CurrencyConvertRequest,
    CurrencyConvertResponse,
)
from app.services.currency import CurrencyService
from app.repositories.exchange_rate import exchange_rate_repository

router = APIRouter(prefix="/currency", tags=["currency"])


@router.get("/rates", response_model=List[ExchangeRateResponse], status_code=status.HTTP_200_OK)
def get_exchange_rates(
    from_currency: Optional[str] = Query(None, description="Filter by source currency code"),
    to_currency: Optional[str] = Query(None, description="Filter by target currency code"),
    effective_date: Optional[date] = Query(None, description="Filter by exact effective date"),
    auth: AuthContext = Depends(get_current_user_context),
    db: Session = Depends(get_db)
):
    """
    List exchange rates accessible to the authenticated tenant.
    Includes company-specific rates and global fallback rates.
    """
    rates = exchange_rate_repository.list_accessible_rates(
        db=db,
        company_id=auth.company_id,
        from_currency=from_currency,
        to_currency=to_currency,
        effective_date=effective_date
    )
    return rates


@router.post("/rates", response_model=ExchangeRateResponse, status_code=status.HTTP_201_CREATED)
def create_exchange_rate(
    payload: ExchangeRateCreate,
    auth: AuthContext = Depends(RequireRole("admin")),
    db: Session = Depends(get_db)
):
    """
    Create a new explicit exchange rate scoped to the authenticated tenant.
    Requires 'admin' role. Rejects exact duplicate rates with HTTP 409 Conflict.
    """
    service = CurrencyService(db)
    new_rate = service.create_rate(
        company_id=auth.company_id,
        from_currency=payload.from_currency,
        to_currency=payload.to_currency,
        rate=payload.rate,
        effective_date=payload.effective_date
    )
    return new_rate


@router.post("/convert", response_model=CurrencyConvertResponse, status_code=status.HTTP_200_OK)
def convert_currency(
    payload: CurrencyConvertRequest,
    auth: AuthContext = Depends(get_current_user_context),
    db: Session = Depends(get_db)
):
    """
    Convert a monetary amount using deterministic direct exchange rates.
    Available to all authenticated users ('admin', 'standard_user').
    Missing foreign exchange rate returns HTTP 422 Unprocessable Entity.
    """
    target_date = payload.target_date or date.today()
    service = CurrencyService(db)
    
    converted_amount, applied_rate = service.convert_currency(
        company_id=auth.company_id,
        amount=payload.amount,
        from_currency=payload.from_currency,
        to_currency=payload.to_currency,
        target_date=target_date
    )
    
    return CurrencyConvertResponse(
        original_amount=payload.amount,
        from_currency=payload.from_currency,
        to_currency=payload.to_currency,
        target_date=target_date,
        exchange_rate=applied_rate,
        converted_amount=converted_amount
    )
