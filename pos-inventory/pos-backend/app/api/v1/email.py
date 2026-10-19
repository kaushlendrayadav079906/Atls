"""
Email API Endpoints for ATLAS.
Supports draft generation, preview, verified sending, and audit log inspection.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
import logging

from app.core.config import settings
from app.core.security import get_current_user
from app.models.schemas import (
    EmailAuditLogItem,
    EmailDraftRequest,
    EmailDraftResponse,
    EmailSendRequest,
    EmailSendResponse,
)
from app.services.email import email_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/draft",
    response_model=EmailDraftResponse,
    summary="Generate a verified business email draft",
)
def generate_email_draft(
    request: EmailDraftRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Generate an intelligent, professional email draft with live verified SAP data.
    Does NOT send the email.
    """
    try:
        return email_service.generate_draft(request, current_user)
    except Exception as exc:
        logger.error("Failed to generate email draft: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate email draft: {str(exc)}",
        )


@router.post(
    "/send",
    response_model=EmailSendResponse,
    summary="Send a confirmed business email via configured provider",
)
def send_email(
    request: EmailSendRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Send an email after explicit user confirmation (confirmed=True).
    Enforces authorization (email.send permission or Manager/Admin role),
    validates recipient email format, checks idempotency to prevent duplicates,
    and records an audit log.
    """
    try:
        return email_service.send_email(request, current_user)
    except PermissionError as perm_err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(perm_err),
        )
    except ValueError as val_err:
        err_msg = str(val_err)
        if "Duplicate email" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )
    except Exception as exc:
        logger.error("Unhandled error sending email: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email due to a delivery provider or server error.",
        )


@router.get(
    "/audit-logs",
    response_model=List[EmailAuditLogItem],
    summary="Retrieve email delivery audit history",
)
def get_email_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    recipient: Optional[str] = Query(None),
    record_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieve audit history of attempted and dispatched business emails.
    Requires role of Admin or Manager, or permissions 'email.send' / 'reports.view'.
    """
    user_role = str(current_user.get("role") or "user").lower()
    user_perms = set(current_user.get("permissions") or [])
    if user_role not in ("admin", "manager") and not ({"email.send", "reports.view"} & user_perms):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Requires Manager, Admin, or reports audit permission.",
        )

    return email_service.get_audit_logs(
        limit=limit,
        offset=offset,
        recipient=recipient,
        record_id=record_id,
    )


@router.get(
    "/settings",
    summary="Fetch non-sensitive email service configuration",
)
def get_email_settings(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Return sanitized email provider settings.
    Never exposes passwords, API keys, or private security tokens.
    """
    return {
        "provider": getattr(settings, "EMAIL_PROVIDER", "console"),
        "from_address": getattr(settings, "EMAIL_FROM_ADDRESS", "noreply@atlas.local"),
        "from_name": getattr(settings, "EMAIL_FROM_NAME", "ATLAS Business Operations"),
        "company_signature": getattr(settings, "COMPANY_SIGNATURE", "ATLAS Operations & Accounts Team"),
        "smtp_host": getattr(settings, "SMTP_HOST", "localhost"),
        "smtp_port": getattr(settings, "SMTP_PORT", 587),
        "smtp_use_tls": getattr(settings, "SMTP_USE_TLS", True),
        "smtp_use_ssl": getattr(settings, "SMTP_USE_SSL", False),
    }
