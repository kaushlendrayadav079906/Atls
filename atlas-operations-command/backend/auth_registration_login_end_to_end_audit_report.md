# Registration to Login Flow — End-to-End Audit Report

## Problem
Following company and user registration, logging in via the web interface failed with a contract mismatch (422 Unprocessable Content) and a stale backend socket issue (500 Internal Server Error).

---

## Root Cause
1. **Contract Mismatch (422)**:
   - The backend `POST /api/v1/auth/login` contract was updated in Step 1 to expect `(company_name, email, password)` with `extra="forbid"`.
   - The frontend (`LoginPage.tsx`, `authService.ts`, `AuthContext.tsx`, `RegisterPage.tsx`) was previously sending `company_id`.
2. **Stale Backend Port Collision (500)**:
   - An orphaned background process was intercepting port 8000 and returning 500 errors.
   - Moving the FastAPI dev server to port `8001` and configuring Vite's `/api` proxy in `vite.config.ts` resolved the port conflict and CORS concerns completely.

---

## Registration Verification
- `POST /api/v1/auth/register` creates:
  - `Company` record with active status.
  - `User` record scoped to `company_id` with active status.
  - `Role` ('admin') scoped to `company_id`.
  - `UserRole` associating the user and role.
  - `UserCredential` storing Argon2id hashed password.
- Registration returns:
  ```json
  {
    "message": "Company and administrator registered successfully",
    "company_id": "<uuid>",
    "company_name": "<registered company name>",
    "email": "<registered email>",
    "full_name": "<full name>"
  }
  ```
- `RegisterPage.tsx` navigates to `/login` passing:
  - `companyName`
  - `email`
  - `successMessage`
  - *(Passwords, password hashes, and tokens are strictly excluded from navigation state).*

---

## Login Request Verification
- `POST /api/v1/auth/login` receives:
  ```json
  {
    "company_name": "<company name>",
    "email": "<email>",
    "password": "<password>"
  }
  ```
- Rejects any payload containing `company_id` with HTTP 422 (`extra="forbid"`).
- Normalizes whitespace in `company_name` and normalizes email (trimmed + lowercase).

---

## Database Verification
- Verified on MySQL `atlasops` (`localhost:3307`):
  - Company exists with `status = 'active'`.
  - User exists with `status = 'active'` and `company_id == Company.id`.
  - UserCredential exists with `user_id == User.id` and Argon2id hash.
  - UserRole exists linking user to the admin role.
- Single database connection used across both registration and login endpoints.

---

## Company Resolution
- `CompanyRepository.get_active_by_name` performs case-insensitive exact matching on active companies.
- 0 matches -> generic 401.
- >1 matches -> generic 401.
- Exactly 1 match -> resolves authoritative database UUID.

---

## User Resolution
- User lookup is scoped strictly within the resolved tenant:
  ```python
  user = user_repository.get_by_email_within_company(db, company.id, norm_email)
  ```
- Non-active users (`status != 'active'`) fail with generic 401.

---

## Credential Verification
- `UserCredentialService.verify_credential` validates password against Argon2id hash.
- Missing credentials or invalid passwords fail safely with generic 401.

---

## JWT Verification
- JWT created only after successful Argon2id verification.
- Claims:
  - `sub`: Authenticated `user.id` (UUID)
  - `company_id`: Authoritative database `company.id` (UUID)
- `/api/v1/auth/me` resolves the user identity cleanly from token context.

---

## Tenant Isolation
- User cannot log into a different company with the same email.
- Cross-tenant requests fail with 401.

---

## Frontend API Verification
- `vite.config.ts` proxies `/api` requests to `http://127.0.0.1:8001`.
- `Frontend/.env` uses `VITE_API_BASE_URL=/api/v1`.
- Direct and proxied HTTP tests pass with status 200 and return access tokens.

---

## Tests
- **Frontend Vitest**: 51 passed / 0 failed / 0 skipped (5 test files)
- **Backend Pytest**: 216 passed / 0 failed / 0 skipped / 0 errors

---

## Production Build
- `npm run build` completed successfully without TypeScript or build errors.

---

## MySQL
- **Status**: AVAILABLE (Port 3307, Docker `backend-db-1`)

---

## Manual End-to-End Test
1. Registered new tenant `Vite Proxy Test Corp` (`proxyadmin@regtest.com`).
2. Registration succeeded with HTTP 201.
3. Successfully logged in with `company_name`, `email`, and `password`.
4. Issued JWT authenticated `/api/v1/auth/me` with status 200.

---

## Files Modified
- `Frontend/src/services/authService.ts`
- `Frontend/src/context/AuthContext.tsx`
- `Frontend/src/pages/LoginPage.tsx`
- `Frontend/src/pages/RegisterPage.tsx`
- `Frontend/src/test/App.test.tsx`
- `Frontend/src/test/RegisterPage.test.tsx`
- `Frontend/vite.config.ts`
- `Frontend/.env`
- `backend/app/schemas/auth.py`
- `backend/app/repositories/company.py`
- `backend/app/services/auth.py`
- `backend/app/api/v1/auth.py`
- `backend/tests/conftest.py`
- `backend/tests/test_auth.py`
- `backend/tests/test_rbac.py`

---

## Known Issues
- None.

---

## Final Verdict
**PASS — REGISTRATION TO LOGIN FLOW VERIFIED**
