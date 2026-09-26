from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.user import user_service

router = APIRouter(tags=["users"])

from app.api.deps import get_current_user_context
from app.api.rbac import RequireRole
from app.schemas.auth import AuthContext
from app.core.exceptions import ForbiddenException, NotFoundException

@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(RequireRole("admin"))
):
    """Create user (Admin only, tenant-isolated)."""
    # Force tenant isolation, ignoring any client-supplied company_id
    user_in.company_id = context.company_id
    return user_service.create_user(db, user_in)

@router.get("/users/{user_id}", response_model=UserRead)
def get_user(
    user_id: UUID, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context)
):
    """Get user by ID (tenant-isolated)."""
    user = user_service.get_user(db, user_id)
    if user.company_id != context.company_id:
        # Don't leak existence of cross-tenant user
        raise NotFoundException(detail="User not found")
    return user

@router.get("/companies/{company_id}/users", response_model=list[UserRead])
def list_users(
    company_id: UUID, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context)
):
    """List users by company (tenant-isolated)."""
    if company_id != context.company_id:
        raise ForbiddenException(detail="Cross-tenant access denied")
    return user_service.list_users(db, company_id, skip=skip, limit=limit)

@router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: UUID, 
    user_in: UserUpdate, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(RequireRole("admin"))
):
    """Update user (Admin only, tenant-isolated)."""
    user = user_service.get_user(db, user_id)
    if user.company_id != context.company_id:
        raise NotFoundException(detail="User not found")
    return user_service.update_user(db, user_id, user_in)
