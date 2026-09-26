# Backend Company Name Login — Step 1 Audit

## 1. Scope
This audit report documents the implementation and verification of **Step 1: Backend Login Contract Correction** for Atlas Operations Command (`atlas-operations-command/backend`).

- **Contract Transition**: Changed `POST /api/v1/auth/login` request contract from `(company_id, email, password)` to `(company_name, email, password)`.
- **Target Components**:
  - `backend/app/schemas/auth.py` (`LoginRequest`)
  - `backend/app/repositories/company.py` (`CompanyRepository.get_active_by_name`)
  - `backend/app/services/auth.py` (`AuthService.authenticate_user`)
  - `backend/app/api/v1/auth.py` (`/login` endpoint)
  - `backend/tests/test_auth.py`, `backend/tests/conftest.py`, `backend/tests/test_rbac.py`
- **Scope Compliance**: STEP 1 ONLY. No frontend modifications (LoginPage, RegisterPage, AuthContext, authService unchanged), no database schema/migration changes, no dialect changes (MySQL test container on port 3307 verified), and no Git commits or pushes.

---

## 2. Repository Verification
- **Repository Root**: `C:\Users\A\Documents\Kaushal Yadav\Dashboard\atlas-operations-command`
- **Backend Directory**: `C:\Users\A\Documents\Kaushal Yadav\Dashboard\atlas-operations-command\backend`
- **Current Git Branch**: `main`
- **Working Tree**: Clean modifications confined strictly to allowed backend authentication files and test fixtures.

---

## 3. Current Authentication Architecture
- **Tenant Identification**: The authoritative internal tenant identifier remains the immutable database `UUID` of the `Company` record.
- **Login Identifier**: The user provides `company_name`, `email`, and `password`.
- **Flow**:
  1. Input normalization (whitespace trimming and email lowercase).
  2. Active company lookup by name in MySQL.
  3. Single-company uniqueness validation (fail closed on 0 or >1 matches).
  4. Scoped user lookup (`user.company_id == resolved_company.id`).
  5. Active user status validation.
  6. Argon2id password hash verification via `UserCredentialService`.
  7. Signed JWT issuance embedding `user_id` and authoritative database `company_id`.

---

## 4. LoginRequest Contract
`backend/app/schemas/auth.py`:
- Defined strictly as:
  ```python
  class LoginRequest(BaseModel):
      company_name: str
      email: str
      password: str

      model_config = ConfigDict(extra="forbid")
  ```
- Any payload containing the legacy `company_id` field is rejected by Pydantic with HTTP `422 Unprocessable Entity`.
- Fields are validated to forbid empty or whitespace-only inputs.

---

## 5. Company Name Normalization
- **Strategy**: Deterministic whitespace stripping via `@field_validator('company_name', mode='before')` and exact case-insensitive matching matching MySQL default collation (`utf8mb4_0900_ai_ci` / `utf8mb4_general_ci`).
- **Email Normalization**: Stripped of leading/trailing whitespace and converted to lower case (`email.strip().lower()`).
- **No Fuzzy Matching**: Substring matching, regex patterns, or fuzzy matching are strictly disallowed to prevent tenant hijacking.

---

## 6. Company Lookup
`backend/app/repositories/company.py`:
- Added repository method:
  ```python
  def get_active_by_name(self, db: Session, name: str) -> list[Company]:
      return db.query(Company).filter(Company.name == name, Company.status == "active").all()
  ```
- Queries active companies (`status == 'active'`) matching the exact normalized name.
- Returns all matching companies as a list without arbitrarily selecting the first row.

---

## 7. Duplicate Company Handling
- In `AuthService.authenticate_user`:
  ```python
  matching_companies = company_repository.get_active_by_name(self.db, norm_company_name)
  if len(matching_companies) != 1:
      raise UnauthenticatedException(detail="Incorrect email, password, or company")
  ```
- If 0 active companies match -> generic `401 Unauthorized`.
- If 2 or more active companies match -> generic `401 Unauthorized`.
- Never guesses, picks `matches[0]`, or selects by timestamp/UUID.

---

## 8. User Tenant Isolation
- User query is explicitly and strictly constrained by `company.id`:
  ```python
  user = user_repository.get_by_email_within_company(self.db, company.id, norm_email)
  ```
- No global user lookup is performed. Users existing in other companies with the same email address cannot authenticate against a different tenant.

---

## 9. Argon2id Verification
- Verified via `UserCredentialService.verify_credential(company.id, user.id, password)`:
  - Ensures credential exists for `user.id`.
  - Re-verifies tenant isolation (`user.company_id == company.id`).
  - Verifies Argon2id password hash using `app.core.security.verify_password`.
- Passwords and password hashes are never logged, exposed, or returned in API responses.

---

