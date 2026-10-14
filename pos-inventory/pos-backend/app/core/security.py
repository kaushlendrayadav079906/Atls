"""Security utilities for JWT and password hashing"""

from datetime import datetime, timedelta
import logging
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings


logger = logging.getLogger(__name__)


# Password hashing context - using pbkdf2_sha256 (built-in, no 72-byte limit)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# HTTP Bearer token scheme - auto_error=False to handle missing tokens manually
security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash (pbkdf2_sha256, no 72-byte limit)"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using pbkdf2_sha256"""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """Dependency to get current authenticated user from token"""
    # Check if credentials were provided
    if credentials is None:
        logger.warning("Authentication failed: missing bearer token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token. Please provide Authorization header with Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        user_id: str = payload.get("sub")
        if user_id is None:
            logger.warning("Authentication failed: token missing subject")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            from app.services import user_service
            db_user = user_service.get_user_by_username(user_id)
            if db_user:
                payload["role"] = db_user.get("role", payload.get("role"))
                if db_user.get("branch_id"):
                    payload["branch_id"] = db_user.get("branch_id")
        except Exception:
            pass

        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Authentication failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency that requires the current user to have the 'admin' role."""
    if current_user.get("role") != "admin":
        sub = current_user.get("sub")
        if sub:
            try:
                from app.services import user_service
                db_user = user_service.get_user_by_username(sub)
                if db_user and db_user.get("role") == "admin":
                    current_user["role"] = "admin"
                    return current_user
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


async def require_manager_or_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency that requires the current user to have 'admin' or 'manager' role."""
    if current_user.get("role") not in ("admin", "manager"):
        sub = current_user.get("sub")
        if sub:
            try:
                from app.services import user_service
                db_user = user_service.get_user_by_username(sub)
                if db_user and db_user.get("role") in ("admin", "manager"):
                    current_user["role"] = db_user.get("role")
                    return current_user
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin access required.",
        )
    return current_user

