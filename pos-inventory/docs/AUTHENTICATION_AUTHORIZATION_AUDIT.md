# ATLAS POS & ERP — Authentication & Authorization Security Audit

**Document Version:** 1.0.0  
**Audit Date:** October 2026  
**Auditor:** Senior Full-Stack Security Auditor  
**Application Scope:** ATLAS Point of Sale, Inventory, Sales, Production, Finance, Analytics, Reports, AI Assistant, and SAP Business One Service Layer Integration.

---

## 1. Executive Summary

This security audit assesses the authentication and role-based access control (RBAC) architecture of ATLAS across both the frontend React/TypeScript application (`Dashboard-Ui`) and the backend FastAPI service (`pos-backend`). 

ATLAS handles critical business operations—point of sale transactions, inventory tracking, accounts receivable/payable, incoming/outgoing payments, manufacturing production orders, and analytical reporting connected to SAP Business One. Ensuring least-privilege enforcement, server-side permission validation, and robust session lifecycle management is vital to preventing unauthorized operational and financial data exposure.

### Key Audit Findings

| Category | Initial Status | Risk Level | Summary of Finding |
| :--- | :--- | :--- | :--- |
| **Authentication Flow** | **Partially Implemented** | **Medium** | Single login exists with PBKDF2-SHA256 password hashing. However, public registration endpoint allowed role assignment, and development bypass (`DEV_PREVIEW`) existed in the frontend router. |
| **Session & Token Security** | **Vulnerable** | **High** | JWT tokens were issued with 24-hour expiration without server-side revocation tracking. Logging out or deactivating an account did not invalidate active tokens. |
| **Granular Authorization** | **Missing** | **Critical** | Only coarse role checks (`require_admin`, `require_manager_or_admin`) existed on a few endpoints. Granular module/action permissions (View, Create, Edit, Delete, Export, Approve) were not enforced on business APIs. |
| **Frontend Route Guards** | **Inadequate** | **High** | ProtectedRoute only checked authentication presence; child routes were completely unguarded. Any logged-in cashier could access `/settings`, `/finance`, and `/production` by typing URLs. |
| **Dynamic Sidebar** | **Missing** | **Medium** | The navigation sidebar rendered all sections regardless of user role or assigned permissions. |
| **AI Assistant Authorization** | **Incomplete** | **High** | The AI assistant tool dispatch executed backend queries based on requested branch, but did not gate tool executions by the user's module permissions (e.g., an unauthorized cashier could query finance summaries via AI). |
| **Audit Logging** | **Incomplete** | **Medium** | Application logs logged requests, but there was no structured security audit table tracking auth failures, permission changes, role alterations, or account deactivations. |

---

## 2. Existing Architecture Analysis

### 2.1 Backend Architecture (`pos-backend`)
- **Framework:** FastAPI with Uvicorn.
- **Database:** PostgreSQL (`pos_db`) with `users` and `approval_requests` tables.
- **Authentication Service:** `app/services/user_service.py` using raw SQL with `psycopg2`.
- **Password Hashing:** `passlib.context.CryptContext` using `pbkdf2_sha256` (secure, resistant to GPU attacks, no 72-byte truncation limitation).
- **Token Mechanism:** Python-jose JWT (`HS256`), signing user identifier, email, role, and branch ID.
- **SAP Service Layer Integration:** `app/services/sap/client.py` connecting via HTTP with session cookie reuse and circuit breaker.
- **Finance Write-Back Safeguard:** Backend configuration includes `FINANCE_WRITEBACK_ENABLED=False` to strictly forbid SAP write mutations on financial records.

### 2.2 Frontend Architecture (`Dashboard-Ui`)
- **Framework:** React 19, TypeScript, Vite, TailwindCSS.
- **Routing:** `react-router-dom` v6 with `Layout` shell.
- **API Client:** Axios instance (`src/api/client.ts`) injecting `Authorization: Bearer <token>` from `localStorage`.
- **State Management:** React Context (`AuthContext`, `AIAssistantContext`) and `@tanstack/react-query`.

---

## 3. Detailed Vulnerability & Gap Breakdown

### Gap 1: Inadequate Server-Side Permission Checking (High Severity)
- **Observation:** Endpoints in `products.py`, `sales.py`, `sales_orders.py`, `purchase_orders.py`, `customers.py`, `returns.py`, `production.py`, and `finance.py` only depended on `get_current_user`.
- **Risk:** Any authenticated token (including an unprivileged employee or operator) could invoke write endpoints (e.g., creating products, editing sales orders, fetching complete financial balance sheets, exporting customer lists).
- **Remediation:** Introduce a unified `require_permission(perm: str)` dependency and map all routes to explicit permissions (`products.create`, `invoices.view`, `finance.view`, etc.).

