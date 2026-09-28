"""Sales API endpoints – SAP-only, synchronous invoice creation, rate-limited."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from datetime import datetime
import os as _os
import uuid
import logging
import time

from app.core.cache import cache_delete, cache_delete_prefix, DASHBOARD_SUMMARY_KEY, PRODUCTS_LIST_KEY
from app.core.product_store import product_store
from app.core.rate_limiter import limiter
from app.core.security import get_current_user
from app.core.config import settings
from app.models.schemas import SaleCreate, SaleResponse, SaleDetail
from app.services.sap.invoices_service import SAPInvoicesService
from app.services.sap.client import SAPValidationError

router = APIRouter()
logger = logging.getLogger(__name__)

# Shared executor for blocking SAP calls (reuse same sizing as products)
_executor = ThreadPoolExecutor(max_workers=min(32, (_os.cpu_count() or 4) * 4))
_invoice_service = SAPInvoicesService()


def _normalize_branch(value: Optional[str]) -> str:
    branch = str(value or '').strip().upper()
    if branch:
        return branch
    fallback = str(getattr(settings, 'SAP_DEFAULT_WAREHOUSE', '') or '').strip().upper()
    return fallback or 'UNKNOWN'


def _format_sale_id(branch: str, doc_num: Optional[Any], fallback: str) -> str:
    if doc_num is None:
        return f"SALE-{branch}-{fallback}"

    try:
        numeric = int(doc_num)
        return f"SALE-{branch}-{str(numeric).zfill(6)}"
    except (TypeError, ValueError):
        return f"SALE-{branch}-{str(doc_num)}"


def _extract_branch_from_invoice(invoice: Dict[str, Any]) -> Optional[str]:
    for key in (
        "U_Branch",
        "U_BranchId",
        "U_Branch_ID",
        "U_BranchCode",
        "U_Warehouse",
        "U_WarehouseCode",
        "U_Warehouse_Code",
    ):
        value = str(invoice.get(key) or "").strip()
        if value:
            return value

    for line in invoice.get("DocumentLines") or []:
        candidate = str(line.get("WarehouseCode") or "").strip()
        if candidate:
            return candidate
    return None


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_SALES)
async def create_sale(
    request: Request,
    sale_data: SaleCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new sale with synchronous SAP AR Invoice creation.

    Creates invoice in SAP first, then returns success. If SAP rejects
    the invoice (e.g., insufficient stock), returns appropriate error.
    """
    branch = _normalize_branch(current_user.get("branch_id"))
    fallback_suffix = uuid.uuid4().hex[:6].upper()
    sale_id = _format_sale_id(branch, None, fallback_suffix)

    sap_sale_data = {
        "items": [item.model_dump() for item in sale_data.items],
        "total": sale_data.total,
        "subtotal": getattr(sale_data, "subtotal", sale_data.total),
        "discount": getattr(sale_data, "discount", 0),
        "gst": getattr(sale_data, "gst", 0),
        "gstPercentage": getattr(sale_data, "gstPercentage", None),
        "customer": sale_data.customer.model_dump(),
        "paymentMethods": (
            [pm.model_dump() for pm in sale_data.paymentMethods]
            if sale_data.paymentMethods
            else None
        ),
        "branch_id": branch,
    }

    # Create invoice in thread pool so the async event loop is not blocked
    try:
        start_total = time.perf_counter()
        loop = asyncio.get_running_loop()
        start_invoice = time.perf_counter()
        result = await loop.run_in_executor(
            _executor,
            lambda: _invoice_service.create_invoice(
                sap_sale_data, create_payment=not settings.SAP_ASYNC_PAYMENT
            ),
        )
        invoice_elapsed = (time.perf_counter() - start_invoice) * 1000.0
        logger.info(f"[SALE TIMING] create_invoice duration_ms={invoice_elapsed:.2f}")

        doc_entry = result.get("DocEntry")
        doc_num = result.get("DocNum")
        sale_id = _format_sale_id(branch, doc_num, fallback_suffix)

        logger.info(
            f"Sale {sale_id} completed: Branch={branch}, SAP DocEntry={doc_entry}, DocNum={doc_num}"
        )
        # Invalidate dashboard and branch-specific product cache in background
        background_tasks.add_task(cache_delete, DASHBOARD_SUMMARY_KEY)
        background_tasks.add_task(cache_delete_prefix, f"{DASHBOARD_SUMMARY_KEY}:operator:{branch}")
        background_tasks.add_task(cache_delete_prefix, f"{PRODUCTS_LIST_KEY}:branch:{branch}")

        # Patch stock in the long-lived product store immediately (no SAP round-trip needed)
        sold_deltas = [
            {"itemCode": item["product"]["id"], "qty_change": -float(item["quantity"])}
            for item in sap_sale_data["items"]
        ]
        background_tasks.add_task(product_store.patch_stock, branch, sold_deltas)

        total_elapsed = (time.perf_counter() - start_total) * 1000.0
        logger.info(f"[SALE TIMING] total duration_ms={total_elapsed:.2f}")
        
        if settings.SAP_ASYNC_PAYMENT and doc_entry is not None:
            background_tasks.add_task(
                _invoice_service.create_payment_for_invoice,
                result.get("CardCode"),
                int(doc_entry),
                float(result.get("PaymentAmount") or 0.0),
                result.get("PaymentType") or "cash",
            )

        return SaleResponse(
            saleId=sale_id,
            total=sale_data.total,
            sapDocEntry=doc_entry,
            sapDocNum=doc_num,
        )
        
    except SAPValidationError as e:
        error_msg = str(e)
        logger.error(f"SAP validation error for sale {sale_id}: {error_msg}")
        
        # Parse specific SAP error messages for user-friendly responses
        if "negative inventory" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient stock for one or more items. Please check inventory."
            )
        elif "item code" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid product code. Product may not exist in SAP."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SAP validation failed: {error_msg}"
            )
            
    except Exception as e:
        logger.error(f"Failed to create invoice for sale {sale_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create invoice in SAP. Please try again."
        )


