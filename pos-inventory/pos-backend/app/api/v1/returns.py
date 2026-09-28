"""Returns & Exchange API endpoints"""

import asyncio
import logging
import os as _os
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from app.core.cache import cache_delete, cache_delete_prefix, DASHBOARD_SUMMARY_KEY, PRODUCTS_LIST_KEY
from app.core.product_store import product_store
from app.core.rate_limiter import limiter
from app.core.security import get_current_user
from app.core.config import settings
from app.models.schemas import (
    ReturnCreate,
    ExchangeCreate,
    ReturnResponse,
    ExchangeResponse,
    ReturnDetail,
    ReturnLineItem,
)
from app.services.sap.returns_service import SAPReturnsService
from app.services.sap.invoices_service import SAPInvoicesService
from app.services.sap.client import SAPValidationError
from app.services import approval_service

router = APIRouter()
logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=min(32, (_os.cpu_count() or 4) * 4))


def _normalize_branch(value: Optional[str]) -> str:
    branch = str(value or "").strip().upper()
    if branch:
        return branch
    return str(getattr(settings, "SAP_DEFAULT_WAREHOUSE", "") or "").strip().upper() or "UNKNOWN"


def _extract_document_branch(document: dict) -> Optional[str]:
    for key in (
        "U_Branch",
        "U_BranchId",
        "U_Branch_ID",
        "U_BranchCode",
        "U_Warehouse",
        "U_WarehouseCode",
        "U_Warehouse_Code",
    ):
        value = str(document.get(key) or "").strip()
        if value:
            return value

    for line in document.get("DocumentLines") or document.get("CreditNoteLines") or []:
        value = str(line.get("WarehouseCode") or "").strip()
        if value:
            return value
    return None


def _ensure_document_branch_access(document: dict, current_user: dict) -> None:
    if str(current_user.get("role") or "").lower() == "admin":
        return

    document_branch = _extract_document_branch(document)
    user_branch = _normalize_branch(current_user.get("branch_id"))
    if not document_branch or _normalize_branch(document_branch) != user_branch:
        raise HTTPException(status_code=403, detail="Forbidden: document is outside your assigned branch.")


