from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user_context
from app.schemas.auth import AuthContext
from app.schemas.localization import LocalizationConfigResponse
from app.services.localization import localization_service

router = APIRouter(prefix="/localization", tags=["localization"])


@router.get("/config", response_model=LocalizationConfigResponse)
def get_localization_config(
    db: Session = Depends(get_db),
    context: AuthContext = Depends(get_current_user_context),
):
    """
    Get company localization configuration and formatting metadata (Tenant-isolated).
    Accessible to authenticated admin and standard_user roles.
    """
    return localization_service.get_localization_config(db, company_id=context.company_id)
