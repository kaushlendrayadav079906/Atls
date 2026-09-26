from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from uuid import UUID

from app.schemas.auth import AuthContext
from app.core.exceptions import UnauthenticatedException
from app.core.jwt import decode_access_token
from app.core.database import get_db
from app.repositories.user import user_repository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user_context(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> AuthContext:
    """
    Dependency to retrieve the currently authenticated user's context.
    Decodes the JWT token, verifies user existence and status, 
    and securely returns the AuthContext.
    """
    try:
        # Decode and validate JWT
        payload = decode_access_token(token)
        
        user_id_str = payload.get("sub")
        company_id_str = payload.get("company_id")
        
        if not user_id_str or not company_id_str:
            raise UnauthenticatedException(detail="Token is missing required claims")
            
        user_id = UUID(user_id_str)
        company_id = UUID(company_id_str)
        
        # Verify user in database
        user = user_repository.get_by_id(db, user_id)
        if not user:
            raise UnauthenticatedException(detail="User not found")
            
        # Verify tenant match
        if str(user.company_id) != str(company_id):
            raise UnauthenticatedException(detail="Tenant mismatch")
            
        # Verify user is active
        if user.status == "inactive":
            raise UnauthenticatedException(detail="Inactive user")
            
        return AuthContext(user_id=user.id, company_id=user.company_id)
        
    except ValueError:
        # UUID parsing errors
        raise UnauthenticatedException(detail="Invalid claims format")
