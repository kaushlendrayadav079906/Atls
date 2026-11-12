# ATLAS – Phase 1: Google Sheets Integration Foundation Documentation

## 1. Architecture Overview

ATLAS POS/Inventory Phase 1 establishes an enterprise-grade Google Sheets integration foundation. The goal of Phase 1 is to provide a verified, secure, and non-intrusive connection mechanism between ATLAS and company Google Spreadsheets without synchronizing business records or modifying the existing SAP Business One stock configuration table.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ATLAS React Client (Vite)                       │
│  Settings → Integrations → Google Sheets (/settings/integrations/...) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Bearer Token Auth)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        ATLAS FastAPI Backend                           │
│  Router: /api/v1/integrations/google-sheets                            │
│  Security: RBAC & Tenant Company-level isolation                       │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │                                  │
                   ▼                                  ▼
┌────────────────────────────────────┐ ┌─────────────────────────────────┐
│     Configuration Persistence      │ │      Google Cloud Service       │
│ - PostgreSQL:                      │ │ - google-auth / service_account │
│   integration_configurations table │ │ - google-api-python-client      │
│ - JSON Fallback:                   │ │ - Read-Only Scope:              │
│   _google_sheets_config.json       │ │   spreadsheets.readonly         │
└────────────────────────────────────┘ └────────────────┬────────────────┘
                                                        │ Google Sheets API v4
                                                        ▼
                                       ┌─────────────────────────────────┐
                                       │     Company Google Sheet        │
                                       │ - Verified Spreadsheet Access   │
                                       │ - Worksheet Metadata            │
                                       │ - Column Headers Preview        │
                                       └─────────────────────────────────┘
```

### Key Architectural Tenets
1. **Zero Impact on Production Operations**: Preserves existing SAP Business One Service Layer workflows and current Stock Configuration tables.
2. **Server-Side Security**: Google service account credentials and private keys are strictly confined to the backend. The React client never receives credentials, service account private keys, or raw tokens.
3. **Company / Tenant Isolation**: Configurations are partitioned by `company_id` (derived from `SAP_COMPANY_DB` or user context).
4. **Resilient Persistence**: High-performance PostgreSQL persistence using standard `psycopg2` transactions with seamless fallback to `_google_sheets_config.json` when the database is offline or in local test environments.
5. **Strictly Read-Only Scope (Phase 1)**: Authentication operates under `https://www.googleapis.com/auth/spreadsheets.readonly`, ensuring the system cannot alter or overwrite spreadsheet contents.

---

## 2. Google Cloud Setup Instructions

To enable ATLAS to connect with Google Sheets, configure Google Cloud Platform (GCP):

### Step 2.1: Create or Select a GCP Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your organization or company project, or click **New Project** (e.g. `atlas-inventory-integration`).

### Step 2.2: Enable Google Sheets API
1. In the GCP Navigation menu, navigate to **APIs & Services → Library**.
2. Search for **Google Sheets API**.
3. Click **Enable**.
4. (Optional) Also enable **Google Drive API** if folder discovery or spreadsheet metadata inspection across Shared Drives is required in future phases.

---

## 3. Service Account Setup

ATLAS uses server-to-server machine authentication via a Google Cloud Service Account.

### Step 3.1: Create Service Account
1. In GCP Console, go to **IAM & Admin → Service Accounts**.
2. Click **Create Service Account**.
3. Enter details:
   - **Service account name**: `atlas-sheets-service`
   - **Service account ID**: `atlas-sheets-service`
   - **Description**: `Service account for ATLAS POS and Google Sheets inventory integration`
4. Click **Create and Continue**.
5. **Role Grant**: For Phase 1, no project-level IAM roles are needed because spreadsheet permissions are managed directly via spreadsheet sharing. Click **Continue** and **Done**.

### Step 3.2: Generate and Download JSON Key
1. In the Service Accounts list, click on the newly created service account (e.g., `atlas-sheets-service@<project-id>.iam.gserviceaccount.com`).
2. Go to the **Keys** tab.
3. Click **Add Key → Create new key**.
4. Select **JSON** as key type and click **Create**.
5. Save the downloaded JSON file securely. Rename it to `google-service-account.json`.