@router.get("/gst-values")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_allowed_gst_values(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Return GST percentages currently allowed by SAP SalesTaxCodes."""
    try:
        loop = asyncio.get_running_loop()
        values = await loop.run_in_executor(
            _executor, _invoice_service.get_allowed_gst_percentages
        )
    except Exception as exc:
        logger.error(f"SAP get_allowed_gst_values failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve GST values from SAP")

    default_value = 5.0 if 5.0 in values else (18.0 if 18.0 in values else (values[0] if values else 5.0))
    return {
        "values": values,
        "default": default_value,
    }


@router.get("", response_model=List[SaleDetail])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_sales(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Get recent sales from SAP AR Invoices."""
    try:
        loop = asyncio.get_running_loop()
        invoices = await loop.run_in_executor(
            _executor, lambda: _invoice_service.get_recent_invoices_with_lines(limit=100, max_line_rows=4000)
        )
    except Exception as exc:
        logger.error(f"SAP get_invoices failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve sales from SAP")

    # Enforce branch scope
    role = current_user.get("role", "user")
    user_branch = _normalize_branch(current_user.get("branch_id"))
    
    filtered_invoices = []
    for inv in invoices:
        inv_branch = _normalize_branch(_extract_branch_from_invoice(inv))
        if role == "admin" or inv_branch == user_branch:
            filtered_invoices.append(inv)

    return [
        SaleDetail(
            id=inv.get("DocEntry"),
            saleId=_format_sale_id(
                _normalize_branch(_extract_branch_from_invoice(inv)),
                inv.get("DocNum"),
                str(inv.get("DocEntry") or "")
            ),
            total=inv.get("DocTotal", 0.0),
            items=inv.get("DocumentLines") or [],
            customer=inv.get("CardCode"),
            syncStatus="synced",
            createdAt=inv.get("DocDate"),
            sapDocEntry=inv.get("DocEntry"),
            sapDocNum=inv.get("DocNum"),
        )
        for inv in filtered_invoices
    ]


@router.get("/{sale_id}", response_model=SaleDetail)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_sale(
    request: Request,
    sale_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific SAP AR Invoice by DocEntry or DocNum."""
    try:
        loop = asyncio.get_running_loop()
        inv = await loop.run_in_executor(
            _executor, lambda: _invoice_service.get_invoice(int(sale_id))
        )
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="sale_id must be a numeric DocEntry")
    except Exception as exc:
        logger.error(f"SAP get_invoice failed for {sale_id}: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve sale from SAP")

    if not inv:
        raise HTTPException(status_code=404, detail=f"Sale {sale_id} not found")

    # Enforce branch scope
    role = current_user.get("role", "user")
    user_branch = _normalize_branch(current_user.get("branch_id"))
    inv_branch = _normalize_branch(_extract_branch_from_invoice(inv))
    
    if role != "admin" and inv_branch != user_branch:
        raise HTTPException(status_code=403, detail="Forbidden: You can only view sales from your assigned branch.")

    return SaleDetail(
        id=inv.get("DocEntry"),
        saleId=_format_sale_id(
            inv_branch,
            inv.get("DocNum"),
            str(inv.get("DocEntry") or "")
        ),
        total=inv.get("DocTotal", 0.0),
        items=inv.get("DocumentLines", []),
        customer=inv.get("CardCode"),
        syncStatus="synced",
        createdAt=inv.get("DocDate"),
        sapDocEntry=inv.get("DocEntry"),
        sapDocNum=inv.get("DocNum"),
    )


@router.post("/{sale_id}/cancel")
@limiter.limit(settings.RATE_LIMIT_SALES)
async def cancel_sale(
    request: Request,
    sale_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Cancel/Void a specific SAP AR Invoice."""
    try:
        doc_entry = int(sale_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="sale_id must be a numeric DocEntry")

    loop = asyncio.get_running_loop()
    
    # 1. Fetch invoice to verify authorization and status
    try:
        inv = await loop.run_in_executor(
            _executor, lambda: _invoice_service.get_invoice(doc_entry)
        )
    except Exception as exc:
        logger.error(f"SAP get_invoice failed for cancellation of {sale_id}: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve sale from SAP")

    if not inv:
        raise HTTPException(status_code=404, detail=f"Sale {sale_id} not found")

    # 2. Authorization check
    role = current_user.get("role")
    inv_branch = _normalize_branch(_extract_branch_from_invoice(inv))
    user_branch = _normalize_branch(current_user.get("branch_id"))
    
    if role != "admin":
        if inv_branch != user_branch:
            raise HTTPException(
                status_code=403, 
                detail="Forbidden: You can only void sales from your assigned branch."
            )

    # 3. Check SAP status
    if inv.get("Cancelled") == "tYES":
        raise HTTPException(status_code=400, detail="Sale is already cancelled.")
    
    if inv.get("DocumentStatus") == "bost_Close":
        raise HTTPException(
            status_code=400, 
            detail="Cannot void: Invoice is closed. It may have linked incoming payments. Use the return/refund workflow instead."
        )

    # 4. Attempt Cancellation
    try:
        success = await loop.run_in_executor(
            _executor, lambda: _invoice_service.cancel_invoice(doc_entry)
        )
        if not success:
            raise HTTPException(status_code=500, detail="SAP cancellation returned failure.")
            
        # Invalidate cache for dashboard
        background_tasks.add_task(cache_delete, DASHBOARD_SUMMARY_KEY)
        background_tasks.add_task(cache_delete_prefix, f"{DASHBOARD_SUMMARY_KEY}:operator:{inv_branch}")
        
        # Restore stock in the long-lived product store immediately
        sold_deltas = [
            {"itemCode": line.get("ItemCode"), "qty_change": float(line.get("Quantity", 0))}
            for line in inv.get("DocumentLines", []) if line.get("ItemCode")
        ]
        if sold_deltas:
            background_tasks.add_task(product_store.patch_stock, inv_branch, sold_deltas)
            background_tasks.add_task(cache_delete_prefix, f"{PRODUCTS_LIST_KEY}:branch:{inv_branch}")

        return {"success": True, "message": "Sale cancelled successfully."}

    except SAPValidationError as e:
        error_msg = str(e).lower()
        logger.error(f"SAP validation error for cancelling {sale_id}: {error_msg}")
        if "payment" in error_msg or "reconciled" in error_msg:
            raise HTTPException(
                status_code=400, 
                detail="Cannot void: Invoice is linked to a payment. Use the return/refund workflow."
            )
        elif "period" in error_msg:
            raise HTTPException(
                status_code=400, 
                detail="Cannot void: Accounting period is locked."
            )
        raise HTTPException(status_code=400, detail=f"SAP rejected cancellation: {str(e)}")
        
    except Exception as e:
        logger.error(f"Failed to cancel invoice {sale_id}: {e}")
        # Return 502 for ambiguous outcome to avoid blind retry of financial action
        raise HTTPException(
            status_code=502, 
            detail="SAP cancellation failed or timed out. Please check SAP manually before retrying."
        )
