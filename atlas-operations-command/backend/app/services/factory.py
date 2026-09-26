from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.factory import factory_repository
from app.schemas.factory import FactoryCreate

class FactoryService:
    def create_factory(self, db: Session, obj_in: FactoryCreate, company_id: UUID):
        return factory_repository.create(db=db, obj_in=obj_in, company_id=company_id)

    def get_factory(self, db: Session, factory_id: UUID, company_id: UUID):
        factory = factory_repository.get_by_id(db, id=factory_id, company_id=company_id)
        if not factory:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factory not found")
        return factory

    def list_factories(self, db: Session, company_id: UUID, skip: int = 0, limit: int = 100):
        return factory_repository.list(db=db, company_id=company_id, skip=skip, limit=limit)

    def get_factory_financials(self, db: Session, factory_id: UUID, company_id: UUID, year: int, month: int):
        factory = self.get_factory(db, factory_id, company_id)
        financials = factory_repository.get_financials(db, factory_id, company_id, year, month)
        return {
            "factory_id": factory.id,
            "factory_name": factory.name,
            "month": month,
            "year": year,
            **financials
        }

factory_service = FactoryService()
