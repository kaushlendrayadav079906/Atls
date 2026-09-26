from sqlalchemy.orm import Session
from uuid import UUID

from app.models.user_credential import UserCredential

class UserCredentialRepository:
    def get_by_user_id(self, db: Session, user_id: UUID) -> UserCredential | None:
        return db.query(UserCredential).filter(UserCredential.user_id == user_id).first()

    def create_credential(self, db: Session, user_id: UUID, password_hash: str) -> UserCredential:
        cred = UserCredential(user_id=user_id, password_hash=password_hash)
        db.add(cred)
        db.commit()
        db.refresh(cred)
        return cred

    def update_password(self, db: Session, cred: UserCredential, new_password_hash: str) -> UserCredential:
        cred.password_hash = new_password_hash
        db.commit()
        db.refresh(cred)
        return cred

user_credential_repository = UserCredentialRepository()
