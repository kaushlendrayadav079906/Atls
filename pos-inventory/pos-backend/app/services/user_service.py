"""PostgreSQL-backed user management and role-based permissions service."""

from __future__ import annotations

import importlib
import json
import logging
import re
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional, Set

from app.core.config import settings
from app.core.security import get_password_hash, verify_password


logger = logging.getLogger(__name__)

PHONE_REGEX = re.compile(r"^\+?[0-9\s\-\.\(\)]{7,25}$")


def normalize_phone_number(phone: str) -> str:
    """
    Validate and normalize phone number into standard clean format.
    Accepts international and local formats: +91 9876543210, (555) 123-4567, 9876543210, etc.
    Requires between 7 and 15 digits.
    """
    if not phone or not isinstance(phone, str):
        raise ValueError("Phone number is required.")

    stripped = phone.strip()
    if not PHONE_REGEX.match(stripped):
        raise ValueError("Invalid phone number format. Contains unsupported characters.")

    has_plus = stripped.startswith("+")
    digits = re.sub(r"\D", "", stripped)

    if len(digits) < 7 or len(digits) > 15:
        raise ValueError("Phone number must contain between 7 and 15 digits.")

    return f"+{digits}" if has_plus else digits


def validate_job_role(job_role: str) -> str:
    """
    Validate job role / designation.
    Disallows attempting to claim administrator role through job designation.
    """
    if not job_role or not isinstance(job_role, str):
        raise ValueError("Job role / designation is required.")

    cleaned = job_role.strip()
    if len(cleaned) < 2 or len(cleaned) > 100:
        raise ValueError("Job role must be between 2 and 100 characters.")

    # Security guard: disallow claiming administrator via job designation string
    if cleaned.lower() in ("admin", "administrator", "superadmin", "system administrator"):
        raise ValueError("Administrator designations cannot be registered publicly.")

    return cleaned


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
    "token_version",
    "phone",
    "job_role",
)

