from uuid import UUID
from sqlalchemy.orm import Session
from app.models.user_role import UserRole

class UserRoleRepository:
    def assign_role(self, db: Session, user_id: UUID, role_id: UUID) -> UserRole:
        db_obj = UserRole(user_id=user_id, role_id=role_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove_role(self, db: Session, user_id: UUID, role_id: UUID) -> bool:
        db_obj = self.check_assignment(db, user_id, role_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
            return True
        return False

    def list_roles_for_user(self, db: Session, user_id: UUID) -> list[UserRole]:
        return db.query(UserRole).filter(UserRole.user_id == user_id).all()

    def check_assignment(self, db: Session, user_id: UUID, role_id: UUID) -> UserRole | None:
        return db.query(UserRole).filter(UserRole.user_id == user_id, UserRole.role_id == role_id).first()

user_role_repository = UserRoleRepository()
