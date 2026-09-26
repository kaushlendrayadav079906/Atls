from uuid import UUID
from sqlalchemy.orm import Session
from app.repositories.company import company_repository
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.core.exceptions import NotFoundException

class CompanyService:
    def create_company(self, db: Session, company_in: CompanyCreate):
        return company_repository.create(db, obj_in=company_in)

    def get_company(self, db: Session, company_id: UUID):
        company = company_repository.get_by_id(db, id=company_id)
        if not company:
            raise NotFoundException(detail="Company not found")
        return company

    def list_companies(self, db: Session, skip: int = 0, limit: int = 100):
        return company_repository.list(db, skip=skip, limit=limit)

    def update_company(self, db: Session, company_id: UUID, company_in: CompanyUpdate):
        company = company_repository.get_by_id(db, id=company_id)
        if not company:
            raise NotFoundException(detail="Company not found")
        return company_repository.update(db, db_obj=company, obj_in=company_in)

company_service = CompanyService()