# Standard permissions catalog
STANDARD_PERMISSIONS: List[Dict[str, str]] = [
    # Dashboard
    {"id": "dashboard.view", "module": "Dashboard", "action": "view", "description": "View main executive dashboard"},
    # Products & Inventory
    {"id": "products.view", "module": "Products", "action": "view", "description": "View product catalog and stock levels"},
    {"id": "products.create", "module": "Products", "action": "create", "description": "Create new products"},
    {"id": "products.edit", "module": "Products", "action": "edit", "description": "Edit existing products and prices"},
    {"id": "products.delete", "module": "Products", "action": "delete", "description": "Delete or archive products"},
    {"id": "products.export", "module": "Products", "action": "export", "description": "Export product and stock reports"},
    # Point of Sale
    {"id": "pos.access", "module": "POS", "action": "access", "description": "Access POS checkout terminal"},
    {"id": "pos.checkout", "module": "POS", "action": "checkout", "description": "Process sales orders and payments at POS"},
    # Sales Orders
    {"id": "sales_orders.view", "module": "Sales Orders", "action": "view", "description": "View sales orders"},
    {"id": "sales_orders.create", "module": "Sales Orders", "action": "create", "description": "Create customer sales orders"},
    {"id": "sales_orders.edit", "module": "Sales Orders", "action": "edit", "description": "Edit customer sales orders"},
    {"id": "sales_orders.export", "module": "Sales Orders", "action": "export", "description": "Export sales orders"},
    # Sales Invoices
    {"id": "invoices.view", "module": "Invoices", "action": "view", "description": "View sales invoices and billing records"},
    {"id": "invoices.create", "module": "Invoices", "action": "create", "description": "Create and post invoices to SAP"},
    {"id": "invoices.edit", "module": "Invoices", "action": "edit", "description": "Edit invoice remarks and metadata"},
    {"id": "invoices.export", "module": "Invoices", "action": "export", "description": "Export invoices and billing reports"},
    # Purchase Orders
    {"id": "purchase_orders.view", "module": "Purchase Orders", "action": "view", "description": "View vendor purchase orders"},
    {"id": "purchase_orders.create", "module": "Purchase Orders", "action": "create", "description": "Create vendor purchase orders"},
    {"id": "purchase_orders.edit", "module": "Purchase Orders", "action": "edit", "description": "Edit vendor purchase orders"},
    {"id": "purchase_orders.export", "module": "Purchase Orders", "action": "export", "description": "Export purchase order reports"},
    # Customers
    {"id": "customers.view", "module": "Customers", "action": "view", "description": "View customer records and histories"},
    {"id": "customers.create", "module": "Customers", "action": "create", "description": "Add new customer profiles"},
    {"id": "customers.edit", "module": "Customers", "action": "edit", "description": "Edit customer profile details"},
    # Returns & Approvals
    {"id": "returns.view", "module": "Returns", "action": "view", "description": "View return requests and credit notes"},
    {"id": "returns.create", "module": "Returns", "action": "create", "description": "Submit return and exchange requests"},
    {"id": "returns.approve", "module": "Returns", "action": "approve", "description": "Approve or reject customer refund requests"},
    {"id": "returns.process", "module": "Returns", "action": "process", "description": "Execute approved returns to SAP"},
    # Production
    {"id": "production.view", "module": "Production", "action": "view", "description": "View production status and dashboards"},
    {"id": "production.orders.view", "module": "Production", "action": "orders_view", "description": "View production work orders"},
    {"id": "production.reports.view", "module": "Production", "action": "reports_view", "description": "View production scrap/yield reports"},
    # Finance
    {"id": "finance.view", "module": "Finance", "action": "view", "description": "View finance overview and analytics"},
    {"id": "finance.invoices.view", "module": "Finance", "action": "invoices_view", "description": "View accounts payable purchase invoices"},
    {"id": "finance.payments.view", "module": "Finance", "action": "payments_view", "description": "View incoming and outgoing payments"},
    {"id": "finance.reports.view", "module": "Finance", "action": "reports_view", "description": "View financial aging and profitability reports"},
    # Reports
    {"id": "reports.view", "module": "Reports", "action": "view", "description": "Access reports hub and report viewers"},
    {"id": "reports.export", "module": "Reports", "action": "export", "description": "Export analytical reports to XLSX/CSV"},
    # Settings & Administration
    {"id": "settings.view", "module": "Settings", "action": "view", "description": "Access settings and administrative area"},
    {"id": "users.manage", "module": "Settings", "action": "users_manage", "description": "Create, edit, activate, deactivate users"},
    {"id": "roles.manage", "module": "Settings", "action": "roles_manage", "description": "Manage user role assignments"},
    {"id": "permissions.manage", "module": "Settings", "action": "permissions_manage", "description": "Manage granular module and action permissions"},
    # Email Communications
    {"id": "email.send", "module": "Email", "action": "send", "description": "Draft, approve, and dispatch operational emails to customers and vendors"},
]

DEFAULT_ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "user": [
        "dashboard.view",
        "pos.access",
        "pos.checkout",
        "products.view",
        "sales_orders.view",
        "sales_orders.create",
        "invoices.view",
        "invoices.create",
        "customers.view",
        "customers.create",
        "returns.view",
        "returns.create",
    ],
    "operator": [
        "dashboard.view",
        "pos.access",
        "pos.checkout",
        "products.view",
        "products.export",
        "sales_orders.view",
        "sales_orders.create",
        "invoices.view",
        "invoices.create",
        "customers.view",
        "customers.create",
        "returns.view",
        "returns.create",
    ],
    "manager": [
        "dashboard.view",
        "products.view",
        "products.create",
        "products.edit",
        "products.export",
        "pos.access",
        "pos.checkout",
        "sales_orders.view",
        "sales_orders.create",
        "sales_orders.edit",
        "sales_orders.export",
        "invoices.view",
        "invoices.create",
        "invoices.edit",
        "invoices.export",
        "purchase_orders.view",
        "purchase_orders.create",
        "purchase_orders.edit",
        "purchase_orders.export",
        "customers.view",
        "customers.create",
        "customers.edit",
        "returns.view",
        "returns.create",
        "returns.approve",
        "returns.process",
        "production.view",
        "production.orders.view",
        "production.reports.view",
        "finance.view",
        "finance.invoices.view",
        "finance.payments.view",
        "finance.reports.view",
        "reports.view",
        "reports.export",
        "email.send",
    ],
    "admin": [p["id"] for p in STANDARD_PERMISSIONS],
}


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
    if data.get("token_version") is None:
        data["token_version"] = 1
    return data