---

## 4. Spreadsheet Sharing Instructions

Google Cloud Service Accounts cannot access private company spreadsheets unless explicitly invited:

1. Open the target Google Spreadsheet in your web browser.
2. Click the green **Share** button in the upper-right corner.
3. In the "Add people and groups" input, paste your Service Account email address:
   ```
   atlas-sheets-service@<project-id>.iam.gserviceaccount.com
   ```
   *(Note: This email is also surfaced in ATLAS under Settings → Integrations → Google Sheets with a 1-click Copy button).*
4. Set the role to **Viewer** (Phase 1 requires Viewer only).
5. Uncheck "Notify people" (service accounts do not have inboxes).
6. Click **Share**.

---

## 5. Environment Configuration

### Backend Credentials Placement
Place the service account JSON file in the backend `secrets` folder:
```
pos-inventory/pos-backend/secrets/google-service-account.json
```
*(This folder and pattern are excluded in `.gitignore` to prevent committing keys to Git).*

### Backend Environment Variables (`pos-backend/.env`)
```bash
# ==========================================
# Google Sheets Integration (Phase 1)
# ==========================================

# Enable Google Sheets module
GOOGLE_SHEETS_ENABLED=true

# Path to the Google Service Account JSON key (relative or absolute)
GOOGLE_SERVICE_ACCOUNT_FILE=./secrets/google-service-account.json

# Alternatively, for Docker / Kubernetes secret injection, pass raw JSON string:
# GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":...}'

# Default / Fallback spreadsheet configuration
GOOGLE_SPREADSHEET_ID=
GOOGLE_SHEET_NAME=Stock Configuration
GOOGLE_SHEET_HEADER_ROW=1
GOOGLE_SHEET_DATA_START_ROW=2

# Network timeouts and read-only enforcement
GOOGLE_SHEETS_TIMEOUT=30
GOOGLE_SHEETS_READ_ONLY=true
```

---

## 6. API Endpoint Documentation

