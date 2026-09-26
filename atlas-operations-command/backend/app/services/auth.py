import logging
from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.core.exceptions import UnauthenticatedException
from app.repositories.company import company_repository
from app.repositories.user import user_repository
from app.repositories.role import role_repository
from app.services.user_credential import UserCredentialService
from app.core.jwt import create_access_token
from app.core.security import hash_password
from app.models.company import Company
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole
from app.models.user_credential import UserCredential
from app.schemas.auth import RegisterRequest, RegisterResponse

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_credential_service = UserCredentialService(db)

    def register_company_and_admin(self, request: RegisterRequest) -> RegisterResponse:
        """
        Atomically registers a new Company and its first Administrator User with the 'admin' role.
        
        Transaction encapsulates:
        1. Company creation (server-generated UUID)
        2. First User creation (linked to Company)
        3. 'admin' Role creation (linked to Company)
        4. UserRole association
        5. UserCredential creation (Argon2id hashed password)
        
        If any step fails, the entire transaction is rolled back.
        """
        company_id = uuid4()
        user_id = uuid4()
        role_id = uuid4()
        
        try:
            # 1. Create Company
            company = Company(
                id=company_id,
                name=request.company_name,
                country_code=request.country_code,
                currency_code=request.currency_code,
                timezone=request.timezone,
                locale=request.locale or "en-US",
                region=request.region or "Global",
                fiscal_year_start_month=request.fiscal_year_start_month or 1,
                status="active"
            )
            self.db.add(company)
            self.db.flush()

            # 2. Create User linked to Company
            user = User(
                id=user_id,
                company_id=company.id,
                email=request.email,
                full_name=request.full_name,
                status="active"
            )
            self.db.add(user)
            self.db.flush()

            # 3. Create or resolve company-scoped 'admin' Role
            admin_role = role_repository.get_by_name_within_company(self.db, company.id, "admin")
            if not admin_role:
                admin_role = Role(
                    id=role_id,
                    company_id=company.id,
                    name="admin",
                    description="Company Administrator"
                )
                self.db.add(admin_role)
                self.db.flush()

            # 4. Create UserRole association
            user_role = UserRole(
                user_id=user.id,
                role_id=admin_role.id
            )
            self.db.add(user_role)
            self.db.flush()

            # 5. Create UserCredential using existing Argon2id security
            pwd_hash = hash_password(request.password)
            credential = UserCredential(
                id=uuid4(),
                user_id=user.id,
                password_hash=pwd_hash
            )
            self.db.add(credential)
            self.db.flush()

            # Commit the atomic transaction
            self.db.commit()

            return RegisterResponse(
                message="Company and administrator registered successfully",
                company_id=company.id,
                company_name=company.name,
                email=user.email,
                full_name=user.full_name
            )

        except IntegrityError as ie:
            self.db.rollback()
            logger.warning(f"Registration integrity conflict during registration: {type(ie).__name__}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Registration conflict: A conflicting record already exists."
            )
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Unexpected error during registration transaction: {type(e).__name__}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Registration failed due to an internal server error."
            )

    def authenticate_user(self, company_name: str, email: str, password: str) -> str:
        """
        Authenticates a user based on company_name, email, and password.
        Resolves company_name to a single active Company.
        Returns the JWT access token upon successful authentication.
        """
        # Generic error to prevent company/user enumeration
        auth_error = UnauthenticatedException(detail="Incorrect email, password, or company")

        if not company_name or not email or not password:
            raise auth_error

        # 1. Normalize company_name and email
        norm_company_name = company_name.strip()
        norm_email = email.strip().lower()

        if not norm_company_name or not norm_email:
            raise auth_error

        # 2. Find ACTIVE companies matching the normalized company name
        matching_companies = company_repository.get_active_by_name(self.db, norm_company_name)

        # Zero matches or duplicate active matches fail safely with generic 401
        if len(matching_companies) != 1:
            raise auth_error

        company = matching_companies[0]

        # 3. Look up user strictly inside that company context
        user = user_repository.get_by_email_within_company(self.db, company.id, norm_email)
        if not user:
            raise auth_error

        # 4. Check active status
        if user.status == "inactive":
            raise auth_error

        # 5. Verify credentials (Argon2id)
        is_valid = self.user_credential_service.verify_credential(company.id, user.id, password)
        if not is_valid:
            raise auth_error

        # 6. Generate JWT access token containing internal authoritative company_id
        access_token = create_access_token(user_id=user.id, company_id=user.company_id)
        return access_token

