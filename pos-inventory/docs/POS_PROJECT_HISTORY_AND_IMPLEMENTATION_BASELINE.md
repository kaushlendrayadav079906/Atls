# POS Project History and Implementation Baseline

## 1. Executive Summary
This document serves as the verified historical baseline of the **POS-Inventory Kool** repository. The system is a hybrid Point-of-Sale and inventory management application containing a React (Vite) frontend and a FastAPI backend. It relies on a local PostgreSQL database for authentication and uses the SAP Business One Service Layer as the primary source of truth for business data (products, sales, customers, returns). 
This baseline sets the stage for the planned integration of AtlasOps dashboard capabilities.

## 2. Verified Project History and Milestones
Based on the `git log` and available files, the project has evolved through several milestones:

- **Confirmed Historical Changes**:
  - Implementation of return & exchange flows (`0ae56fc`).
  - Improved return UI, mobile customer search, and customer dashboard additions (`623c95a`).
  - Addition of dashboard cache with insights (`78afb87`).
  - Migration/addition of PostgreSQL-based login (`65c284b`).
  - Server configuration and settings improvements (`76b1e49`).
- **Current Implementation State**: Working POS system with checkout, products, dashboard, and PostgreSQL-backed JWT authentication.
- **Planned / Proposed Work**: Integration of AtlasOps dashboard capabilities.
- **Unknowns / Not Verified**: Early prototyping history before current git logs, exact initial release dates.

## 3. Current Repository and Technology Stack
**Structure**:
- `pos-frontend/`: React frontend (Vite, TypeScript, TailwindCSS, Redux Toolkit). Started via `npm run dev` or built via `npm run build`.
- `pos-backend/`: FastAPI backend (Python 3.12, Uvicorn, Pydantic, async DB drivers). Started via `python main.py` or `uvicorn app.main:app`.

**Environment Files**:
- `pos-frontend/.env`
- `pos-backend/.env`
- `pos-backend/.env.example`

**Git Status**:
- **Branch**: `main` (up to date with `origin/main`).
- **Modified files preserved**: `.env.example`, `auth.py`, `main.py`, `.env` (frontend), `App.tsx`, `Login.tsx`, `Register.tsx`, `api.ts`, `vite.config.ts`.

## 4. POS Feature Inventory

| Feature | Frontend page/route | Backend endpoint/service | Data source | Current status | Evidence |
| ------- | ------------------- | ------------------------ | ----------- | -------------- | -------- |
| Login / Auth | `/login` | `POST /api/v1/auth/login` | PostgreSQL | **Verified complete** | `auth.py`, `Login.tsx` |
| Registration | `/register` | `POST /api/v1/auth/register` | PostgreSQL | **Verified complete** | `auth.py`, `Register.tsx` |
| Admin Access / Roles | `/admin/*` | Middleware / Token claims | PostgreSQL | **Verified complete** | `auth.py`, `App.tsx` routes |
| Checkout / Invoice | `/checkout` | `POST /api/v1/sales` | SAP Service Layer | **Implemented, not fully verified** | `api.ts`, `sales.py` |
| Products | `/products` | `GET /api/v1/products` | SAP Service Layer | **Blocked** (SAP offline) | `api.ts`, `Products.tsx` |
| Dashboard KPIs | `/` (Dashboard) | `GET /api/v1/dashboard/*` | SAP Service Layer | **Blocked** (SAP offline) | `Dashboard.tsx`, `api.ts` |
| Customers | Various | `GET /api/v1/customers/*` | SAP Service Layer | **Implemented, not fully verified** | `api.ts` |
| Returns / Refunds | `/returns` | `POST /api/v1/returns` | SAP Service Layer | **Implemented, not fully verified** | `ReturnsExchange.tsx` |

## 5. Frontend Architecture and Route Map
The frontend is structured around React Router, Redux Toolkit, and React Query.

**Route Map**:
- **Public**: `/login`, `/register`
- **Protected (User/Operator)**: 
  - `/` (Dashboard)
  - `/products` (Products View)
  - `/pos` (Point of Sale Interface)
  - `/checkout` (Checkout Flow)
  - `/returns` (Returns and Exchanges)
  - `/reports` (Operator Export Reports)
- **Protected (Admin)**: 
  - `/admin` (Admin Dashboard)
  - `/admin/branches` (Branches Management)
  - `/admin/reports` (Export Reports)

**Architecture Details**:
- **State**: `authSlice` manages user session and JWT tokens stored in secure cookies and local storage.
- **API Client**: Axios instance in `services/api.ts` handles Bearer token injection and global error handling.

## 6. Backend Architecture and API Inventory
The backend uses FastAPI.
- **Entry**: `main.py` configuring Uvicorn.
- **Auth**: JWT-based authentication backed by PostgreSQL (`user_service.py`).
- **Integration**: `sap/client.py` handles SAP Service Layer connections.

