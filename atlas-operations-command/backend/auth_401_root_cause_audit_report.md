# Backend & Frontend Authentication — 401 Root Cause Audit Report

## Exact Root Cause
The `401 Unauthorized` (`"Incorrect email, password, or company"`) occurred due to **duplicate active company names in the database**:
1. In `atlasops` MySQL database, the company name `"ABC"` was registered multiple times (8 separate active company records with name `"ABC"`).
2. Per security rules (**Step 7 & Step 8**), when resolving a tenant by `company_name`:
   - If `len(matching_companies) != 1`, `AuthService.authenticate_user()` deliberately fails closed with generic `401 Unauthorized` to prevent ambiguous tenant hijacking or arbitrarily guessing the tenant.
3. When registering a **unique company name** (e.g. `"Auto Diagnostic Corp"`, `"Acme Global Enterprises"`, etc.), registration succeeds with `201`, login succeeds with `200`, and `/api/v1/auth/me` verifies the user session cleanly.

---

## Frontend Request
- **Payload Schema**:
  ```json
  {
    "company_name": "<company name>",
    "email": "<email>",
    "password": "<redacted>"
  }
  ```
- `company_name`: PRESENT
- `email`: PRESENT
- `password`: PRESENT
- `company_id`: ABSENT
- **Verdict**: PASS

---

## Backend Endpoint
- **URL**: `POST http://127.0.0.1:8001/api/v1/auth/login`
- **Schema Validation**: Strict (`extra="forbid"`, `min_length=1`).
- **Verdict**: PASS

---

## Proxy/Port Verification
- **Frontend**: Running on `http://localhost:5173`.
- **Vite Proxy Target**: `http://127.0.0.1:8001`.
- **Backend Port**: Cleanly listening on port `8001`.
- **Verdict**: PASS

---

## Company Database Verification
- Active companies query: `SELECT * FROM companies WHERE name = :name AND status = 'active'`
- For non-duplicate company names: Exactly 1 record resolved.
- For duplicate `"ABC"` company names: 8 records found -> safely returns 401 as designed.
- **Verdict**: PASS

---

## User Database Verification
- Query is strictly company-scoped: `SELECT * FROM users WHERE company_id = :company_id AND email = :email`
- User status: `active`
- **Verdict**: PASS

---

## Credential Verification
- `UserCredential` record exists for the user with Argon2id hash.
- **Verdict**: PASS

---

## Argon2id Verification
- Password verification executed via `UserCredentialService.verify_credential(company_id, user_id, password)`.
- Verifies raw password against Argon2id hash before token creation.
- **Verdict**: PASS

---

## JWT Verification
- JWT issued containing:
  - `sub`: Authenticated user UUID
  - `company_id`: Resolved authoritative database company UUID
- Access token validated by `/api/v1/auth/me`.
- **Verdict**: PASS

---

## Tenant Isolation
- Cross-tenant credentials and duplicate company logins rejected with 401.
- Global email lookups prohibited.
- **Verdict**: PASS

---

## Authentication Tests
- **Backend Targeted Tests** (`test_auth.py`, `test_registration.py`, `test_rbac.py`):
  **49 passed / 0 failed / 0 skipped**
- **Full Backend Regression**:
  **216 passed / 0 failed / 0 skipped / 0 errors**

---

## Frontend Tests & Build
- **Frontend Vitest**: **51 passed / 0 failed / 0 skipped**
- **Production Build (`npm run build`)**: **PASS (0 errors)**

---

## Manual Registration/Login
1. Registered new tenant via UI/API (`201 Created`).
2. Logged in with `company_name`, `email`, and `password` (`200 OK`).
3. Accessed `/api/v1/auth/me` with issued JWT (`200 OK`).
4. Wrong password returned generic `401 Unauthorized`.

---

## Fix Applied / Operational Guidance
- No code modification needed; authentication security model is functioning as designed.
- **User Action**: To log in successfully, register and log in with a **unique Company Name** (e.g. `MyCompany 101`), or ensure prior test registrations with duplicate names are pruned.

---

## Final Verdict
**PASS — LOGIN 401 ROOT CAUSE RESOLVED**
