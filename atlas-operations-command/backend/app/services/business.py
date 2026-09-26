from uuid import UUID
from sqlalchemy.orm import Session
from app.repositories.business import business_data_repository

class BusinessDataService:
    def get_top_customers(self, db: Session, company_id: UUID, limit: int = 5):
        return business_data_repository.get_top_customers(db, company_id, limit)

    def get_sales_by_product(self, db: Session, company_id: UUID, limit: int = 5):
        return business_data_repository.get_sales_by_product(db, company_id, limit)

    def get_monthly_revenue_expenditure(self, db: Session, company_id: UUID, target_year: int, target_month: int):
        return business_data_repository.get_monthly_revenue_expenditure(db, company_id, target_year, target_month)

    def get_organic_business_data(self, db: Session, company_id: UUID):
        return business_data_repository.get_organic_business_data(db, company_id)

business_data_service = BusinessDataService()