def _validate_return_items(invoice: dict, items: list) -> dict:
    invoice_lines = invoice.get("DocumentLines")
    if not isinstance(invoice_lines, list) or not invoice_lines:
        raise HTTPException(status_code=409, detail="Original invoice lines are unavailable for return validation.")

    lines_by_number = {}
    for index, line in enumerate(invoice_lines):
        if not isinstance(line, dict):
            continue
        try:
            line_number = int(line.get("LineNum", index))
        except (TypeError, ValueError):
            raise HTTPException(status_code=409, detail="Original invoice line identifiers are invalid.")
        lines_by_number[line_number] = line

    requested_quantities = {}
    for item in items:
        line_number = item.baseLine
        original_line = lines_by_number.get(line_number)
        if not original_line or str(original_line.get("ItemCode") or "") != item.itemCode:
            raise HTTPException(status_code=422, detail="Return item does not match the original invoice line.")
        requested_quantities[line_number] = requested_quantities.get(line_number, 0) + item.quantity

    for line_number, quantity in requested_quantities.items():
        try:
            original_quantity = float(lines_by_number[line_number].get("Quantity"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=409, detail="Original invoice quantity is unavailable for return validation.")
        if quantity > original_quantity:
            raise HTTPException(status_code=422, detail="Return quantity exceeds the original invoice quantity.")
    return lines_by_number


def _authenticated_user_id(current_user: dict) -> str:
    user_id = current_user.get("user_id") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authenticated user identity is unavailable.")
    return str(user_id)


def _parse_return_detail(doc: dict) -> ReturnDetail:
    lines = doc.get("CreditNoteLines") or []
    items = [
        ReturnLineItem(
            itemCode=str(line.get("ItemCode") or ""),
            itemName=str(line.get("ItemDescription") or line.get("ItemCode") or ""),
            quantity=int(float(line.get("Quantity") or 0)),
            unitPrice=float(line.get("UnitPrice") or line.get("Price") or 0),
            lineTotal=float(line.get("LineTotal") or 0),
            warehouse=line.get("WarehouseCode"),
            baseLine=int(line.get("BaseLine") or 0),
        )
        for line in lines
        if line.get("ItemCode")
    ]
    total = float(doc.get("DocTotal") or 0)
    comments = str(doc.get("Comments") or "")
    reason = ""
    for part in comments.split("|"):
        part = part.strip()
        if part.lower().startswith("return reason:"):
            reason = part[len("return reason:"):].strip()
            break

    return_type = None
    for part in comments.split("|"):
        part = part.strip()
        if part.lower().startswith("return type:"):
            return_type = part[len("return type:"):].strip()
            break

    return ReturnDetail(
        docEntry=int(doc.get("DocEntry") or 0),
        docNum=doc.get("DocNum"),
        docDate=str(doc.get("DocDate") or "")[:10] or None,
        originalDocNum=None,
        customerCode=doc.get("CardCode"),
        customerName=doc.get("CardName"),
        reason=reason or None,
        returnType=return_type,
        items=items,
        refundAmount=total,
    )


@router.get("/lookup")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def lookup_invoice(
    request: Request,
    q: str = Query(..., min_length=1, description="Invoice DocNum, SaleId or barcode prefix"),
    current_user: dict = Depends(get_current_user),
):
    """Search for an original invoice to initiate a return or exchange."""
    q_stripped = q.strip()
    invoice_service = SAPInvoicesService()
    loop = asyncio.get_running_loop()

    doc_entry: Optional[int] = None
    try:
        doc_entry = int(q_stripped)
    except ValueError:
        if q_stripped.upper().startswith("SALE-"):
            parts = q_stripped.upper().split("-")
            if len(parts) >= 3:
                try:
                    doc_entry = int(parts[-1])
                except ValueError:
                    pass

    if doc_entry is not None:
        try:
            invoice = await loop.run_in_executor(_executor, lambda: invoice_service.get_invoice(doc_entry))
            if invoice:
                _ensure_document_branch_access(invoice, current_user)
                return await _enrich_lookup_with_return_status(_build_lookup_response(invoice), loop)
            invoice_by_doc_num = await loop.run_in_executor(
                _executor, lambda: invoice_service.get_invoice_by_doc_num(doc_entry)
            )
            if invoice_by_doc_num:
                _ensure_document_branch_access(invoice_by_doc_num, current_user)
                return await _enrich_lookup_with_return_status(_build_lookup_response(invoice_by_doc_num), loop)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Lookup by DocEntry %s failed: %s", doc_entry, exc)

    try:
        recent = await loop.run_in_executor(_executor, lambda: invoice_service.get_recent_invoices(limit=200))
        for inv in recent:
            if str(inv.get("DocNum") or "") == q_stripped:
                doc_entry = inv.get("DocEntry")
                if doc_entry is not None:
                    try:
                        full_invoice = await loop.run_in_executor(
                            _executor, lambda: invoice_service.get_invoice(int(doc_entry))
                        )
                        if full_invoice:
                            _ensure_document_branch_access(full_invoice, current_user)
                            return await _enrich_lookup_with_return_status(_build_lookup_response(full_invoice), loop)
                    except HTTPException:
                        raise
                    except Exception as exc:
                        logger.warning("Lookup hydration failed for DocEntry %s: %s", doc_entry, exc)
                _ensure_document_branch_access(inv, current_user)
                return await _enrich_lookup_with_return_status(_build_lookup_response(inv), loop)
    except Exception as exc:
        logger.warning("Lookup scan of recent invoices failed: %s", exc)

    raise HTTPException(status_code=404, detail="Invoice not found. Please check the invoice number.")


async def _enrich_lookup_with_return_status(result: dict, loop) -> dict:
    """Check SAP for existing credit notes on this invoice and set hasReturn."""
    doc_num = result.get("docNum")
    if doc_num is None:
        return result
    try:
        returns_service = SAPReturnsService()
        has_return = await loop.run_in_executor(
            _executor, lambda: returns_service.check_invoice_has_return(int(doc_num))
        )
        result["hasReturn"] = has_return
    except Exception as exc:
        logger.debug("Could not check return status for DocNum=%s: %s", doc_num, exc)
    return result


def _build_lookup_response(invoice: dict) -> dict:
    lines = invoice.get("DocumentLines") or []
    items = [
        {
            "itemCode": str(line.get("ItemCode") or ""),
            "itemName": str(line.get("ItemDescription") or line.get("ItemCode") or ""),
            "quantity": int(float(line.get("Quantity") or 0)),
            "unitPrice": float(line.get("UnitPrice") or line.get("Price") or 0),
            "lineTotal": float(line.get("LineTotal") or 0),
            "warehouse": str(line.get("WarehouseCode") or ""),
            "baseLine": int(line.get("LineNum") or 0),
        }
        for line in lines
        if line.get("ItemCode")
    ]
    return {
        "docEntry": invoice.get("DocEntry"),
        "docNum": invoice.get("DocNum"),
        "docDate": str(invoice.get("DocDate") or "")[:10] or None,
        "customerCode": invoice.get("CardCode"),
        "customerName": invoice.get("U_C_Name") or invoice.get("CardName"),
        "customerPhone": invoice.get("U_W_Number"),
        "paymentMethod": invoice.get("U_P_Method"),
        "total": float(invoice.get("DocTotal") or 0),
        "items": items,
        "hasReturn": False,  # populated by lookup_invoice after a credit-note check
    }


@router.post("", response_model=ReturnResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.RATE_LIMIT_SALES)
async def create_return(
    request: Request,
    return_data: ReturnCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Process a return: creates a pending approval request."""
    branch = _normalize_branch(current_user.get("branch_id"))

    # Validate invoice exists
    loop = asyncio.get_running_loop()
    try:
        invoice_service = SAPInvoicesService()
        invoice = await loop.run_in_executor(_executor, lambda: invoice_service.get_invoice(return_data.originalDocEntry))
        if not invoice:
            raise HTTPException(status_code=404, detail="Original invoice not found.")
        _ensure_document_branch_access(invoice, current_user)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=502, detail="Failed to validate original invoice with SAP.")

    if return_data.originalDocNum is not None and str(return_data.originalDocNum) != str(invoice.get("DocNum")):
        raise HTTPException(status_code=422, detail="Original invoice number does not match the invoice record.")
    source_lines = _validate_return_items(invoice, return_data.items)
    card_code = str(invoice.get("CardCode") or "").strip()
    if not card_code:
        raise HTTPException(status_code=409, detail="Original invoice customer is unavailable for return validation.")
    refund_amount = sum(item.lineTotal for item in return_data.items)
    payload = return_data.model_dump()
    payload["warehouse"] = branch
    for item in payload["items"]:
        source_line = source_lines[item["baseLine"]]
        item["warehouse"] = str(source_line.get("WarehouseCode") or branch)
    payload["cardCode"] = card_code

    req = approval_service.create_approval_request(
        request_type=return_data.returnType,
        requester_id=_authenticated_user_id(current_user),
        branch_id=branch,
        original_doc_entry=return_data.originalDocEntry,
        original_doc_num=str(return_data.originalDocNum or invoice.get("DocNum") or ""),
        amount=refund_amount,
        payload=payload,
        reason=return_data.reason,
    )

    return ReturnResponse(
        returnDocEntry=0,
        returnDocNum=None,
        creditNoteDocEntry=None,
        creditNoteDocNum=None,
        refundAmount=round(refund_amount, 2),
        returnType=return_data.returnType,
        status="pending_approval",
        requestId=req["id"],
    )


@router.post("/exchange", response_model=ExchangeResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.RATE_LIMIT_SALES)
async def create_exchange(
    request: Request,
    exchange_data: ExchangeCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Process an exchange: creates a pending approval request."""
    branch = _normalize_branch(current_user.get("branch_id"))

    loop = asyncio.get_running_loop()
    try:
        invoice_service = SAPInvoicesService()
        invoice = await loop.run_in_executor(_executor, lambda: invoice_service.get_invoice(exchange_data.originalDocEntry))
        if not invoice:
            raise HTTPException(status_code=404, detail="Original invoice not found.")
        _ensure_document_branch_access(invoice, current_user)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=502, detail="Failed to validate original invoice with SAP.")

    if exchange_data.originalDocNum is not None and str(exchange_data.originalDocNum) != str(invoice.get("DocNum")):
        raise HTTPException(status_code=422, detail="Original invoice number does not match the invoice record.")
    source_lines = _validate_return_items(invoice, exchange_data.returnItems)
    card_code = str(invoice.get("CardCode") or "").strip()
    if not card_code:
        raise HTTPException(status_code=409, detail="Original invoice customer is unavailable for return validation.")
    return_amount = sum(item.lineTotal for item in exchange_data.returnItems)
    new_invoice_total = sum(item.product.price * item.quantity for item in exchange_data.replacementItems)
    price_difference = round(new_invoice_total - return_amount, 2)

    req = approval_service.create_approval_request(
        request_type="exchange",
        requester_id=_authenticated_user_id(current_user),
        branch_id=branch,
        original_doc_entry=exchange_data.originalDocEntry,
        original_doc_num=str(exchange_data.originalDocNum or invoice.get("DocNum") or ""),
        amount=return_amount,
        payload={
            **exchange_data.model_dump(),
            "warehouse": branch,
            "cardCode": card_code,
            "returnItems": [
                {
                    **item,
                    "warehouse": str(source_lines[item["baseLine"]].get("WarehouseCode") or branch),
                }
                for item in exchange_data.model_dump()["returnItems"]
            ],
            "replacementItems": [
                {**item, "product": {**item["product"], "warehouse": branch}}
                for item in exchange_data.model_dump()["replacementItems"]
            ],
        },
        reason=exchange_data.reason,
    )

    return ExchangeResponse(
        returnDocEntry=0,
        returnDocNum=None,
        newInvoiceDocEntry=None,
        newInvoiceDocNum=None,
        creditNoteDocEntry=None,
        creditNoteDocNum=None,
        returnAmount=round(return_amount, 2),
        newInvoiceAmount=round(new_invoice_total, 2),
        priceDifference=price_difference,
        status="pending_approval",
        requestId=req["id"],
    )


@router.get("", response_model=List[ReturnDetail])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_returns(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """List recent returns for the current user's branch (last 50)."""
    loop = asyncio.get_running_loop()
    try:
        returns_service = SAPReturnsService()
        docs = await loop.run_in_executor(_executor, lambda: returns_service.get_recent_returns(limit=50))
    except Exception as exc:
        logger.error("Failed to fetch returns list: %s", exc)
        raise HTTPException(status_code=502, detail="Could not retrieve returns from SAP.")

    branch = _normalize_branch(current_user.get("branch_id"))
    role = str(current_user.get("role") or "user").lower()
    if role != "admin":
        docs = [
            doc for doc in docs
            if _extract_document_branch(doc)
            and _normalize_branch(_extract_document_branch(doc)) == branch
        ]

    return [_parse_return_detail(d) for d in docs]


@router.get("/{doc_entry}", response_model=ReturnDetail)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_return(
    request: Request,
    doc_entry: int,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific return by SAP DocEntry."""
    loop = asyncio.get_running_loop()
    try:
        returns_service = SAPReturnsService()
        doc = await loop.run_in_executor(_executor, lambda: returns_service.get_return(doc_entry))
    except Exception as exc:
        logger.error("Failed to fetch return %s: %s", doc_entry, exc)
        raise HTTPException(status_code=502, detail="Could not retrieve return from SAP.")

    if not doc:
        raise HTTPException(status_code=404, detail="Return not found.")

    _ensure_document_branch_access(doc, current_user)
    return _parse_return_detail(doc)
