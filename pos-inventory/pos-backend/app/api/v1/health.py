"""Health check API endpoints for SAP and system dependencies."""

import logging
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter
from app.services.sap.client import get_sap_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/sap")
async def get_sap_health() -> Dict[str, Any]:
    """
    Dedicated SAP Service Layer health check.
    Probes SAP session liveness and circuit breaker state.
    """
    try:
        client = get_sap_client()
        result = client.check_health()
        return result
    except Exception as exc:
        logger.warning(f"Error checking SAP health: {exc}")
        return {
            "status": "disconnected",
            "authenticated": False,
            "circuit_breaker": "UNKNOWN",
            "message": str(exc),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get("")
async def get_system_health() -> Dict[str, Any]:
    """
    Aggregated health check endpoint distinguishing app liveness,
    database status, and SAP status.
    """
    sap_health = await get_sap_health()
    db_status = "unavailable"

    try:
        from app.services.user_service import _get_connection
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                if cur.fetchone():
                    db_status = "connected"
    except Exception as exc:
        logger.warning(f"DB health check failed: {exc}")

    return {
        "status": "healthy",
        "dependencies": {
            "sap": sap_health.get("status", "disconnected"),
            "database": db_status,
        },
        "sap": sap_health,
        "timestamp": datetime.utcnow().isoformat(),
    }
