from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.schemas.factory import FactoryCreate

class FactoryRepository:
    def create(self, db: Session, obj_in: FactoryCreate, company_id: UUID) -> Factory:
        db_obj = Factory(**obj_in.model_dump(), company_id=company_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_id(self, db: Session, id: UUID, company_id: UUID) -> Factory | None:
        return db.query(Factory).filter(Factory.id == id, Factory.company_id == company_id).first()

    def list(self, db: Session, company_id: UUID, skip: int = 0, limit: int = 100) -> list[Factory]:
        return db.query(Factory).filter(Factory.company_id == company_id).offset(skip).limit(limit).all()

    def get_financials(self, db: Session, factory_id: UUID, company_id: UUID, year: int, month: int):
        revenue = db.query(func.sum(FinancialTransaction.amount)).filter(
            FinancialTransaction.factory_id == factory_id,
            FinancialTransaction.company_id == company_id,
            func.year(FinancialTransaction.transaction_date) == year,
            func.month(FinancialTransaction.transaction_date) == month,
            FinancialTransaction.transaction_type == "revenue"
        ).scalar() or 0

        expenditure = db.query(func.sum(FinancialTransaction.amount)).filter(
            FinancialTransaction.factory_id == factory_id,
            FinancialTransaction.company_id == company_id,
            func.year(FinancialTransaction.transaction_date) == year,
            func.month(FinancialTransaction.transaction_date) == month,
            FinancialTransaction.transaction_type == "expenditure"
        ).scalar() or 0

        return {
            "revenue": revenue,
            "expenditure": expenditure,
            "profit": revenue - expenditure
        }

factory_repository = FactoryRepository()
