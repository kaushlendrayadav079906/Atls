from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.role import RoleCreate, RoleRead, RoleUpdate, UserRoleRead
from app.services.role import role_service
from app.services.user_role import user_role_service

from app.api.deps import get_current_user_context
from app.api.rbac import RequireRole
from app.schemas.auth import AuthContext
from app.core.exceptions import ForbiddenException, NotFoundException
from app.services.user import user_service

router = APIRouter(tags=["roles"])

@router.post("/roles", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
def create_role(
    role_in: RoleCreate, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(RequireRole("admin"))
):
    """Create role (Admin only, tenant-isolated)"""
    role_in.company_id = context.company_id
    return role_service.create_role(db, role_in)

@router.get("/roles/{role_id}", response_model=RoleRead)
def get_role(
    role_id: UUID, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context)
):
    """Get role (tenant-isolated)"""
    role = role_service.get_role(db, role_id)
    if role.company_id != context.company_id:
        raise NotFoundException(detail="Role not found")
    return role

@router.put("/roles/{role_id}", response_model=RoleRead)
def update_role(
    role_id: UUID, 
    role_in: RoleUpdate, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(RequireRole("admin"))
):
    """Update role (Admin only, tenant-isolated)"""
    role = role_service.get_role(db, role_id)
    if role.company_id != context.company_id:
        raise NotFoundException(detail="Role not found")
    return role_service.update_role(db, role_id, role_in)

@router.get("/companies/{company_id}/roles", response_model=list[RoleRead])
def list_company_roles(
    company_id: UUID, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context)
):
    """List roles (tenant-isolated)"""
    if company_id != context.company_id:
        raise ForbiddenException(detail="Cross-tenant access denied")
    return role_service.list_roles_by_company(db, company_id, skip, limit)

@router.post("/users/{user_id}/roles/{role_id}", response_model=UserRoleRead, status_code=status.HTTP_201_CREATED)
def assign_role_to_user(
    user_id: UUID, 
    role_id: UUID, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(RequireRole("admin"))
):
    """Assign role (Admin only, tenant-isolated)"""
    user = user_service.get_user(db, user_id)
    if user.company_id != context.company_id:
        raise NotFoundException(detail="User not found")
    
    role = role_service.get_role(db, role_id)
    if role.company_id != context.company_id:
        raise NotFoundException(detail="Role not found")

    return user_role_service.assign_role(db, user_id, role_id)

@router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_role_from_user(
    user_id: UUID, 
    role_id: UUID, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(RequireRole("admin"))
):
    """Remove role (Admin only, tenant-isolated)"""
    user = user_service.get_user(db, user_id)
    if user.company_id != context.company_id:
        raise NotFoundException(detail="User not found")
    
    role = role_service.get_role(db, role_id)
    if role.company_id != context.company_id:
        raise NotFoundException(detail="Role not found")

    user_role_service.remove_role(db, user_id, role_id)
    return None

@router.get("/users/{user_id}/roles", response_model=list[UserRoleRead])
def list_user_roles(
    user_id: UUID, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context)
):
    """List user roles (tenant-isolated)"""
    user = user_service.get_user(db, user_id)
    if user.company_id != context.company_id:
        raise NotFoundException(detail="User not found")
    return user_role_service.list_roles_for_user(db, user_id)
