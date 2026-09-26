from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user_context, AuthContext
from app.schemas.factory import FactoryResponse, FactoryFinancialsResponse
from app.services.factory import factory_service

router = APIRouter(prefix="/factories", tags=["Factories"])

@router.get("", response_model=list[FactoryResponse])
def list_factories(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    return factory_service.list_factories(db, company_id=auth.company_id, skip=skip, limit=limit)

@router.get("/{factory_id}", response_model=FactoryResponse)
def get_factory(
    factory_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    return factory_service.get_factory(db, factory_id, company_id=auth.company_id)

@router.get("/{factory_id}/financials", response_model=FactoryFinancialsResponse)
def get_factory_financials(
    factory_id: UUID,
    year: int, month: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    return factory_service.get_factory_financials(db, factory_id, auth.company_id, year, month)
