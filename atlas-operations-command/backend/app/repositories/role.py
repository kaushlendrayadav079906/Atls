from uuid import UUID
from sqlalchemy.orm import Session
from app.models.role import Role
from app.schemas.role import RoleCreate, RoleUpdate

class RoleRepository:
    def create(self, db: Session, obj_in: RoleCreate) -> Role:
        db_obj = Role(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_id(self, db: Session, id: UUID) -> Role | None:
        return db.query(Role).filter(Role.id == id).first()

    def get_by_name_within_company(self, db: Session, company_id: UUID, name: str) -> Role | None:
        return db.query(Role).filter(Role.company_id == company_id, Role.name == name).first()

    def list_by_company(self, db: Session, company_id: UUID, skip: int = 0, limit: int = 100) -> list[Role]:
        return db.query(Role).filter(Role.company_id == company_id).offset(skip).limit(limit).all()

    def update(self, db: Session, db_obj: Role, obj_in: RoleUpdate) -> Role:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

role_repository = RoleRepository()