def _sanitize_user(row: tuple[Any, ...]) -> Dict[str, Any]:
    data = _row_to_full_dict(row)
    data.pop("password_hash", None)
    user_id = data.get("id")
    role = data.get("role", "user")
    if user_id:
        data["permissions"] = get_effective_permissions(user_id, role)
    else:
        data["permissions"] = []
    return data


def _count_active_admins(cur) -> int:
    cur.execute("SELECT COUNT(*) FROM users WHERE LOWER(role) IN ('admin', 'administrator') AND is_active = TRUE")
    row = cur.fetchone()
    return int(row[0]) if row else 0


def log_security_event(
    action: str,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Record a security event in the security_audit_logs table."""
    try:
        details_str = json.dumps(details or {}) if details is not None else None
        event_id = str(uuid.uuid4())
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO security_audit_logs (
                        id, user_id, username, action, resource_type,
                        resource_id, details, ip_address, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        event_id,
                        user_id,
                        username,
                        action,
                        resource_type,
                        resource_id,
                        details_str,
                        ip_address,
                        datetime.utcnow(),
                    ),
                )
    except Exception as exc:
        logger.error(f"Failed to write security audit log ({action}): {exc}")


def get_security_audit_logs(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    """Retrieve security audit logs."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, user_id, username, action, resource_type,
                       resource_id, details, ip_address, created_at
                FROM security_audit_logs
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
            rows = cur.fetchall()
            logs = []
            for row in rows:
                dt = row[8]
                logs.append(
                    {
                        "id": row[0],
                        "user_id": row[1],
                        "username": row[2],
                        "action": row[3],
                        "resource_type": row[4],
                        "resource_id": row[5],
                        "details": row[6],
                        "ip_address": row[7],
                        "created_at": dt.isoformat() if isinstance(dt, datetime) else str(dt),
                    }
                )
            return logs


def init_user_storage() -> None:
    """Create the users and permissions tables if they do not already exist, and run safe migrations."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            # 1. Base Users Table
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
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    token_version INT NOT NULL DEFAULT 1,
                    phone VARCHAR(30) NULL,
                    job_role VARCHAR(100) NULL
                )
                """
            )
            # Safe column migration in case users table existed without token_version, phone, or job_role
            cur.execute(
                """
                ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS job_role VARCHAR(100) NULL;
                """
            )

            # 2. Roles Table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS roles (
                    name VARCHAR(50) PRIMARY KEY,
                    description TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            # 3. Permissions Catalog Table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS permissions (
                    id VARCHAR(100) PRIMARY KEY,
                    module VARCHAR(50) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    description TEXT
                )
                """
            )

            # 4. Role Permissions Mapping Table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS role_permissions (
                    role_name VARCHAR(50) REFERENCES roles(name) ON DELETE CASCADE,
                    permission_id VARCHAR(100) REFERENCES permissions(id) ON DELETE CASCADE,
                    PRIMARY KEY (role_name, permission_id)
                )
                """
            )

            # 5. User Granular Permissions Mapping Table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user_permissions (
                    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                    permission_id VARCHAR(100) REFERENCES permissions(id) ON DELETE CASCADE,
                    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
                    PRIMARY KEY (user_id, permission_id)
                )
                """
            )

            # 6. Security Audit Logs Table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS security_audit_logs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NULL,
                    username TEXT NULL,
                    action VARCHAR(100) NOT NULL,
                    resource_type VARCHAR(50) NULL,
                    resource_id TEXT NULL,
                    details TEXT NULL,
                    ip_address VARCHAR(50) NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            # 7. Email Audit Logs Table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS email_audit_logs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NULL,
                    username VARCHAR(100) NULL,
                    recipient_email VARCHAR(255) NOT NULL,
                    recipient_name VARCHAR(255) NULL,
                    subject VARCHAR(500) NOT NULL,
                    purpose VARCHAR(100) NOT NULL,
                    record_type VARCHAR(50) NULL,
                    record_id VARCHAR(100) NULL,
                    status VARCHAR(50) NOT NULL,
                    provider VARCHAR(50) NOT NULL,
                    provider_message_id VARCHAR(255) NULL,
                    error_message TEXT NULL,
                    idempotency_key VARCHAR(128) NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_email_audit_recipient ON email_audit_logs (recipient_email);
                CREATE INDEX IF NOT EXISTS idx_email_audit_created ON email_audit_logs (created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_email_audit_idempotency ON email_audit_logs (idempotency_key);
                """
            )

            # Seed Roles
            roles_to_seed = [
                ("admin", "Full administrative access with user and permission control"),
                ("manager", "Operations manager with elevated approvals, reports, and financial access"),
                ("operator", "Operational staff with POS and inventory export privileges"),
                ("user", "Base cashier / employee with POS and sales invoicing access"),
            ]
            for role_name, desc in roles_to_seed:
                cur.execute(
                    """
                    INSERT INTO roles (name, description)
                    VALUES (%s, %s)
                    ON CONFLICT (name) DO NOTHING
                    """,
                    (role_name, desc),
                )

            # Seed Permissions Catalog
            for perm in STANDARD_PERMISSIONS:
                cur.execute(
                    """
                    INSERT INTO permissions (id, module, action, description)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE
                    SET module = EXCLUDED.module,
                        action = EXCLUDED.action,
                        description = EXCLUDED.description
                    """,
                    (perm["id"], perm["module"], perm["action"], perm["description"]),
                )

            # Seed Default Role Permissions
            for role_name, perm_ids in DEFAULT_ROLE_PERMISSIONS.items():
                for perm_id in perm_ids:
                    cur.execute(
                        """
                        INSERT INTO role_permissions (role_name, permission_id)
                        VALUES (%s, %s)
                        ON CONFLICT (role_name, permission_id) DO NOTHING
                        """,
                        (role_name, perm_id),
                    )

    logger.info("User and permission storage initialized with standard catalog.")
    ensure_bootstrap_admin()


