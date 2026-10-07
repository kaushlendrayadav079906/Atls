import os

api_code = """\"\"\"Payments Report API\"\"\"

import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.security import get_current_user
from app.services.sap.payments_report_service import SAPPaymentsReportService
from app.api.v1.admin import _get_date_range_with_custom
from pydantic import BaseModel

router = APIRouter()
service = SAPPaymentsReportService()

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
async def get_payments_overview(
    range: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly|all_time)$"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    payments = await asyncio.to_thread(
        service.get_payments_by_date, start_date, end_date, target_branch, customer, payment_method
    )
    
    total_amount = sum(p.get("_TotalAmount", 0) for p in payments)
    
    return {
        "totalPayments": round(total_amount, 2),
        "paymentCount": len(payments),
        "averagePaymentValue": round(total_amount / len(payments), 2) if len(payments) > 0 else 0,
        "refundsIssued": 0, # Placeholders for returns, you can expand if needed
        "refundsAmount": 0,
    }

@router.get("/distribution")
async def get_payments_distribution(
    range: str = Query("monthly"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    payments = await asyncio.to_thread(
        service.get_payments_by_date, start_date, end_date, target_branch, customer, None
    )
    
    dist = {}
    for p in payments:
        pm = p.get("_PaymentMethod") or "cash"
        if pm not in dist:
            dist[pm] = {"method": pm, "total": 0.0, "count": 0}
        dist[pm]["total"] += p.get("_TotalAmount", 0)
        dist[pm]["count"] += 1
        
    return list(dist.values())

@router.get("/trend")
async def get_payments_trend(
    range: str = Query("monthly"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    payments = await asyncio.to_thread(
        service.get_payments_by_date, start_date, end_date, target_branch, customer, payment_method
    )
    
    # We group by date
    trend_map = {}
    for p in payments:
        date_str = p.get("DocDate", "")[:10]
        if date_str not in trend_map:
            trend_map[date_str] = {"label": date_str, "amount": 0.0, "count": 0}
        trend_map[date_str]["amount"] += p.get("_TotalAmount", 0)
        trend_map[date_str]["count"] += 1
        
    trend_list = sorted(trend_map.values(), key=lambda x: x["label"])
    return trend_list

@router.get("/transactions")
async def get_payments_transactions(
    range: str = Query("monthly"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(10),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user),
):
    target_branch = _get_permitted_branch(current_user, branch)
    start_date, end_date = _get_date_range_with_custom(range, from_date, to_date)
    
    payments = await asyncio.to_thread(
        service.get_payments_by_date, start_date, end_date, target_branch, customer, payment_method
    )
    
    if search:
        s_low = search.lower()
        payments = [
            p for p in payments 
            if s_low in str(p.get("CardCode") or "").lower()
            or s_low in str(p.get("CardName") or "").lower()
            or s_low in str(p.get("DocNum") or "").lower()
            or s_low in str(p.get("_InvoiceDocNum") or "").lower()
        ]
        
    total = len(payments)
    paginated = payments[offset:offset+limit]
    
    items = []
    for p in paginated:
        items.append({
            "docEntry": p.get("DocEntry"),
            "docNum": p.get("DocNum"),
            "invoiceDocNum": p.get("_InvoiceDocNum"),
            "docDate": p.get("DocDate"),
            "customerCode": p.get("CardCode"),
            "customerName": p.get("CardName"),
            "paymentMethod": p.get("_PaymentMethod"),
            "totalAmount": p.get("_TotalAmount", 0),
            "status": "Success", # In SAP if it exists it's successful usually
            "transactionId": f"TXN-{p.get('DocNum')}" if p.get("DocNum") else None
        })
        
    return {
        "total": total,
        "items": items
    }
"""

os.makedirs('pos-backend/app/api/v1', exist_ok=True)
with open('pos-backend/app/api/v1/payments_report.py', 'w') as f:
    f.write(api_code)

# Register in __init__.py
init_path = 'pos-backend/app/api/v1/__init__.py'
with open(init_path, 'r') as f:
    content = f.read()

if 'payments_report' not in content:
    content = content.replace(
        "from app.api.v1 import auth, products, sales, dashboard, admin, returns, customers, atlas",
        "from app.api.v1 import auth, products, sales, dashboard, admin, returns, customers, atlas, payments_report"
    )
    content += '\nrouter.include_router(payments_report.router, prefix="/reports/payments", tags=["Payment Reports"])\n'
    with open(init_path, 'w') as f:
        f.write(content)
