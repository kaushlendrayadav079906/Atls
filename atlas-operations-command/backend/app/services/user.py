from uuid import UUID
from sqlalchemy.orm import Session
from app.repositories.user import user_repository
from app.repositories.company import company_repository
from app.schemas.user import UserCreate, UserUpdate
from app.core.exceptions import NotFoundException
from fastapi import HTTPException, status

class UserService:
    def create_user(self, db: Session, user_in: UserCreate):
        # Validate company exists
        if not company_repository.get_by_id(db, id=user_in.company_id):
            raise NotFoundException(detail="Company not found")

        # Normalize email
        user_in.email = user_in.email.lower().strip()
        
        # Enforce company-scoped email uniqueness
        existing_user = user_repository.get_by_email_within_company(
            db, company_id=user_in.company_id, email=user_in.email
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered in this company"
            )
            
        return user_repository.create(db, obj_in=user_in)

    def get_user(self, db: Session, user_id: UUID):
        user = user_repository.get_by_id(db, id=user_id)
        if not user:
            raise NotFoundException(detail="User not found")
        return user

    def list_users(self, db: Session, company_id: UUID, skip: int = 0, limit: int = 100):
        if not company_repository.get_by_id(db, id=company_id):
            raise NotFoundException(detail="Company not found")
        return user_repository.list_by_company(db, company_id=company_id, skip=skip, limit=limit)

    def update_user(self, db: Session, user_id: UUID, user_in: UserUpdate):
        user = user_repository.get_by_id(db, id=user_id)
        if not user:
            raise NotFoundException(detail="User not found")
            
        if user_in.email:
            user_in.email = user_in.email.lower().strip()
            existing_user = user_repository.get_by_email_within_company(
                db, company_id=user.company_id, email=user_in.email
            )
            if existing_user and existing_user.id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered in this company"
                )
                
        return user_repository.update(db, db_obj=user, obj_in=user_in)

user_service = UserService()