def ensure_bootstrap_admin() -> Optional[Dict[str, Any]]:
    """
    Ensure at least one active administrator exists in PostgreSQL.

    Safe Bootstrap Rules:
    1. Acquire transaction-level advisory lock to serialize concurrent worker startups.
    2. If an active administrator already exists, make no changes to any account.
    3. Read ADMIN_EMAIL and ADMIN_PASSWORD only from backend settings (.env).
       If either is missing or empty, skip automatic creation safely.
    4. If password is shorter than 8 characters, log warning and skip creation safely.
    5. If the configured email already belongs to an existing user, do not change that
       user's role or password automatically. Report the conflict without exposing secrets.
    6. Create a dedicated Admin account only when no active administrator exists and
       the configured email is unused.
    7. Hash password with the existing PBKDF2-SHA256 password-hashing implementation.
    8. Create the account transactionally and record an INITIAL_ADMIN_CREATED security audit event.
    """
    try:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Acquire transaction-scoped advisory lock to serialize concurrent worker startups
                try:
                    cur.execute("SELECT pg_advisory_xact_lock(hashtext('atlas_admin_bootstrap'))")
                except Exception as lock_err:
                    logger.debug("Advisory lock skipped or unsupported: %s", lock_err)

                # 2. Check if an active administrator already exists
                active_count = _count_active_admins(cur)
                if active_count > 0:
                    logger.info(
                        "Active administrator account(s) already exist in database (%d active). "
                        "Automatic initial admin bootstrap skipped to protect existing credentials. "
                        "To rotate administrator credentials, use 'python scripts/bootstrap_admin.py' or the Admin Settings UI.",
                        active_count,
                    )
                    return None

                # 3. Read ADMIN_EMAIL and ADMIN_PASSWORD only from settings
                admin_email = (getattr(settings, "ADMIN_EMAIL", "") or "").strip()
                admin_password = (getattr(settings, "ADMIN_PASSWORD", "") or "").strip()

                if not admin_email or not admin_password:
                    logger.info(
                        "No active administrator exists, but ADMIN_EMAIL and ADMIN_PASSWORD are not configured. "
                        "Skipping initial admin creation safely."
                    )
                    return None

                # 4. Enforce minimum password strength (at least 8 characters)
                if len(admin_password) < 8:
                    logger.warning(
                        "ADMIN_PASSWORD must be at least 8 characters. Initial admin creation skipped safely."
                    )
                    return None

                # 5. Check if configured email belongs to ANY existing user
                cur.execute(
                    "SELECT id, username, role, is_active FROM users WHERE LOWER(email) = LOWER(%s) LIMIT 1",
                    (admin_email,),
                )
                existing_email_user = cur.fetchone()
                if existing_email_user:
                    logger.warning(
                        "Configured ADMIN_EMAIL (%s) belongs to an existing user account '%s'. "
                        "Automatic role escalation or password reset is strictly prohibited. "
                        "Initial admin creation aborted to protect existing accounts.",
                        admin_email,
                        existing_email_user[1],
                    )
                    log_security_event(
                        action="BOOTSTRAP_ADMIN_CONFLICT_EMAIL_EXISTS",
                        username=existing_email_user[1],
                        resource_type="user",
                        resource_id=existing_email_user[0],
                        details={
                            "email": admin_email,
                            "reason": "email_already_registered",
                        },
                    )
                    return None

                # 6. Derive unique username (from ADMIN_USERNAME or email prefix)
                admin_username = (getattr(settings, "ADMIN_USERNAME", "") or "").strip()
                if not admin_username:
                    admin_username = admin_email.split("@")[0].lower()

                # Ensure username is unique
                cur.execute(
                    "SELECT id FROM users WHERE LOWER(username) = LOWER(%s) LIMIT 1",
                    (admin_username,),
                )
                if cur.fetchone():
                    admin_username = f"{admin_username}_admin"
                    cur.execute(
                        "SELECT id FROM users WHERE LOWER(username) = LOWER(%s) LIMIT 1",
                        (admin_username,),
                    )
                    if cur.fetchone():
                        admin_username = f"admin_{uuid.uuid4().hex[:6]}"

                admin_name = (getattr(settings, "ADMIN_NAME", "") or "").strip() or "System Administrator"

                # 7. Hash password using PBKDF2-SHA256
                pwd_hash = get_password_hash(admin_password)
                new_id = str(uuid.uuid4())

                # 8. Create account transactionally
                cur.execute(
                    """
                    INSERT INTO users (
                        id, username, email, name, password_hash, role,
                        sap_user_code, branch_id, store_name, created_at, is_active, token_version,
                        phone, job_role
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        new_id,
                        admin_username,
                        admin_email,
                        admin_name,
                        pwd_hash,
                        "admin",
                        None,
                        None,
                        "Main Headquarter",
                        datetime.utcnow(),
                        True,
                        1,
                        None,
                        "System Administrator",
                    ),
                )

                # 9. Record security audit log
                log_security_event(
                    action="INITIAL_ADMIN_CREATED",
                    user_id=new_id,
                    username=admin_username,
                    resource_type="user",
                    resource_id=new_id,
                    details={
                        "email": admin_email,
                        "role": "admin",
                        "source": "backend_env_bootstrap",
                    },
                )
                logger.info(
                    "Dedicated initial administrator created successfully: username='%s', email='%s'",
                    admin_username,
                    admin_email,
                )
                return {
                    "id": new_id,
                    "username": admin_username,
                    "email": admin_email,
                    "role": "admin",
                }
    except Exception as exc:
        logger.error("Error during administrator bootstrap check: %s", exc)
        return None


def _fetchone(query: str, params: tuple[Any, ...]) -> Optional[tuple[Any, ...]]:
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()


def get_all_permissions() -> List[Dict[str, str]]:
    """Return the entire catalog of system permissions."""
    return STANDARD_PERMISSIONS


def get_all_roles() -> List[Dict[str, Any]]:
    """Return all roles and their default permission identifiers."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name, description FROM roles ORDER BY name ASC")
            roles_data = cur.fetchall()

            result = []
            for r_name, r_desc in roles_data:
                perms = DEFAULT_ROLE_PERMISSIONS.get(r_name.lower(), [])
                result.append(
                    {
                        "name": r_name,
                        "description": r_desc,
                        "permissions": perms,
                    }
                )
            return result


