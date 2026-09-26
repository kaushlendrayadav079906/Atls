from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user_context
from app.schemas.auth import AuthContext
from app.schemas.localization import FiscalYearInfoResponse
from app.repositories.company import company_repository
from app.services.fiscal_year import fiscal_year_service
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/fiscal-year", tags=["fiscal-year"])


@router.get("/current", response_model=FiscalYearInfoResponse)
def get_current_fiscal_year(
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context),
):
    """
    Get current fiscal year, quarter, period, and date ranges for authenticated tenant company.
    Accessible to authenticated admin and standard_user roles.
    """
    company = company_repository.get_by_id(db, id=context.company_id)
    if not company:
        raise NotFoundException(detail="Company not found.")

    today = date.today()
    return fiscal_year_service.calculate_fiscal_info(
        target_date=today,
        start_month=company.fiscal_year_start_month,
        company_id=company.id,
    )


@router.get("/date-info", response_model=FiscalYearInfoResponse)
def get_fiscal_year_for_date(
    target_date: date = Query(..., description="Target date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context),
):
    """
    Get fiscal year, quarter, period, and date ranges for a specific target date.
    Accessible to authenticated admin and standard_user roles.
    """
    company = company_repository.get_by_id(db, id=context.company_id)
    if not company:
        raise NotFoundException(detail="Company not found.")

    return fiscal_year_service.calculate_fiscal_info(
        target_date=target_date,
        start_month=company.fiscal_year_start_month,
        company_id=company.id,
    )
