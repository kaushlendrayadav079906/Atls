from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user_context, AuthContext
from app.schemas.business import TopCustomerResponse, SalesByProductResponse, MonthlyRevenueExpenditureResponse
from app.services.business import business_data_service

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/top-customers", response_model=list[TopCustomerResponse])
def get_top_customers(
    limit: int = 5,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    return business_data_service.get_top_customers(db, auth.company_id, limit)

@router.get("/sales-by-product", response_model=list[SalesByProductResponse])
def get_sales_by_product(
    limit: int = 5,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    return business_data_service.get_sales_by_product(db, auth.company_id, limit)

@router.get("/monthly-revenue-expenditure", response_model=MonthlyRevenueExpenditureResponse)
def get_monthly_revenue_expenditure(
    year: int, month: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    return business_data_service.get_monthly_revenue_expenditure(db, auth.company_id, year, month)