def get_effective_permissions(user_id: str, role: str) -> List[str]:
    """
    Calculate effective permissions for a user.
    - Admins receive ALL standard permissions.
    - Other roles receive Role Permissions + Granted User Overrides - Denied User Overrides.
    """
    normalized_role = (role or "user").lower().strip()
    if normalized_role in ("admin", "administrator"):
        return sorted([p["id"] for p in STANDARD_PERMISSIONS])

    try:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Fetch role permissions
                cur.execute(
                    "SELECT permission_id FROM role_permissions WHERE role_name = %s",
                    (normalized_role,),
                )
                effective: Set[str] = {row[0] for row in cur.fetchall()}

                # Fallback to in-memory defaults if table is empty
                if not effective and normalized_role in DEFAULT_ROLE_PERMISSIONS:
                    effective.update(DEFAULT_ROLE_PERMISSIONS[normalized_role])

                # 2. Fetch custom user permission overrides
                cur.execute(
                    "SELECT permission_id, is_granted FROM user_permissions WHERE user_id = %s",
                    (user_id,),
                )
                for perm_id, is_granted in cur.fetchall():
                    if is_granted:
                        effective.add(perm_id)
                    else:
                        effective.discard(perm_id)

                return sorted(list(effective))
    except Exception as exc:
        logger.error(f"Error calculating permissions for user {user_id}: {exc}")
        # Safe fallback to role defaults
        return sorted(DEFAULT_ROLE_PERMISSIONS.get(normalized_role, []))


