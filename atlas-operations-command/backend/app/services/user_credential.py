from sqlalchemy.orm import Session
from uuid import UUID
from fastapi import HTTPException

from app.repositories.user import user_repository
from app.repositories.user_credential import user_credential_repository
from app.core.security import hash_password, verify_password
from app.schemas.user_credential import CredentialCreate

class UserCredentialService:
    def __init__(self, db: Session):
        self.db = db

    def set_credential(self, company_id: UUID, user_id: UUID, raw_password: str):
        # 1. Validate password policy (using Pydantic)
        # This will raise ValidationError if empty or < 8 chars
        CredentialCreate(password=raw_password)

        # 2. Retrieve the user
        user = user_repository.get_by_id(self.db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # 3. Verify tenant isolation
        if str(user.company_id) != str(company_id):
            raise HTTPException(status_code=403, detail="Tenant isolation error")

        # 4. Check for duplicate credentials
        existing_cred = user_credential_repository.get_by_user_id(self.db, user_id)
        if existing_cred:
            raise HTTPException(status_code=409, detail="Credential already exists")

        # 5. Hash and persist
        pwd_hash = hash_password(raw_password)
        return user_credential_repository.create_credential(self.db, user_id, pwd_hash)

    def verify_credential(self, company_id: UUID, user_id: UUID, raw_password: str) -> bool:
        # 1. Retrieve the user
        user = user_repository.get_by_id(self.db, user_id)
        if not user:
            return False

        # 2. Verify tenant isolation
        if str(user.company_id) != str(company_id):
            return False

        # 3. Check user status
        if user.status == "inactive":
            return False

        # 4. Retrieve credential
        cred = user_credential_repository.get_by_user_id(self.db, user_id)
        if not cred:
            return False

        # 5. Verify the password
        return verify_password(raw_password, cred.password_hash)

    def update_credential(self, company_id: UUID, user_id: UUID, raw_password: str):
        CredentialCreate(password=raw_password)

        user = user_repository.get_by_id(self.db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if str(user.company_id) != str(company_id):
            raise HTTPException(status_code=403, detail="Tenant isolation error")

        cred = user_credential_repository.get_by_user_id(self.db, user_id)
        if not cred:
            raise HTTPException(status_code=404, detail="Credential not found")

        pwd_hash = hash_password(raw_password)
        return user_credential_repository.update_password(self.db, cred, pwd_hash)