**API Inventory (Notable Endpoints)**:
- `/api/v1/auth/login` (POST)
- `/api/v1/auth/register` (POST)
- `/api/v1/products` (GET)
- `/api/v1/sales` (POST)
- `/api/v1/dashboard/summary` (GET)
- `/api/v1/returns` (GET, POST)
- `/api/v1/admin/users` (GET, POST, PUT, DELETE)

## 7. SAP B1/HANA Integration State
- **Connection Mechanism**: HTTP requests to the SAP Business One Service Layer. HANA direct access is not explicitly visible; everything routes via the Service Layer.
- **Config**: Configured via `SAP_SERVICE_LAYER_URL`, `SAP_COMPANY_DB`, `SAP_USERNAME`, `SAP_PASSWORD` in `.env`.
- **Status**: **Connection failed**. The configured URL (`http://localhost:50001/b1s/v1`) actively refused the connection (`WinError 10061`).
- **Dependencies**: All core business flows (Products, Sales, Dashboard, Returns) depend heavily on this connection.

## 8. Application Database Inventory

| Database | Current purpose | Connection/config source | Tables/models used | Migration approach | Verification status |
| -------- | --------------- | ------------------------ | ------------------ | ------------------ | ------------------- |
| PostgreSQL | Authentication and User Management | `DATABASE_URL` in `.env` | `users` table | Raw SQL setup (`init_user_storage()`) | **Verified complete** |
| SAP B1 (External) | Business Data (Products, Invoices) | `SAP_SERVICE_LAYER_URL` | Items, OINV, ORIN, etc. | None (Read/Write via API) | **Connection failed** |

*Note: AtlasOps MySQL is not currently configured or referenced in this repository.*

## 9. Authentication and Authorization State
- **Users Table**: Handled in PostgreSQL.
- **Password Security**: Passwords are hashed using `passlib` (bcrypt).
- **Admin Registration**: Protected by a `REGISTER_MASTER_PASSWORD` validated during the `/register` request. Prevents unauthorized self-elevation.
- **Tokens**: Stateless JWT returned upon login, containing `sub`, `role`, and `branch_id`.

## 10. Tests and Verification Results
- **Backend Tests**: 
  - Ran: `pytest tests`
  - Result: **Passed (10/10)**. Confirmed API test coverage for auth flows.
- **Frontend Build & Types**: 
  - Ran: `npx tsc -b --noEmit ; npm run build`
  - Result: **Passed**. 833 modules transformed, production assets generated.

## 11. Known Issues and Blockers
- **SAP Connectivity**: The SAP Service Layer is unreachable on the configured port. This strictly blocks runtime testing of POS operations, Product searches, and Dashboard rendering.
- **AtlasOps Integration**: No MySQL dependencies or AtlasOps code is present yet.

## 12. AtlasOps-to-POS Integration Mapping

| AtlasOps capability | Existing POS equivalent | AtlasOps dependency | Reuse/adapt/missing/duplicate | Required SAP source | Risks/questions |
| ------------------- | ----------------------- | ------------------- | ----------------------------- | ------------------- | --------------- |
| Command Center KPIs | POS Dashboard (`/`) | AtlasOps Models/MySQL | Adapt existing frontend dashboard | SAP Sales Data | Data source divergence |
| Financial Reports | Export Reports | External reporting engine | Missing/Adapt | SAP Invoices | Complex UI merging |
| AI Analysis | None | AtlasOps AI Service | Missing | N/A | Integration surface unknown |
| User/Role Auth | PostgreSQL POS Users | AtlasOps Users (MySQL)| Duplicate | N/A | Need to unify auth systems |

## 13. Open Questions Requiring Confirmation
- Is the AtlasOps MySQL database meant to replace the POS PostgreSQL database for user management?
- Will AtlasOps features fetch data from SAP B1 directly, or do they rely on their own historical sync tables?
- What is the correct, accessible SAP Service Layer URL for development?

## 14. Recommended Implementation Phases and Audit Gates
1. **Unify Environment & Databases**: Resolve the PostgreSQL vs. MySQL user management overlap.
2. **SAP Connectivity Restoration**: Fix `.env` configuration to ensure SAP B1 is reachable for testing.
3. **Frontend Dashboard Merge**: Introduce AtlasOps UI components into the POS React application, reusing the existing layout and routing.
4. **Backend Route Consolidation**: Mount AtlasOps FastAPI routers into the POS FastAPI app.

## 15. Evidence Appendix
- **Test command**: `pytest tests` (Exit code: 0)
- **Build command**: `npx tsc -b --noEmit && vite build` (Exit code: 0)
- **Backend Error log**: `[WinError 10061] No connection could be made because the target machine actively refused it`
- **Git State**: Branch `main`, tracking `origin/main`. Modifed configs preserved.
