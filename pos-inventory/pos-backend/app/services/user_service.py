"""PostgreSQL-backed user management service."""

from __future__ import annotations

import importlib
import logging
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional

from app.core.config import settings
from app.core.security import get_password_hash, verify_password


logger = logging.getLogger(__name__)

USER_COLUMNS = (
    "id",
    "username",
    "email",
    "name",
    "password_hash",
    "role",
    "sap_user_code",
    "branch_id",
    "store_name",
    "created_at",
    "is_active",
)


def _get_psycopg2():
    try:
        return importlib.import_module("psycopg2")
    except ImportError as exc:
        raise RuntimeError(
            "PostgreSQL driver not installed. Install 'psycopg2-binary' for backend auth."
        ) from exc


def _require_database_url() -> str:
    database_url = (settings.DATABASE_URL or "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for PostgreSQL-backed user authentication.")
    return database_url


@contextmanager
def _get_connection() -> Iterator[Any]:
    psycopg2 = _get_psycopg2()
    conn = psycopg2.connect(_require_database_url())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _row_to_full_dict(row: tuple[Any, ...]) -> Dict[str, Any]:
    data = dict(zip(USER_COLUMNS, row))
    created_at = data.get("created_at")
    if isinstance(created_at, datetime):
        data["created_at"] = created_at.isoformat()
    return data


def _sanitize_user(row: tuple[Any, ...]) -> Dict[str, Any]:
    data = _row_to_full_dict(row)
    data.pop("password_hash", None)
    return data


def init_user_storage() -> None:
    """Create the users table if it does not already exist."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    password_hash TEXT NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'user',
                    sap_user_code TEXT NULL,
                    branch_id TEXT NULL,
                    store_name TEXT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE
                )
                """
            )


