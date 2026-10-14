"""Audit service for ATLAS Finance module - tracks write-back operations and administrative changes."""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

AUDIT_LOG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "audit_finance.json"
)

# In-memory circular buffer of recent audit entries (max 500)
_AUDIT_LOGS: List[Dict[str, Any]] = []
_MAX_ENTRIES = 500


def _load_persisted_logs():
    global _AUDIT_LOGS
    if os.path.exists(AUDIT_LOG_FILE):
        try:
            with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    _AUDIT_LOGS = data[-_MAX_ENTRIES:]
        except Exception as e:
            logger.warning("Failed to load persisted audit logs: %s", e)


def _persist_logs():
    try:
        with open(AUDIT_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(_AUDIT_LOGS[-_MAX_ENTRIES:], f, indent=2, default=str)
    except Exception as e:
        logger.warning("Failed to persist audit logs: %s", e)


# Initialize from disk
_load_persisted_logs()


def record_audit_entry(
    user_id: str,
    username: str,
    role: str,
    entity_type: str,
    record_id: str,
    action: str,
    changes: List[Dict[str, Any]],
    status: str,
    sap_response: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Dict[str, Any]:
    """Record an audit trail event for record modifications or SAP updates."""
    entry = {
        "id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "username": username,
        "role": role,
        "entity_type": entity_type,
        "record_id": str(record_id),
        "action": action,
        "changes": changes,
        "status": status,
        "sap_response": sap_response or {},
        "error_message": error_message,
        "ip_address": ip_address,
    }

    _AUDIT_LOGS.insert(0, entry)
    if len(_AUDIT_LOGS) > _MAX_ENTRIES:
        _AUDIT_LOGS.pop()

    _persist_logs()
    logger.info(
        "[AUDIT] %s by %s (%s) on %s %s - Status: %s",
        action, username, role, entity_type, record_id, status
    )
    return entry


def get_audit_entries(
    entity_type: Optional[str] = None,
    record_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Retrieve filtered audit history."""
    results = _AUDIT_LOGS
    if entity_type:
        results = [r for r in results if r.get("entity_type") == entity_type]
    if record_id:
        results = [r for r in results if str(r.get("record_id")) == str(record_id)]
    if user_id:
        results = [r for r in results if r.get("user_id") == user_id]
    return results[:limit]
