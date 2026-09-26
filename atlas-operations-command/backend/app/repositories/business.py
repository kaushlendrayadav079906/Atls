from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.financial_transaction import FinancialTransaction
from app.models.customer import Customer
from app.models.product import Product
from app.models.factory import Factory
from app.models.company import Company
from decimal import Decimal

class BusinessDataRepository:
    def get_top_customers(self, db: Session, company_id: UUID, limit: int = 5):
        results = db.query(
            Customer.id.label("customer_id"),
            Customer.name.label("customer_name"),
            func.sum(FinancialTransaction.amount).label("total_revenue")
        ).join(
            FinancialTransaction, FinancialTransaction.customer_id == Customer.id
        ).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "revenue"
        ).group_by(
            Customer.id
        ).order_by(
            func.sum(FinancialTransaction.amount).desc()
        ).limit(limit).all()
        
        return [{"customer_id": r.customer_id, "customer_name": r.customer_name, "total_revenue": r.total_revenue} for r in results]

    def get_sales_by_product(self, db: Session, company_id: UUID, limit: int = 5):
        results = db.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            func.sum(FinancialTransaction.amount).label("total_sales")
        ).join(
            FinancialTransaction, FinancialTransaction.product_id == Product.id
        ).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "revenue"
        ).group_by(
            Product.id
        ).order_by(
            func.sum(FinancialTransaction.amount).desc()
        ).limit(limit).all()

        return [{"product_id": r.product_id, "product_name": r.product_name, "total_sales": r.total_sales} for r in results]

    def get_monthly_revenue_expenditure(self, db: Session, company_id: UUID, target_year: int, target_month: int):
        revenue = db.query(func.sum(FinancialTransaction.amount)).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "revenue",
            func.year(FinancialTransaction.transaction_date) == target_year,
            func.month(FinancialTransaction.transaction_date) == target_month
        ).scalar() or Decimal('0.0')

        expenditure = db.query(func.sum(FinancialTransaction.amount)).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "expenditure",
            func.year(FinancialTransaction.transaction_date) == target_year,
            func.month(FinancialTransaction.transaction_date) == target_month
        ).scalar() or Decimal('0.0')

        return {
            "month": target_month,
            "year": target_year,
            "revenue": revenue,
            "expenditure": expenditure,
            "profit": revenue - expenditure
        }

    def get_organic_business_data(self, db: Session, company_id: UUID):
        revenue = db.query(func.sum(FinancialTransaction.amount)).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "revenue"
        ).scalar() or Decimal('0.0')

        expenditure = db.query(func.sum(FinancialTransaction.amount)).filter(
            FinancialTransaction.company_id == company_id,
            FinancialTransaction.transaction_type == "expenditure"
        ).scalar() or Decimal('0.0')

        active_factories = db.query(func.count(Factory.id)).filter(
            Factory.company_id == company_id,
            Factory.status == "active"
        ).scalar() or 0

        return {
            "total_revenue": revenue,
            "total_expenditure": expenditure,
            "net_profit": revenue - expenditure,
            "active_factories": active_factories
        }

business_data_repository = BusinessDataRepository()
