"""Authentication API endpoints backed by PostgreSQL user storage."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg2 import OperationalError

from app.core.config import settings
from app.core.security import create_access_token, get_current_user
from app.models.schemas import AccessTokenResponse, UserLogin, UserRegister, UserResponse
from app.services import user_service


router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/login", response_model=AccessTokenResponse)
def login(credentials: UserLogin):
    """
    Validate credentials against PostgreSQL user storage and return a JWT.
    Accepts `username` or `email` as identifier.
    Differentiates invalid credentials from deactivated accounts.
    """
    identifier = credentials.get_identifier()
    logger.info(f"Login attempt for user: {identifier}")

    if not identifier:
        logger.warning("Login failed: No username or email provided")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide username or email",
        )

    try:
        user = user_service.authenticate_user(identifier, credentials.password)
    except ValueError as val_err:
        if str(val_err) == "ACCOUNT_DEACTIVATED":
            logger.warning("Login rejected: deactivated account for %s", identifier)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated. Please contact an administrator.",
            )
        raise
    except OperationalError:
        logger.exception("Login unavailable because PostgreSQL could not be reached")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable. Check the PostgreSQL connection.",
        )

    if not user:
        logger.warning(f"Login failed for user: {identifier}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    logger.info(f"User authenticated successfully: {user['username']}")

    token = create_access_token(
        data={
            "sub": user["username"],
            "email": user["email"],
            "role": user.get("role", "user"),
            "user_id": user["id"],
            "branch_id": user.get("branch_id"),
            "store_name": user.get("store_name"),
            "token_version": user.get("token_version", 1),
        }
    )

    logger.info(f"JWT token created for user: {user['username']}")
    return AccessTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user),
    )


@router.post("/register", response_model=AccessTokenResponse)
def register(user_data: UserRegister):
    """
    Register a standard employee account.
    Public registration strictly assigns the unprivileged 'user' role.
    Administrator and elevated roles must be assigned by an authorized administrator.
    """
    logger.info(f"Registration attempt for user: {user_data.username}")

    if user_data.master_password and user_data.master_password != settings.REGISTER_MASTER_PASSWORD:
        logger.warning("Registration failed: invalid master password for user %s", user_data.username)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid master password",
        )

    # Security requirement: public registration cannot create administrator accounts
    assigned_role = "user"
    if user_data.role and user_data.role.lower() != "user":
        logger.warning(
            "Public registration requested elevated role '%s' for user '%s'; enforcing 'user' role.",
            user_data.role,
            user_data.username,
        )

    # Validate and normalize phone number
    try:
        normalized_phone = user_service.normalize_phone_number(user_data.phone)
    except ValueError as ve:
        logger.warning("Registration rejected for '%s': invalid phone format: %s", user_data.username, ve)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )

    # Validate job role / designation
    try:
        validated_job_role = user_service.validate_job_role(user_data.job_role)
    except ValueError as ve:
        logger.warning("Registration rejected for '%s': invalid job role: %s", user_data.username, ve)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )

    user = user_service.create_user(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        name=user_data.name,
        role=assigned_role,
        branch_id=user_data.branch_id,
        store_name=user_data.store_name,
        phone=normalized_phone,
        job_role=validated_job_role,
    )
    if not user:
        logger.warning(f"Registration failed - user already exists: {user_data.username}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this username or email already exists",
        )

    logger.info(f"User registered successfully: {user['username']}")

    token = create_access_token(
        data={
            "sub": user["username"],
            "email": user["email"],
            "role": user.get("role", "user"),
            "user_id": user["id"],
            "branch_id": user.get("branch_id"),
            "store_name": user.get("store_name"),
            "token_version": user.get("token_version", 1),
        }
    )

    return AccessTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user),
    )


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    """Invalidate client-side session and revoke server-side token session."""
    user_id = current_user.get("user_id") or current_user.get("id")
    if user_id:
        user_service.revoke_user_sessions(user_id)
        user_service.log_security_event(
            action="LOGOUT",
            user_id=user_id,
            username=current_user.get("sub"),
        )
    logger.info(f"User logged out and session revoked: {current_user.get('sub')}")
    return {"status": "ok", "message": "Logged out successfully and session invalidated."}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user info and effective permissions."""
    username = current_user.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = user_service.get_user_by_username(username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(**user)
