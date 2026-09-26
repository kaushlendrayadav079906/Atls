"""PostgreSQL-backed approval requests service for refund/return workflows."""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.services.user_service import _get_connection

logger = logging.getLogger(__name__)

def init_approval_storage() -> None:
    """Create the approval_requests table if it does not already exist."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS approval_requests (
                    id TEXT PRIMARY KEY,
                    request_type VARCHAR(50) NOT NULL, -- e.g., 'refund', 'exchange'
                    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
                    requester_id TEXT NOT NULL,
                    approver_id TEXT NULL,
                    branch_id TEXT NOT NULL,
                    original_doc_entry INT NOT NULL,
                    original_doc_num TEXT NOT NULL,
                    amount NUMERIC(12, 2) NOT NULL,
                    payload JSONB NOT NULL,
                    reason TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

def create_approval_request(
    request_type: str,
    requester_id: str,
    branch_id: str,
    original_doc_entry: int,
    original_doc_num: str,
    amount: float,
    payload: dict,
    reason: str,
) -> Dict[str, Any]:
    req_id = str(uuid.uuid4())
    import json
    
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO approval_requests (
                    id, request_type, requester_id, branch_id, original_doc_entry, original_doc_num, amount, payload, reason, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    req_id,
                    request_type,
                    requester_id,
                    branch_id,
                    original_doc_entry,
                    original_doc_num,
                    amount,
                    json.dumps(payload),
                    reason,
                    datetime.utcnow(),
                    datetime.utcnow(),
                ),
            )
    
    logger.info("Created approval request: %s for doc %s", req_id, original_doc_entry)
    return get_approval_request(req_id)

def get_approval_request(req_id: str) -> Optional[Dict[str, Any]]:
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, request_type, status, requester_id, approver_id, branch_id, original_doc_entry, original_doc_num, amount, payload, reason, created_at, updated_at
                FROM approval_requests
                WHERE id = %s
                LIMIT 1
                """,
                (req_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            
            return {
                "id": row[0],
                "request_type": row[1],
                "status": row[2],
                "requester_id": row[3],
                "approver_id": row[4],
                "branch_id": row[5],
                "original_doc_entry": row[6],
                "original_doc_num": row[7],
                "amount": float(row[8]),
                "payload": row[9],
                "reason": row[10],
                "created_at": row[11].isoformat() if row[11] else None,
                "updated_at": row[12].isoformat() if row[12] else None,
            }

def update_approval_status(req_id: str, status: str, approver_id: str = None, from_status: str = 'pending', payload: dict = None) -> bool:
    import json
    with _get_connection() as conn:
        with conn.cursor() as cur:
            if payload is not None:
                cur.execute(
                    """
                    UPDATE approval_requests
                    SET status = %s, approver_id = COALESCE(%s, approver_id), updated_at = %s, payload = %s
                    WHERE id = %s AND status = %s
                    """,
                    (status, approver_id, datetime.utcnow(), json.dumps(payload), req_id, from_status),
                )
            else:
                cur.execute(
                    """
                    UPDATE approval_requests
                    SET status = %s, approver_id = COALESCE(%s, approver_id), updated_at = %s
                    WHERE id = %s AND status = %s
                    """,
                    (status, approver_id, datetime.utcnow(), req_id, from_status),
                )
            return cur.rowcount > 0

def get_pending_approvals(branch_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with _get_connection() as conn:
        with conn.cursor() as cur:
            if branch_id:
                cur.execute(
                    """
                    SELECT id, request_type, status, requester_id, approver_id, branch_id, original_doc_entry, original_doc_num, amount, payload, reason, created_at, updated_at
                    FROM approval_requests
                    WHERE status IN ('pending', 'failed', 'outcome-unknown') AND branch_id = %s
                    ORDER BY created_at ASC
                    """,
                    (branch_id,)
                )
            else:
                cur.execute(
                    """
                    SELECT id, request_type, status, requester_id, approver_id, branch_id, original_doc_entry, original_doc_num, amount, payload, reason, created_at, updated_at
                    FROM approval_requests
                    WHERE status IN ('pending', 'failed', 'outcome-unknown')
                    ORDER BY created_at ASC
                    """
                )
            rows = cur.fetchall()
            return [
                {
                    "id": row[0],
                    "request_type": row[1],
                    "status": row[2],
                    "requester_id": row[3],
                    "approver_id": row[4],
                    "branch_id": row[5],
                    "original_doc_entry": row[6],
                    "original_doc_num": row[7],
                    "amount": float(row[8]),
                    "payload": row[9],
                    "reason": row[10],
                    "created_at": row[11].isoformat() if row[11] else None,
                    "updated_at": row[12].isoformat() if row[12] else None,
                }
                for row in rows
            ]
