"""Finance API endpoints for ATLAS Operations Dashboard."""

import asyncio
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from pydantic import BaseModel
from app.core.security import get_current_user, require_admin
from app.core.config import settings
from app.services.sap.finance_service import SAPFinanceService

router = APIRouter()
_finance_service = SAPFinanceService()


def _get_permitted_branch(user: dict, requested_branch: Optional[str] = None) -> Optional[str]:
    role = str(user.get("role") or "user").lower()
    if role == "admin":
        return requested_branch or None
    if role == "manager":
        manager_branch = user.get("branch_id")
        if not manager_branch:
            raise HTTPException(status_code=403, detail="Manager has no branch assigned.")
        return manager_branch
    user_branch = str(user.get("branch_id") or "").strip()
    return user_branch if user_branch else (requested_branch or None)


@router.get("/overview")
async def get_finance_overview(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve financial overview KPIs, trends, top customers/suppliers, and recent payments."""
    target_branch = _get_permitted_branch(current_user, branch)
    data = await asyncio.to_thread(
        _finance_service.get_finance_overview,
        range_str=range,
        branch_id=target_branch,
        from_date=from_date,
        to_date=to_date,
    )
    return data


class RecordUpdateRequest(BaseModel):
    entity_type: str
    record_id: str
    updates: Dict[str, Any]
    confirm: Optional[bool] = False


@router.get("/record-details")
async def get_record_details(
    entity_type: str = Query(..., description="Entity type: invoice, purchase_invoice, incoming_payment, outgoing_payment, customer, supplier"),
    record_id: str = Query(..., description="DocEntry or CardCode"),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve record details, document status, editable field allowlist, and locked fields with GAAP explanations."""
    user_role = str(current_user.get("role") or "user").lower()
    try:
        data = await asyncio.to_thread(
            _finance_service.get_record_details,
            entity_type=entity_type,
            record_id=record_id,
            user_role=user_role,
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect record: {str(e)}")


@router.post("/validate-update")
async def validate_record_update(
    request: RecordUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Validate proposed updates against field allowlist, data types, and document status without modifying SAP."""
    user_role = str(current_user.get("role") or "user").lower()
    data = await asyncio.to_thread(
        _finance_service.validate_record_update,
        entity_type=request.entity_type,
        record_id=request.record_id,
        updates=request.updates,
        user_role=user_role,
    )
    return data


@router.post("/submit-update")
async def submit_record_update(
    request: RecordUpdateRequest,
    req: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Submit approved changes to SAP Service Layer with explicit confirmation, duplicate protection, and audit logging."""
    # SAFETY LOCK: Hard rejection of all SAP write operations when disabled by administrative policy
    if not getattr(settings, "FINANCE_WRITEBACK_ENABLED", False):
        raise HTTPException(
            status_code=403,
            detail="SAP write-back is temporarily disabled by administrative safety policy. All write operations are rejected."
        )

    user_role = str(current_user.get("role") or "user").lower()
    if user_role not in ("admin", "manager", "accountant"):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Admin, Manager, or Accountant authorization required to submit SAP modifications."
        )

    if not request.confirm:
        raise HTTPException(
            status_code=400,
            detail="Explicit user confirmation required. Set 'confirm: true' to execute SAP write-back."
        )

    client_ip = req.client.host if req.client else None
    try:
        result = await asyncio.to_thread(
            _finance_service.submit_record_update,
            entity_type=request.entity_type,
            record_id=request.record_id,
            updates=request.updates,
            user=current_user,
            ip_address=client_ip,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Write-back error: {str(e)}")


@router.get("/audit-log")
async def get_finance_audit_log(
    entity_type: Optional[str] = Query(None),
    record_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve finance audit log history (available to Admin and Manager roles)."""
    user_role = str(current_user.get("role") or "user").lower()
    if user_role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or Manager role required to view audit trail.")

    from app.services.audit_service import get_audit_entries
    entries = get_audit_entries(
        entity_type=entity_type,
        record_id=record_id,
        limit=limit,
    )
    return {
        "total_entries": len(entries),
        "entries": entries,
    }


@router.get("/admin-settings")
async def get_finance_admin_settings(
    current_user: dict = Depends(require_admin),
) -> Dict[str, Any]:
    """Retrieve finance assistant settings, enabled capabilities, SAP health, and permission matrix (Admin only)."""
    data = await asyncio.to_thread(_finance_service.get_admin_settings)
    return data