def get_user_permissions(user_id: str) -> Dict[str, Any]:
    """Retrieve granted and denied granular permissions for a user."""
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("USER_NOT_FOUND")

    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT permission_id, is_granted FROM user_permissions WHERE user_id = %s",
                (user_id,),
            )
            grants = []
            revocations = []
            for perm_id, is_granted in cur.fetchall():
                if is_granted:
                    grants.append(perm_id)
                else:
                    revocations.append(perm_id)

            effective = get_effective_permissions(user_id, user.get("role", "user"))
            return {
                "user_id": user_id,
                "role": user.get("role"),
                "effective_permissions": effective,
                "custom_grants": grants,
                "custom_revocations": revocations,
            }


def set_user_permissions(
    user_id: str,
    permissions: List[str],
    admin_user_id: Optional[str] = None,
) -> List[str]:
    """
    Set custom granted permissions for an employee.
    Updates user_permissions transactionally, increments token_version to invalidate stale sessions,
    and logs a security audit event.
    """
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("USER_NOT_FOUND")

    # Validate against known permissions catalog
    valid_ids = {p["id"] for p in STANDARD_PERMISSIONS}
    cleaned_permissions = [p for p in set(permissions) if p in valid_ids]

    with _get_connection() as conn:
        with conn.cursor() as cur:
            # Clear existing overrides
            cur.execute("DELETE FROM user_permissions WHERE user_id = %s", (user_id,))

            # Insert new grants
            for perm_id in cleaned_permissions:
                cur.execute(
                    """
                    INSERT INTO user_permissions (user_id, permission_id, is_granted)
                    VALUES (%s, %s, TRUE)
                    """,
                    (user_id, perm_id),
                )

            # Invalidate cached tokens by bumping token_version
            cur.execute(
                "UPDATE users SET token_version = token_version + 1 WHERE id = %s",
                (user_id,),
            )

    log_security_event(
        action="PERMISSIONS_UPDATED",
        user_id=admin_user_id,
        username=user.get("username"),
        resource_type="user",
        resource_id=user_id,
        details={"permissions_count": len(cleaned_permissions), "permissions": cleaned_permissions},
    )

    return get_effective_permissions(user_id, user.get("role", "user"))


