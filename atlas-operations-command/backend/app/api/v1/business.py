from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user_context, AuthContext
from app.schemas.business import SapBusinessDataResponse, OrganicBusinessDataResponse
from app.services.business import business_data_service

router = APIRouter(prefix="/business-data", tags=["Business Data"])

@router.get("/sap", response_model=SapBusinessDataResponse)
def get_sap_business_data():
    # Explicit unavailable state
    return SapBusinessDataResponse()

@router.get("/organic", response_model=OrganicBusinessDataResponse)
def get_organic_business_data(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    return business_data_service.get_organic_business_data(db, auth.company_id)
