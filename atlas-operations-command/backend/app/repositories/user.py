from uuid import UUID
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

class UserRepository:
    def create(self, db: Session, obj_in: UserCreate) -> User:
        db_obj = User(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_id(self, db: Session, id: UUID) -> User | None:
        return db.query(User).filter(User.id == id).first()
        
    def get_by_email_within_company(self, db: Session, company_id: UUID, email: str) -> User | None:
        return db.query(User).filter(User.company_id == company_id, User.email == email).first()

    def list_by_company(self, db: Session, company_id: UUID, skip: int = 0, limit: int = 100) -> list[User]:
        return db.query(User).filter(User.company_id == company_id).offset(skip).limit(limit).all()

    def update(self, db: Session, db_obj: User, obj_in: UserUpdate) -> User:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

user_repository = UserRepository()
