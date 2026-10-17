"""Security utilities for JWT, password hashing, and role/permission enforcement."""

from datetime import datetime, timedelta
import logging
from typing import Optional, Dict, Any, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings


logger = logging.getLogger(__name__)


# Password hashing context - using pbkdf2_sha256 (built-in, resistant to GPU attacks, no 72-byte limit)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# HTTP Bearer token scheme - auto_error=False to handle missing tokens manually
security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash (pbkdf2_sha256, no 72-byte limit)."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using pbkdf2_sha256."""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with token version and expiration."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and verify a JWT token."""
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
    """
    Dependency to validate bearer token, load trusted backend user state,
    enforce account activation status, and verify session revocation (token_version).
    """
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

        username: str = payload.get("sub")
        if not username:
            logger.warning("Authentication failed: token missing subject")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        from app.services import user_service

        db_user = user_service.get_user_by_username(username)
        if not db_user:
            logger.warning("Authentication failed: user '%s' no longer exists", username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account no longer exists.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 1. Enforce active account status
        if not db_user.get("is_active", True):
            logger.warning("Authentication rejected: user '%s' account is deactivated", username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your account has been deactivated. Please contact an administrator.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 2. Enforce session revocation via token_version check
        token_version = payload.get("token_version")
        db_token_version = db_user.get("token_version", 1)
        if token_version is not None and token_version != db_token_version:
            logger.warning(
                "Authentication rejected: user '%s' session revoked (token v%s != db v%s)",
                username,
                token_version,
                db_token_version,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been revoked or expired. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Attach live backend values to payload
        payload["id"] = db_user.get("id")
        payload["user_id"] = db_user.get("id")
        payload["role"] = db_user.get("role", payload.get("role", "user"))
        payload["branch_id"] = db_user.get("branch_id")
        payload["store_name"] = db_user.get("store_name")
        payload["sap_user_code"] = db_user.get("sap_user_code")
        payload["permissions"] = db_user.get("permissions", [])
        payload["is_active"] = db_user.get("is_active", True)
        payload["token_version"] = db_token_version

        return payload

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_permission(permission: str):
    """
    FastAPI dependency factory enforcing a specific module/action permission.
    - Administrators (role='admin') are always granted access.
    - Other roles must possess the required permission in their calculated effective permissions.
    - Returns 403 Forbidden with a clear message if unauthorized.
    """
    async def permission_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        role = str(current_user.get("role") or "").strip().lower()
        if role in ("admin", "administrator"):
            return current_user

        perms = set(current_user.get("permissions") or [])
        if "*" in perms or permission in perms:
            return current_user

        username = current_user.get("sub", "unknown")
        logger.warning(
            "Access denied: User '%s' with role '%s' lacks required permission '%s'",
            username,
            role,
            permission,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You lack the required permission '{permission}'.",
        )

    return permission_checker


async def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency that requires the current user to have the 'admin' role."""
    role = str(current_user.get("role") or "").strip().lower()
    if role not in ("admin", "administrator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )
    return current_user


async def require_manager_or_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency that requires the current user to have 'admin' or 'manager' role."""
    role = str(current_user.get("role") or "").strip().lower()
    if role not in ("admin", "administrator", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Administrator access required.",
        )
    return current_user
