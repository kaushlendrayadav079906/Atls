"""Finance API endpoints for ATLAS Operations Dashboard."""

import asyncio
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from pydantic import BaseModel
from app.core.security import get_current_user, require_admin, require_permission
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
    range: str = Query("all_time", pattern="^(daily|weekly|monthly|yearly|all_time|custom)$"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("finance.view")),
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


@router.get("/purchase-invoices")
async def get_purchase_invoices(
    range: str = Query("all_time"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    supplier_code: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("finance.invoices.view")),
) -> Dict[str, Any]:
    """Retrieve verified SAP purchase invoices with pagination, search, status, and summary KPIs."""
    target_branch = _get_permitted_branch(current_user, branch)
    data = await asyncio.to_thread(
        _finance_service.get_purchase_invoices,
        range_str=range,
        from_date=from_date,
        to_date=to_date,
        supplier_code=supplier_code,
        status=status,
        branch_id=target_branch,
        search=search,
        page=page,
        page_size=page_size,
    )
    return data


@router.get("/incoming-payments")
async def get_incoming_payments(
    range: str = Query("all_time"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    customer_code: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("finance.payments.view")),
) -> Dict[str, Any]:
    """Retrieve verified SAP incoming customer payments with method breakdowns and applied invoices."""
    target_branch = _get_permitted_branch(current_user, branch)
    data = await asyncio.to_thread(
        _finance_service.get_incoming_payments,
        range_str=range,
        from_date=from_date,
        to_date=to_date,
        customer_code=customer_code,
        payment_method=payment_method,
        branch_id=target_branch,
        search=search,
        page=page,
        page_size=page_size,
    )
    return data


@router.get("/outgoing-payments")
async def get_outgoing_payments(
    range: str = Query("all_time"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    supplier_code: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("finance.payments.view")),
) -> Dict[str, Any]:
    """Retrieve verified SAP vendor outgoing payments with method breakdowns and applied purchase invoices."""
    target_branch = _get_permitted_branch(current_user, branch)
    data = await asyncio.to_thread(
        _finance_service.get_outgoing_payments,
        range_str=range,
        from_date=from_date,
        to_date=to_date,
        supplier_code=supplier_code,
        payment_method=payment_method,
        branch_id=target_branch,
        search=search,
        page=page,
        page_size=page_size,
    )
    return data


@router.get("/customer-analysis")
async def get_customer_analysis(
    range: str = Query("all_time"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("sales"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("finance.view")),
) -> Dict[str, Any]:
    """Retrieve customer sales rankings, AR balances, transaction frequencies, and concentration analysis."""
    target_branch = _get_permitted_branch(current_user, branch)
    data = await asyncio.to_thread(
        _finance_service.get_customer_analysis,
        range_str=range,
        from_date=from_date,
        to_date=to_date,
        branch_id=target_branch,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return data


@router.get("/supplier-analysis")
async def get_supplier_analysis(
    range: str = Query("all_time"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("spend"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("finance.view")),
) -> Dict[str, Any]:
    """Retrieve supplier procurement rankings, AP balances, purchase frequencies, and vendor concentration."""
    target_branch = _get_permitted_branch(current_user, branch)
    data = await asyncio.to_thread(
        _finance_service.get_supplier_analysis,
        range_str=range,
        from_date=from_date,
        to_date=to_date,
        branch_id=target_branch,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return data


@router.get("/profitability-reports")
async def get_profitability_report(
    range: str = Query("all_time"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("finance.reports.view")),
) -> Dict[str, Any]:
    """Retrieve verified Net Sales, Purchase/Cost values, Gross Profit, and Operating Margin %."""
    target_branch = _get_permitted_branch(current_user, branch)
    data = await asyncio.to_thread(
        _finance_service.get_profitability_report,
        range_str=range,
        from_date=from_date,
        to_date=to_date,
        branch_id=target_branch,
    )
    return data


@router.get("/export")
async def export_finance_data(
    module: str = Query(..., description="Module: purchase_invoices, incoming_payments, outgoing_payments, customer_analysis, supplier_analysis, profitability"),
    range: str = Query("all_time"),
    branch: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("finance.view")),
):
    """Stream live formatted CSV export for any of the 7 financial modules."""
    from fastapi.responses import Response
    target_branch = _get_permitted_branch(current_user, branch)
    csv_text = await asyncio.to_thread(
        _finance_service.export_finance_csv,
        module=module,
        range_str=range,
        from_date=from_date,
        to_date=to_date,
        branch_id=target_branch,
        search=search,
        status=status,
    )
    filename = f"atlas_{module}_{range}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


class RecordUpdateRequest(BaseModel):
    entity_type: str
    record_id: str
    updates: Dict[str, Any]
    confirm: Optional[bool] = False


@router.get("/record-details")
async def get_record_details(
    entity_type: str = Query(..., description="Entity type: invoice, purchase_invoice, incoming_payment, outgoing_payment, customer, supplier"),
    record_id: str = Query(..., description="DocEntry or CardCode"),
    current_user: dict = Depends(require_permission("finance.view")),
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
    current_user: dict = Depends(require_permission("finance.view")),
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
    current_user: dict = Depends(require_permission("finance.payments.view")),
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
    current_user: dict = Depends(require_permission("finance.reports.view")),
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