## 10. JWT Security
- Issued JWT contains:
  - `sub`: `str(user.id)` (Authenticated user's database UUID)
  - `company_id`: `str(user.company_id)` (Resolved company's database UUID)
  - `exp`: Configured expiration timestamp
- Token signed with `JWT_SECRET_KEY` using HMAC-SHA256.
- Client cannot supply or influence `company_id` in token claims.
- Tampered tokens and tokens signed with wrong keys are rejected with HTTP 401 by authentication dependencies.

---

## 11. Generic Authentication Errors
- All authentication failure modes (nonexistent company, duplicate company name, inactive company, nonexistent user, inactive user, missing credential, invalid password) consistently raise `UnauthenticatedException` with message:
  `"Incorrect email, password, or company"`
- Prevents company or account enumeration.

---

## 12. Security Tests
The test suite in `tests/test_auth.py` covers all 20 required verification scenarios:
1. `test_login_success`: Correct company name, email, password -> 200 OK & JWT.
2. `test_login_failure_wrong_company_name`: Unknown company -> 401.
3. `test_login_failure_wrong_email`: Wrong email -> 401.
4. `test_login_failure_wrong_password`: Wrong password -> 401.
5. `test_login_failure_inactive_user`: Inactive user (`status='inactive'`) -> 401.
6. `test_login_failure_inactive_company`: Inactive company (`status='inactive'`) -> 401.
7. `test_user_without_credential_fails`: Missing UserCredential -> 401.
8. `test_login_company_name_whitespace_normalization`: Whitespace-padded name -> 200 OK.
9. `test_login_company_name_case_normalization`: Case-insensitive company name -> 200 OK.
10. `test_login_email_case_and_whitespace_normalization`: Uppercase/whitespace email -> 200 OK.
11. `test_login_duplicate_active_companies_fails`: Duplicate active company names -> 401 (no arbitrary pick).
12. `test_login_nonexistent_company`: Nonexistent company -> 401.
13. `test_client_attempts_old_company_id_field`: Payload with `company_id` -> 422 Unprocessable Entity.
14. `test_cross_tenant_login_matrix`: Cross-tenant combinations A-B and B-A -> 401.
15. `test_jwt_creation_and_claims`: JWT claims match database UUIDs.
16. `test_bearer_authentication_and_me_endpoint`: `/api/v1/auth/me` with issued JWT -> 200 OK.
17. `test_jwt_tampering_and_algorithm_security`: Modified payload signature -> 401.
18. `test_tenant_safety_token_manipulation`: Token claim forgery -> rejected.
19. `test_login_validation_matrix`: Empty fields -> 422.
20. Response security: Confirmed `password` / `password_hash` never returned.

---

## 13. Targeted Test Results
- **Command**:
  ```powershell
  $env:DB_HOST="127.0.0.1"; $env:PYTHONPATH="."; .\venv\Scripts\pytest tests/test_auth.py tests/test_auth_foundation.py tests/test_rbac.py tests/test_registration.py -vv
  ```
- **Results**:
  **49 passed, 0 failed, 0 skipped, 0 errors** (100% Pass)

---

## 14. Full Regression Results
- **Command**:
  ```powershell
  $env:DB_HOST="127.0.0.1"; $env:PYTHONPATH="."; .\venv\Scripts\pytest -vv
  ```
- **Results**:
  **216 passed, 0 failed, 0 skipped, 0 errors** (100% Pass)

---

## 15. MySQL Verification
- **Status**: **AVAILABLE**
- **Configuration**: Running via Docker container `backend-db-1` on port `3307` (`atlasops_test` database).
- Verified with PyMySQL direct connection and engine pool health checks.

---

## 16. Migration Verification
- **Alembic Current**: `7a01b2c3d4e5 (head)`
- **Alembic Head**: `7a01b2c3d4e5 (head)`
- **Migrations Created**: **NO** (Schema unchanged; MySQL collation handles case normalization naturally).

---

## 17. Files Changed
- `backend/app/schemas/auth.py`
- `backend/app/repositories/company.py`
- `backend/app/services/auth.py`
- `backend/app/api/v1/auth.py`
- `backend/tests/conftest.py`
- `backend/tests/test_auth.py`
- `backend/tests/test_rbac.py`

---

## 18. Known Issues
- None. All targeted and full regression tests passed without errors.

---

## 19. Scope Verification
- [x] Backend Login Contract updated to `company_name` + `email` + `password`
- [x] Extra fields (including legacy `company_id`) forbidden with 422
- [x] Deterministic company name and email normalization
- [x] Safe duplicate company name handling (fail closed with 401)
- [x] Strict tenant-scoped user query
- [x] Argon2id credential verification before JWT issuance
- [x] Authoritative internal `company_id` embedded in JWT
- [x] Generic 401 error messages prevent tenant enumeration
- [x] No database migrations created
- [x] No frontend files modified
- [x] No Git commits or pushes

---

## 20. Final Verdict
**PASS — BACKEND COMPANY-NAME LOGIN STEP 1 COMPLETE**