All endpoints are mounted under `/api/v1/integrations/google-sheets` and require a valid Bearer token with Administrator or Settings privileges.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/integrations/google-sheets/status` | Returns connection status, active configuration, and service account email. |
| `POST` | `/api/v1/integrations/google-sheets/connect` | Validates URL/ID, verifies API access, records status as 'connected'. |
| `POST` | `/api/v1/integrations/google-sheets/test` | Runs on-demand diagnostic test on saved or provided spreadsheet. |
| `GET` | `/api/v1/integrations/google-sheets/worksheets` | Lists available worksheet tabs with row and column dimensions. |
| `GET` | `/api/v1/integrations/google-sheets/headers` | Retrieves column headers from the selected worksheet and header row. |
| `POST` | `/api/v1/integrations/google-sheets/configuration` | Saves verified spreadsheet URL, ID, worksheet name, header row, and data start row. |
| `DELETE`| `/api/v1/integrations/google-sheets/disconnect` | Resets status to 'disconnected' and unsets active configuration. |

### Sample Payloads & Responses

#### `POST /api/v1/integrations/google-sheets/connect`
**Request:**
```json
{
  "spreadsheet_url": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "connection_status": "connected",
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "spreadsheet_name": "Company Stock Master 2026",
  "worksheets": ["Stock Configuration", "Raw Materials", "Vendors"],
  "service_account_email": "atlas-sheets-service@atlas-corp.iam.gserviceaccount.com",
  "message": "Connected successfully to spreadsheet 'Company Stock Master 2026'.",
  "tested_at": "2026-11-07T12:00:00.000Z"
}
```

#### `GET /api/v1/integrations/google-sheets/headers?worksheet_name=Stock%20Configuration&header_row=1`
**Response (200 OK):**
```json
{
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "worksheet_name": "Stock Configuration",
  "header_row": 1,
  "headers": [
    "Item Code",
    "Description",
    "Qty",
    "Stock Qty",
    "Vendor Name",
    "GRPO No",
    "Warehouse"
  ],
  "total_columns": 7,
  "total_rows": 1250,
  "last_tested_at": "2026-11-07T12:01:00.000Z"
}
```

---

## 7. Security Considerations

1. **No Credentials in Frontend**: React client bundle and network requests never contain private keys, client secrets, or OAuth tokens.
2. **Masked Identifiers**: Sensitive spreadsheet IDs are masked in the UI (e.g. `1BxiM...upms`) to avoid leaking full IDs during screen sharing or audits.
3. **Credential Guard in Git**:
   - `secrets/` and `*service-account*.json` are explicitly added to `.gitignore`.
   - `.env.example` provides non-sensitive placeholders only.
4. **Least Privilege Scope**: Service Account uses `spreadsheets.readonly` in Phase 1.
5. **No Confidential Data Exposure**: Phase 1 header preview requests only row 1 (`A1:ZZ1`), never transmitting confidential row business data.
6. **Role-Based Access Control**: Only authenticated users with `admin` role or `settings.view` / `settings.manage` permissions can configure integrations.

---

## 8. Testing Instructions

### Automated Backend Tests
Run pytest in the backend virtual environment:
```powershell
cd Atls/pos-inventory/pos-backend
.\venv\Scripts\python.exe -m pytest .\tests\test_google_sheets.py .\tests\test_stock_configuration.py -v
```
All 23 tests (18 Google Sheets integration tests + 5 Stock Configuration tests) pass cleanly without regression.

### Automated Frontend Tests
Run Vitest in the frontend:
```powershell
cd Atls/pos-inventory/Dashboard-Ui
npm test -- --run
```
All 15 test suites and 110 tests pass cleanly.

### Production Build Verification
Verify frontend TypeScript compilation and bundling:
```powershell
cd Atls/pos-inventory/Dashboard-Ui
npm run build
```
Production build succeeds in ~13s.

---

## 9. Meaningful Connection Statuses & Error Handling

ATLAS implements 8 distinct, structured connection statuses:
1. `connected`: Active Google Sheet connected, verified, and accessible.
2. `not_connected`: No Google Sheet currently linked.
3. `api_not_enabled`: Google Sheets API is disabled in the Google Cloud Project. ATLAS displays an external link banner directing the administrator directly to the GCP console activation URL (`https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=...`).
4. `permission_denied`: The target spreadsheet has not been shared with the ATLAS service account email (`atlas-google-sheets@gen-lang-client-0920050876.iam.gserviceaccount.com`).
5. `spreadsheet_not_found`: The configured Spreadsheet ID does not exist or was deleted.
6. `worksheet_not_found`: The selected worksheet tab was not found within the spreadsheet.
7. `authentication_failed`: Service account JSON key file missing or invalid in `pos-backend/secrets/google-service-account.json`.
8. `configuration_missing`: Spreadsheet URL or ID has not been provided.

---

## 10. Known Limitations (Phase 1)

1. **Read-Only Scope**: Phase 1 is strictly for connection setup, header verification, and read-only preview of Stock Configuration records. No records are written back to Google Sheets or to SAP Business One in Phase 1.
2. **Single Active Spreadsheet**: ATLAS stores one primary active integration spreadsheet configuration per company tenant.
3. **Shared Drive Permissions**: If the target spreadsheet resides in a Google Workspace Shared Drive, ensure the service account is added as a member of the Shared Drive or directly to the spreadsheet.

---

## 11. Phase 2 Implementation Plan

Upon verification and approval of Phase 1, Phase 2 will deliver:
1. **Interactive Column Remapping**: UI tools for customizing header mappings beyond the automatic alias engine.
2. **Bi-directional Synchronization Engine**:
   - Fetch live spreadsheet rows into ATLAS.
   - Detect diffs against SAP Business One stock balances.
   - Update individual rows and execute bulk updates directly to Google Sheets using batch update API requests.
3. **Conflict Resolution & Audit Trail**: Row-level status indicators (`synced`, `pending`, `conflict`) and audit logging for every change made via Google Sheets.