### Gap 2: Lack of Session Invalidation / Token Revocation (High Severity)
- **Observation:** `POST /api/v1/auth/logout` returned `{"status": "ok"}` without state changes on the backend. When an admin deactivated a user (`is_active = FALSE`), any previously issued JWT token remained valid for up to 1440 minutes (24 hours).
- **Risk:** Compromised accounts or terminated employees could continue making API calls until token expiry.
- **Remediation:** Implement `token_version` on the `users` table, embedded into the JWT payload. Any session revocation, password change, role change, or deactivation increments `token_version`, immediately invalidating all outstanding tokens.

### Gap 3: Public Self-Registration Exposing Role Escalation (High Severity)
- **Observation:** `POST /api/v1/auth/register` accepted arbitrary roles (`role: str`) from the client request payload. Although a master password was optionally checked, leaving this endpoint open allowed unapproved user creation.
- **Risk:** Creation of rogue accounts or privilege escalation.
- **Remediation:** Restrict registration: do not expose public administrator creation. Require administrative authorization for user creation (`POST /api/v1/admin/users`).

### Gap 4: Frontend Development Preview Bypass & Missing Route Guards (Medium Severity)
- **Observation:** `App.tsx` checked `const DEV_PREVIEW = import.meta.env.DEV` and bypassed `ProtectedRoute` whenever running in dev mode. Furthermore, child routes had no granular authorization checks.
- **Risk:** Accidental leakage in staging/dev environments; lack of client-side feedback when an employee visits a restricted module.
- **Remediation:** Remove `DEV_PREVIEW` bypass from production routes. Implement `RequirePermission` route guards that render a professional Access Denied component if the authenticated user lacks access.

### Gap 5: Static Sidebar Navigation (Medium Severity)
- **Observation:** `Layout.tsx` displayed all sections (Dashboard, Products, Solutions/Production, Financial, Reports, Settings) unconditionally.
- **Risk:** User confusion and exposure of administrative entry points to employees who lack access.
- **Remediation:** Filter navigation items dynamically based on the current user's effective permissions.

### Gap 6: AI Assistant Tool Authorization (High Severity)
- **Observation:** `AIAssistantService` executed tools (e.g. `get_finance_summary`, `get_purchase_invoices`, `get_analytical_table`) based on warehouse scoping without verifying if the user has the module permission (e.g. `finance.view`).
- **Risk:** Data exfiltration through conversational queries bypassing UI restrictions.
- **Remediation:** In `AIAssistantService`, filter tools and query dispatch against the caller's effective permissions.

### Gap 7: Accidental Lockout of the Last Administrator (Medium Severity)
- **Observation:** No validation prevented an administrator from demoting or deactivating themselves or the last remaining administrator account.
- **Risk:** Permanent lockout requiring direct database intervention.
- **Remediation:** Enforce backend guard: ensure count of active administrator accounts remains ≥ 1 before executing role change or deactivation.

---

## 4. Remediation Plan & Phased Implementation

1. **Phase 1: Security Audit & Permission Matrix Definition** (Completed in this document and `ROLE_PERMISSION_MATRIX.md`).
2. **Phase 2: Database Schema & Migration**:
   - Add `token_version` column to `users`.
   - Add `roles`, `permissions`, `user_permissions`, and `security_audit_logs` tables.
   - Seed default role permissions.
   - Create administrative bootstrap utility.
3. **Phase 3: Backend Security & Permission Enforcement**:
   - Implement `require_permission` and `get_current_active_user` in `app/core/security.py`.
   - Enforce permission checks across all API routers.
   - Enforce permission validation in `AIAssistantService` tool execution.
   - Enforce session invalidation and audit logging.
4. **Phase 4: Frontend Authorization Layer**:
   - Update `AuthContext` to fetch and store effective permissions.
   - Create `RequirePermission` and `AccessDenied` components.
   - Protect all routes in `App.tsx`.
   - Filter `Layout.tsx` sidebar navigation dynamically.
5. **Phase 5: Admin User & Permission Management UI**:
   - Enhance `SettingsUsersPage.tsx` with module permission matrix (View, Create, Edit, Delete, Export, Approve).
   - Add session revocation trigger, account activation/deactivation, and confirmation modals.
6. **Phase 6: Automated Verification & Regression Testing**:
   - Implement test suite covering all 16 required test cases.
   - Verify backend unit tests, frontend Vitest tests, TypeScript validation, and production build.
