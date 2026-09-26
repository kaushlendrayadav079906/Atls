import sys

content = open('pos-backend/app/api/v1/dashboard.py', 'r', encoding='utf-8').read()

# Add require_manager_or_admin, require_admin, require_operator to get_current_user imports if missing
if 'require_manager_or_admin' not in content:
    content = content.replace(
        'from app.core.security import get_current_user',
        'from app.core.security import get_current_user, require_manager_or_admin'
    )
if 'from app.services import approval_service' not in content:
    content = content.replace(
        'from app.api.v1.customers import _compute_customer_insights',
        'from app.api.v1.customers import _compute_customer_insights\nfrom app.services import approval_service\nfrom app.models.schemas import DashboardAlert'
    )
if '_get_permitted_branch' not in content:
    content = content.replace(
        'from app.api.v1.customers import _compute_customer_insights',
        'from app.api.v1.customers import _compute_customer_insights\nfrom app.api.v1.admin import _get_permitted_branch'
    )

new_endpoint = '''
@router.get("/alerts", response_model=List[DashboardAlert])
async def get_alerts(current_user: dict = Depends(require_manager_or_admin)):
    """Fetch pending approvals as alerts for authorized users. Branch scoped."""
    target_branch = _get_permitted_branch(current_user, None)
    
    try:
        pending_approvals = approval_service.get_pending_approvals(branch_id=target_branch)
    except Exception as e:
        logger.error(f"Failed to fetch alerts: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch alerts")
        
    alerts = []
    for req in pending_approvals:
        alerts.append(
            DashboardAlert(
                id=req["id"],
                request_type=req["request_type"],
                status=req["status"],
                amount=req["amount"],
                reason=req["reason"],
                branch_id=req["branch_id"],
                created_at=req["created_at"]
            )
        )
    return alerts
'''

content += new_endpoint

open('pos-backend/app/api/v1/dashboard.py', 'w', encoding='utf-8').write(content)