def _fetchone(query: str, params: tuple[Any, ...]) -> Optional[tuple[Any, ...]]:
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Authenticate user against PostgreSQL.
    Returns user dict (without password) if valid, None otherwise.
    """
    row = _fetchone(
        """
        SELECT id, username, email, name, password_hash, role, sap_user_code,
               branch_id, store_name, created_at, is_active
        FROM users
        WHERE username = %s OR email = %s
        LIMIT 1
        """,
        (username, username),
    )
    if not row:
        return None

    user = _row_to_full_dict(row)
    if not user.get("is_active", True):
        logger.warning("Login attempt for inactive user: %s", username)
        return None

    if not verify_password(password, user.get("password_hash", "")):
        return None

    user.pop("password_hash", None)
    return user


def create_user(
    username: str,
    email: str,
    password: str,
    name: str,
    role: str = "user",
    sap_user_code: Optional[str] = None,
    branch_id: Optional[str] = None,
    store_name: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Create a new user in PostgreSQL.
    Returns created user (without password) if successful, None if user exists.
    """
    username = username.strip()
    email = email.strip()
    name = name.strip()

    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM users WHERE username = %s OR email = %s LIMIT 1",
                (username, email),
            )
            if cur.fetchone():
                logger.warning("User already exists: %s", username)
                return None

            new_user = {
                "id": str(uuid.uuid4()),
                "username": username,
                "email": email,
                "name": name,
                "password_hash": get_password_hash(password),
                "role": role,
                "sap_user_code": sap_user_code,
                "branch_id": branch_id,
                "store_name": store_name,
                "created_at": datetime.utcnow(),
                "is_active": True,
            }
            cur.execute(
                """
                INSERT INTO users (
                    id, username, email, name, password_hash, role,
                    sap_user_code, branch_id, store_name, created_at, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    new_user["id"],
                    new_user["username"],
                    new_user["email"],
                    new_user["name"],
                    new_user["password_hash"],
                    new_user["role"],
                    new_user["sap_user_code"],
                    new_user["branch_id"],
                    new_user["store_name"],
                    new_user["created_at"],
                    new_user["is_active"],
                ),
            )

    logger.info("User created: %s", username)
    return {
        "id": new_user["id"],
        "username": new_user["username"],
        "email": new_user["email"],
        "name": new_user["name"],
        "role": new_user["role"],
        "sap_user_code": new_user["sap_user_code"],
        "branch_id": new_user["branch_id"],
        "store_name": new_user["store_name"],
        "created_at": new_user["created_at"].isoformat(),
        "is_active": new_user["is_active"],
    }


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username (without password)."""
    row = _fetchone(
        """
        SELECT id, username, email, name, password_hash, role, sap_user_code,
               branch_id, store_name, created_at, is_active
        FROM users
        WHERE username = %s
        LIMIT 1
        """,
        (username,),
    )
    return _sanitize_user(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user by ID (without password)."""
    row = _fetchone(
        """
        SELECT id, username, email, name, password_hash, role, sap_user_code,
               branch_id, store_name, created_at, is_active
        FROM users
        WHERE id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    return _sanitize_user(row) if row else None


def get_all_users() -> List[Dict[str, Any]]:
    """Get all users (without passwords)."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, email, name, password_hash, role, sap_user_code,
                       branch_id, store_name, created_at, is_active
                FROM users
                ORDER BY created_at ASC, username ASC
                """
            )
            rows = cur.fetchall()
    return [_sanitize_user(row) for row in rows]


def update_user(user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update user fields by ID.
    If 'password' is in updates, it will be hashed before saving.
    Returns updated user (without password) or None if not found.
    """
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, email, name, password_hash, role, sap_user_code,
                       branch_id, store_name, created_at, is_active
                FROM users
                WHERE id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                logger.warning("User not found for update: %s", user_id)
                return None

            current_user = _row_to_full_dict(row)

            if "username" in updates:
                new_username = str(updates.get("username") or "").strip()
                if new_username:
                    cur.execute(
                        "SELECT 1 FROM users WHERE id <> %s AND username = %s LIMIT 1",
                        (user_id, new_username),
                    )
                    if cur.fetchone():
                        raise ValueError("USERNAME_EXISTS")
                    updates["username"] = new_username

            if "email" in updates:
                new_email = str(updates.get("email") or "").strip()
                if new_email:
                    cur.execute(
                        "SELECT 1 FROM users WHERE id <> %s AND email = %s LIMIT 1",
                        (user_id, new_email),
                    )
                    if cur.fetchone():
                        raise ValueError("EMAIL_EXISTS")
                    updates["email"] = new_email

            if "new_password" in updates or "current_password" in updates:
                current_password = str(updates.pop("current_password", ""))
                new_password = str(updates.pop("new_password", ""))
                if not current_password or not new_password:
                    raise ValueError("PASSWORD_MISSING")
                if not verify_password(current_password, current_user.get("password_hash", "")):
                    raise ValueError("PASSWORD_MISMATCH")
                updates["password_hash"] = get_password_hash(new_password)

            if "password" in updates:
                raw = str(updates.pop("password"))
                updates["password_hash"] = get_password_hash(raw)

            allowed_fields = {
                "username",
                "email",
                "name",
                "role",
                "sap_user_code",
                "branch_id",
                "store_name",
                "is_active",
                "password_hash",
            }
            fields = [field for field in updates.keys() if field in allowed_fields]
            if not fields:
                return _sanitize_user(row)

            set_clause = ", ".join(f"{field} = %s" for field in fields)
            values = [updates[field] for field in fields]
            values.append(user_id)

            cur.execute(
                f"""
                UPDATE users
                SET {set_clause}
                WHERE id = %s
                """,
                tuple(values),
            )
            cur.execute(
                """
                SELECT id, username, email, name, password_hash, role, sap_user_code,
                       branch_id, store_name, created_at, is_active
                FROM users
                WHERE id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            updated_row = cur.fetchone()

    logger.info("User updated: %s", user_id)
    return _sanitize_user(updated_row) if updated_row else None


def deactivate_user(user_id: str) -> bool:
    """Deactivate a user by ID (soft delete). Returns True if successful."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET is_active = FALSE WHERE id = %s",
                (user_id,),
            )
            if cur.rowcount < 1:
                logger.warning("User not found for deactivation: %s", user_id)
                return False

    logger.info("User deactivated: %s", user_id)
    return True


def sync_sap_users(sap_users: List[Dict[str, Any]]) -> int:
    """
    Sync users from SAP to PostgreSQL.
    Returns number of users added/updated.
    """
    synced_count = 0

    with _get_connection() as conn:
        with conn.cursor() as cur:
            for sap_user in sap_users:
                sap_code = sap_user.get("UserCode")
                username = sap_user.get("UserName", sap_code)
                email = sap_user.get("Email", f"{username}@sap.local")
                name = sap_user.get("UserName", username)

                cur.execute(
                    """
                    SELECT id
                    FROM users
                    WHERE sap_user_code = %s
                    LIMIT 1
                    """,
                    (sap_code,),
                )
                existing = cur.fetchone()

                if existing:
                    cur.execute(
                        """
                        UPDATE users
                        SET username = %s, email = %s, name = %s
                        WHERE sap_user_code = %s
                        """,
                        (username, email, name, sap_code),
                    )
                    synced_count += 1
                    continue

                cur.execute(
                    """
                    INSERT INTO users (
                        id, username, email, name, password_hash, role,
                        sap_user_code, branch_id, store_name, created_at, is_active
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        username,
                        email,
                        name,
                        get_password_hash("Welcome@123"),
                        "user",
                        sap_code,
                        None,
                        None,
                        datetime.utcnow(),
                        True,
                    ),
                )
                synced_count += 1

    logger.info("Synced %s users from SAP", synced_count)
    return synced_count