def revoke_user_sessions(user_id: str, admin_user_id: Optional[str] = None) -> bool:
    """Increment token_version to immediately invalidate all active JWT tokens for this user."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET token_version = token_version + 1 WHERE id = %s",
                (user_id,),
            )
            if cur.rowcount < 1:
                return False

    log_security_event(
        action="SESSION_REVOKED",
        user_id=admin_user_id,
        resource_type="user",
        resource_id=user_id,
    )
    return True


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Authenticate user against PostgreSQL.
    Accepts username or email as identifier (case-insensitively).
    If multiple accounts share the same case-insensitive handle (e.g. Admin vs admin),
    prioritizes exact-case match, and verifies credentials safely across matching candidates.
    """
    identifier = username.strip()
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, email, name, password_hash, role, sap_user_code,
                       branch_id, store_name, created_at, is_active, token_version,
                       phone, job_role
                FROM users
                WHERE LOWER(username) = LOWER(%s) OR LOWER(email) = LOWER(%s)
                ORDER BY
                    CASE
                        WHEN username = %s THEN 0
                        WHEN LOWER(email) = LOWER(%s) THEN 1
                        WHEN LOWER(username) = LOWER(%s) THEN 2
                        ELSE 3
                    END,
                    created_at DESC
                """,
                (identifier, identifier, identifier, identifier, identifier),
            )
            rows = cur.fetchall()

    if not rows:
        logger.warning("Login authentication failed: identifier '%s' not found in PostgreSQL users", identifier)
        log_security_event(
            action="LOGIN_FAILED_NOT_FOUND",
            username=identifier,
            details={"reason": "user_not_found"},
        )
        return None

    # Check each candidate matching the identifier (exact-case matches checked first)
    matched_inactive = False
    for row in rows:
        user = _row_to_full_dict(row)
        if not user.get("is_active", True):
            matched_inactive = True
            continue

        if verify_password(password, user.get("password_hash", "")):
            user.pop("password_hash", None)
            user["permissions"] = get_effective_permissions(user["id"], user.get("role", "user"))

            log_security_event(
                action="LOGIN_SUCCESS",
                user_id=user.get("id"),
                username=user.get("username"),
                details={"role": user.get("role")},
            )
            logger.info("Login authentication successful: username='%s', role='%s'", user["username"], user.get("role"))
            return user

    if matched_inactive:
        logger.warning("Login authentication rejected: account deactivated for identifier '%s'", identifier)
        log_security_event(
            action="LOGIN_FAILED_DEACTIVATED",
            username=identifier,
            details={"reason": "account_deactivated"},
        )
        raise ValueError("ACCOUNT_DEACTIVATED")

    logger.warning("Login authentication failed: password mismatch for identifier '%s'", identifier)
    log_security_event(
        action="LOGIN_FAILED_CREDENTIALS",
        username=identifier,
        details={"reason": "invalid_password"},
    )
    return None


def create_user(
    username: str,
    email: str,
    password: str,
    name: str,
    role: str = "user",
    sap_user_code: Optional[str] = None,
    branch_id: Optional[str] = None,
    store_name: Optional[str] = None,
    phone: Optional[str] = None,
    job_role: Optional[str] = None,
    admin_user_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Create a new user in PostgreSQL.
    Returns created user dict (without password).
    """
    username = username.strip()
    email = email.strip()
    name = name.strip()
    normalized_role = role.lower().strip()

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
                "role": normalized_role,
                "sap_user_code": sap_user_code,
                "branch_id": branch_id,
                "store_name": store_name,
                "created_at": datetime.utcnow(),
                "is_active": True,
                "token_version": 1,
                "phone": phone,
                "job_role": job_role,
            }
            cur.execute(
                """
                INSERT INTO users (
                    id, username, email, name, password_hash, role,
                    sap_user_code, branch_id, store_name, created_at, is_active, token_version,
                    phone, job_role
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    new_user["token_version"],
                    new_user["phone"],
                    new_user["job_role"],
                ),
            )

    log_security_event(
        action="USER_CREATED",
        user_id=admin_user_id,
        username=username,
        resource_type="user",
        resource_id=new_user["id"],
        details={"role": normalized_role, "branch_id": branch_id},
    )

    logger.info("User created: %s (%s)", username, normalized_role)
    new_user["permissions"] = get_effective_permissions(new_user["id"], normalized_role)
    new_user.pop("password_hash", None)
    new_user["created_at"] = new_user["created_at"].isoformat()
    return new_user


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username (without password)."""
    row = _fetchone(
        """
        SELECT id, username, email, name, password_hash, role, sap_user_code,
               branch_id, store_name, created_at, is_active, token_version,
               phone, job_role
        FROM users
        WHERE username = %s
        LIMIT 1
        """,
        (username,),
    )
    return _sanitize_user(row) if row else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email (case-insensitive, without password)."""
    row = _fetchone(
        """
        SELECT id, username, email, name, password_hash, role, sap_user_code,
               branch_id, store_name, created_at, is_active, token_version,
               phone, job_role
        FROM users
        WHERE LOWER(email) = LOWER(%s)
        LIMIT 1
        """,
        (email.strip(),),
    )
    return _sanitize_user(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user by ID (without password)."""
    row = _fetchone(
        """
        SELECT id, username, email, name, password_hash, role, sap_user_code,
               branch_id, store_name, created_at, is_active, token_version,
               phone, job_role
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
                       branch_id, store_name, created_at, is_active, token_version,
                       phone, job_role
                FROM users
                ORDER BY created_at ASC, username ASC
                """
            )
            rows = cur.fetchall()
    return [_sanitize_user(row) for row in rows]


def update_user(
    user_id: str,
    updates: Dict[str, Any],
    admin_user_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Update user fields by ID with Last-Admin protection.
    If 'password' is in updates, it will be hashed and token_version incremented.
    """
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, email, name, password_hash, role, sap_user_code,
                       branch_id, store_name, created_at, is_active, token_version,
                       phone, job_role
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
            curr_role = (current_user.get("role") or "").lower()
            curr_active = bool(current_user.get("is_active", True))

            # Last Admin Safety Check
            if curr_role == "admin" and curr_active:
                if "role" in updates and str(updates["role"]).lower() != "admin":
                    if _count_active_admins(cur) <= 1:
                        raise ValueError("CANNOT_DEMOTE_LAST_ADMIN")
                if "is_active" in updates and updates["is_active"] is False:
                    if _count_active_admins(cur) <= 1:
                        raise ValueError("CANNOT_DEACTIVATE_LAST_ADMIN")

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

            token_bump = False
            if "new_password" in updates or "current_password" in updates:
                current_password = str(updates.pop("current_password", ""))
                new_password = str(updates.pop("new_password", ""))
                if not current_password or not new_password:
                    raise ValueError("PASSWORD_MISSING")
                if not verify_password(current_password, current_user.get("password_hash", "")):
                    raise ValueError("PASSWORD_MISMATCH")
                updates["password_hash"] = get_password_hash(new_password)
                token_bump = True

            if "password" in updates:
                raw = str(updates.pop("password"))
                updates["password_hash"] = get_password_hash(raw)
                token_bump = True

            if "role" in updates or "is_active" in updates:
                token_bump = True

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
                "phone",
                "job_role",
            }
            fields = [field for field in updates.keys() if field in allowed_fields]

            if token_bump:
                fields.append("token_version")
                updates["token_version"] = current_user.get("token_version", 1) + 1

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
                       branch_id, store_name, created_at, is_active, token_version,
                       phone, job_role
                FROM users
                WHERE id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            updated_row = cur.fetchone()

    log_security_event(
        action="USER_UPDATED",
        user_id=admin_user_id,
        username=current_user.get("username"),
        resource_type="user",
        resource_id=user_id,
        details={"updated_fields": [f for f in fields if f != "password_hash"]},
    )
    logger.info("User updated: %s", user_id)
    return _sanitize_user(updated_row) if updated_row else None


def deactivate_user(user_id: str, admin_user_id: Optional[str] = None) -> bool:
    """Deactivate a user with Last-Admin protection and session revocation."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT role, is_active FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row:
                logger.warning("User not found for deactivation: %s", user_id)
                return False

            role, is_active = row
            if str(role).lower() == "admin" and is_active:
                if _count_active_admins(cur) <= 1:
                    raise ValueError("CANNOT_DEACTIVATE_LAST_ADMIN")

            cur.execute(
                "UPDATE users SET is_active = FALSE, token_version = token_version + 1 WHERE id = %s",
                (user_id,),
            )
            if cur.rowcount < 1:
                return False

    log_security_event(
        action="ACCOUNT_DEACTIVATED",
        user_id=admin_user_id,
        resource_type="user",
        resource_id=user_id,
    )
    logger.info("User deactivated: %s", user_id)
    return True


def activate_user(user_id: str, admin_user_id: Optional[str] = None) -> bool:
    """Reactivate a user."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET is_active = TRUE, token_version = token_version + 1 WHERE id = %s",
                (user_id,),
            )
            if cur.rowcount < 1:
                return False

    log_security_event(
        action="ACCOUNT_ACTIVATED",
        user_id=admin_user_id,
        resource_type="user",
        resource_id=user_id,
    )
    logger.info("User activated: %s", user_id)
    return True


def sync_sap_users(sap_users: List[Dict[str, Any]]) -> int:
    """Sync users from SAP to PostgreSQL."""
    synced_count = 0

    with _get_connection() as conn:
        with conn.cursor() as cur:
            for sap_user in sap_users:
                sap_code = sap_user.get("UserCode")
                username = sap_user.get("UserName", sap_code)
                email = sap_user.get("Email", f"{username}@sap.local")
                name = sap_user.get("UserName", username)

                cur.execute(
                    "SELECT id FROM users WHERE sap_user_code = %s LIMIT 1",
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
                        sap_user_code, branch_id, store_name, created_at, is_active, token_version
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                        1,
                    ),
                )
                synced_count += 1

    logger.info("Synced %s users from SAP", synced_count)
    return synced_count
