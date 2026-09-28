# Backend Target Architecture

## Service Boundaries and Mapping

The Atlas Retail Operations Platform architecture describes nine core areas. The current backend (`pos-backend`) already implements these responsibilities efficiently:

| Proposed Service Name | Existing Implementation | Responsibility |
| --- | --- | --- |
| **Auth & User Service** | `app/api/v1/auth.py`, `app/services/user_service.py`, `app/core/security.py` | JWT authentication, role management, and PostgreSQL user state. |
| **Dashboard Service** | `app/api/v1/dashboard.py` | Provides aggregated operation views, sales feed, and performance summaries. |
| **POS & Sales Service** | `app/api/v1/sales.py`, `app/services/sap/invoices_service.py` | Creating and retrieving A/R Invoices from SAP. |
| **Inventory Service** | `app/api/v1/products.py`, `app/services/sap/inventory_service.py`, `app/core/product_store.py` | Product fetching, stock queries, caching. |
| **Customer Service** | `app/api/v1/customers.py`, `app/services/sap/business_partners_service.py` | Business Partner queries. |
| **Returns & Approval Service** | `app/api/v1/returns.py`, `app/services/approval_service.py`, `app/services/sap/returns_service.py` | Multi-step return workflows managed in Postgres and executed as Credit Notes in SAP. |
| **Analytics Service** | `app/api/v1/atlas.py` | Heavy read-only aggregations for managers (sales trends, top products). |
| **Reporting Service** | Subsumed by `atlas.py` & `admin.py` | Branch-level reporting and advanced insights. |
| **Settings & Administration** | `app/api/v1/admin.py` | System config, user management, and global views. |

## Data Ownership
- **Application Database (PostgreSQL)**: Handles identity (`users` table) and workflow state (`approval_requests` table). It does NOT duplicate SAP operational data.
- **SAP Business One (Service Layer)**: The absolute source of truth for all operational and financial records (Invoices, Credit Notes, Items, Business Partners).

## API-to-Service Flow & Authorization
1. Frontend makes REST requests to FastAPI.
2. `app.core.security` extracts the JWT token, validating the signature and checking `is_active`.
3. `require_manager_or_admin` or `get_current_user` dependencies inject the user context.
4. Business logic extracts the user's `branch_id` and enforces tenant isolation. Client-supplied branch IDs are overridden by the server for managers/users.
5. The request is passed to the respective Service (e.g., `SAPInvoicesService`), which executes the query against SAP or PostgreSQL.
6. The service aggregates the results, and the API router maps them to typed Pydantic responses.

## SAP Adapter & App DB Boundaries
- SAP access is encapsulated in `app/services/sap/client.py`.
- No SAP credentials, tokens, or cookies are leaked to the API responses.
- PostgreSQL access is handled via direct `psycopg2` connections in `user_service.py` and `approval_service.py`.

## Cross-Cutting Concerns
- **Caching & Background Refresh (Existing)**: 
  - `app/core/cache.py` provides in-memory caching. 
  - `app/core/product_store.py` handles background refreshing of product listings.
  - Dashboard totals use a 30-45 second TTL.
- **Monitoring & Logging (Existing)**: 
  - Centralized in `app/main.py` via `request_logging_middleware` (logs latency, status, X-Request-ID).
- **Notifications (Future Work)**:
  - Real-time WebSockets or server-sent events for approvals (currently relies on frontend polling).

## Gaps and Dependencies
- **SAP Health Checks**: Need a robust distinction between application liveness and SAP dependency liveness (currently combined or partially handled during startup).
- **Shift Management**: The concept of a "Shift" does not exist in the database or SAP mappings. This is a business-rule dependency requiring client definition before implementation.
