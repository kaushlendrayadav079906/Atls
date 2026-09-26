from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user_context
from app.schemas.auth import AuthContext
from app.schemas.tax import TaxCalculationRequest, TaxCalculationResponse
from app.services.tax import TaxService

router = APIRouter(prefix="/tax", tags=["tax"])


@router.post("/calculate", response_model=TaxCalculationResponse, status_code=status.HTTP_200_OK)
def calculate_tax(
    payload: TaxCalculationRequest,
    auth: AuthContext = Depends(get_current_user_context),
    db: Session = Depends(get_db)
):
    """
    Calculates taxes deterministically with exact Decimal arithmetic.
    Accessible to authenticated users ('admin', 'standard_user').
    Uses the authenticated user's company context.
    """
    service = TaxService(db)
    result = service.calculate_tax(
        company_id=auth.company_id,
        amount=payload.amount,
        tax_rate=payload.tax_rate,
        is_tax_inclusive=payload.is_tax_inclusive,
        supplier_state=payload.supplier_state,
        customer_state=payload.customer_state,
        is_gst=payload.is_gst,
        hsn_sac_code=payload.hsn_sac_code
    )
    return result
