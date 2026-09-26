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
    """Register a new user in PostgreSQL using the configured master password."""
    logger.info(f"Registration attempt for user: {user_data.username}")

    if user_data.master_password != settings.REGISTER_MASTER_PASSWORD:
        logger.warning("Registration failed: invalid master password for user %s", user_data.username)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid master password",
        )

    user = user_service.create_user(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        name=user_data.name,
        role=user_data.role,
        branch_id=user_data.branch_id,
        store_name=user_data.store_name,
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
        }
    )

    return AccessTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user),
    )


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    """Invalidate client-side session."""
    logger.info(f"User logged out: {current_user.get('sub')}")
    return {"status": "ok"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user info decoded from JWT."""
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
