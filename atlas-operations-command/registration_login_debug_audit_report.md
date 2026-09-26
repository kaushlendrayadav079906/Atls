# ATLASOPS CMD — REGISTRATION → LOGIN DEBUG AUDIT REPORT

**Date:** September 7, 2026  
**Repository:** `C:\Users\A\Documents\Kaushal Yadav\Dashboard\atlas-operations-command`  
**Target Unit:** Registration to Login Integration & Root-Cause Analysis  

---

## A. Repository Verification
- Verified root directory: `C:\Users\A\Documents\Kaushal Yadav\Dashboard\atlas-operations-command`
- Verified active Git branch: `main`
- Commit: `bc15734 last commite`

---

## B. Login Flow Verification
- `POST /api/v1/auth/login` accepts `LoginRequest(company_id: UUID, email: str, password: str)`.
- Identity resolution requires `(company_id, email)` because emails are tenant-scoped rather than globally unique.
- `AuthService.authenticate_user`:
  1. Looks up `User` by `(company_id, email)`.
  2. Verifies `user.status == "active"`.
  3. Verifies `UserCredential` using `verify_password(password, cred.password_hash)` via Argon2id.
  4. Generates standard JWT token with claims `{"sub": user_id, "company_id": company_id}`.
- `GET /api/v1/auth/me` decodes JWT and returns `{"user_id": ..., "company_id": ...}`.

---

## C. Registration Flow Verification
- `POST /api/v1/auth/register` atomically executes inside a single database transaction:
  1. Creates `Company` with server-generated UUID.
  2. Creates first `User` with `company_id = company.id`, `status="active"`, and normalized lowercase email.
  3. Creates `Role(name="admin", company_id=company.id)`.
  4. Creates `UserRole(user_id=user.id, role_id=admin_role.id)`.
  5. Generates Argon2id password hash and stores `UserCredential(user_id=user.id, password_hash=...)`.
  6. Commits transaction and returns `201 Created` with `company_id`, `company_name`, `email`, `full_name`.

---

## D. Database Connection Verification
- Environment: Development
- Database driver: `mysql+pymysql`
- Database name: `atlasops`
- Host/Port: `localhost:3307`
- Both registration and login use the exact same MySQL database instance through SQLAlchemy `SessionLocal`.

---

## E. Company Record Verification
- Company records exist with valid UUID identifiers.
- Attributes verified: `currency_code`, `timezone`, `locale`, `region`, `fiscal_year_start_month`, and `status="active"`.

---

## F. User Record Verification
- User records link directly to `Company.id` via `User.company_id`.
- User records store normalized lowercase email.
- User status is `"active"`.

---

## G. Role & UserRole Verification
- `Role(name="admin", company_id=company.id)` correctly created per company.
- Junction row `UserRole(user_id=user.id, role_id=admin_role.id)` connects user to the admin role.

---

## H. Credential Existence Verification
- `UserCredential` row exists and links to `User.id`.

---

## I. Argon2id Verification Result
- **PASSWORD VERIFICATION: PASS**
- Passwords hashed using Argon2id with secure salting; plaintext passwords are not stored or logged.

---

## J. User Status Verification
- User status is strictly `"active"`.

---

## K. Email Normalization Verification
- Registration stores email in trimmed lowercase (`admin@example.com`).
- Added `@field_validator("email")` to `LoginRequest` in `app/schemas/auth.py` ensuring case-insensitivity and whitespace trimming during login (`User@Example.COM` -> `user@example.com`).

---

## L. Company / Tenant Matching
- Tenant isolation verified: `User.company_id == Company.id`.
- `LoginRequest.company_id` matches the user's company context.

---

## M. Root Cause
1. **Case Sensitivity & Whitespace in Login Email**: `LoginRequest` previously did not normalize the email field before executing `user_repository.get_by_email_within_company()`. If a user typed their email with mixed casing or leading/trailing spaces, the database lookup returned `None`, triggering `"Incorrect email, password, or company"`.
2. **Missing Registered Account Data on Frontend**: Because frontend registration is not yet built, attempting to log in without first registering a company & user via `POST /api/v1/auth/register` (or using a non-existent `company_id` UUID) produces `401 Unauthorized`.

---

## N. Minimal Fix
1. Added email normalization validator to [backend/app/schemas/auth.py](file:///C:/Users/A/Documents/Kaushal%20Yadav/Dashboard/atlas-operations-command/backend/app/schemas/auth.py) on `LoginRequest` to strip whitespace and lowercase the email.
2. Added dedicated automated test `test_login_email_case_insensitivity` in [backend/tests/test_registration.py](file:///C:/Users/A/Documents/Kaushal%20Yadav/Dashboard/atlas-operations-command/backend/tests/test_registration.py).

---

## O. Backend Tests
- `test_registration.py`: 21 passed.
- `test_auth.py`: 7 passed.
- Full suite: **204 passed**.

---

## P. Frontend Tests
- Not applicable (no frontend files modified; frontend registration page is deferred to Step 2).

---

## Q. Build
- Backend runs cleanly on Uvicorn development server (`http://localhost:8000`).

---

## R. Database / Migration Status
- 0 migrations created. No database schema changes needed.

---

## S. Security Verification
- No plaintext password storage.
- No password or password hash logged or exposed.
- No JWT secret or database credentials exposed.
- Argon2id hashing and tenant isolation preserved.

---

## T. Changed Files
- Modified: `backend/app/schemas/auth.py`
- Modified: `backend/tests/test_registration.py`
- Created: `registration_login_debug_audit_report.md`

---

## U. Git Status
- On branch `main`
- No commits or pushes performed.

---

## V. Final Verdict

**PASS — REGISTRATION → LOGIN INTEGRATION VERIFIED**
