from uuid import UUID
from sqlalchemy.orm import Session
from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate

class CompanyRepository:
    def create(self, db: Session, obj_in: CompanyCreate) -> Company:
        db_obj = Company(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_id(self, db: Session, id: UUID) -> Company | None:
        return db.query(Company).filter(Company.id == id).first()

    def get_active_by_name(self, db: Session, name: str) -> list[Company]:
        return db.query(Company).filter(Company.name == name, Company.status == "active").all()

    def list(self, db: Session, skip: int = 0, limit: int = 100) -> list[Company]:
        return db.query(Company).offset(skip).limit(limit).all()

    def update(self, db: Session, db_obj: Company, obj_in: CompanyUpdate) -> Company:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

company_repository = CompanyRepository()
