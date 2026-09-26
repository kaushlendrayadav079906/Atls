from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate
from app.services.company import company_service

from app.api.deps import get_current_user_context
from app.api.rbac import RequireRole
from app.schemas.auth import AuthContext
from app.core.exceptions import ForbiddenException

router = APIRouter(prefix="/company", tags=["company"])

@router.post("/settings", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company_settings(company_in: CompanyCreate, db: Session = Depends(get_db)):
    """Create company settings. (Public / Registration Bootstrap)"""
    return company_service.create_company(db, company_in)

@router.get("/settings/{company_id}", response_model=CompanyRead)
def get_company_settings(
    company_id: UUID,
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context)
):
    """Get company settings (Tenant-isolated)."""
    if company_id != context.company_id:
        raise ForbiddenException(detail="Cross-tenant access denied.")
    return company_service.get_company(db, company_id)

@router.put("/settings/{company_id}", response_model=CompanyRead)
def update_company_settings(
    company_id: UUID, 
    company_in: CompanyUpdate, 
    db: Session = Depends(get_db),
    context: AuthContext = Depends(RequireRole("admin"))
):
    """Update company settings (Admin only, tenant-isolated)."""
    if company_id != context.company_id:
        raise ForbiddenException(detail="Cross-tenant modification denied.")
    return company_service.update_company(db, company_id, company_in)
