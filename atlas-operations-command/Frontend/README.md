# AtlasOps Cmd — Frontend Architecture & Operation Guide

## 1. Overview
The AtlasOps Cmd frontend is a high-performance React 19 + TypeScript application powered by Vite. It provides an enterprise-grade command operations interface with centralized authentication, route guarding, unified API communication, responsive layout management, and an executive multi-plant dashboard.

---

## 2. Directory Structure
```
Frontend/
├── .env                       # Local environment variables (VITE_API_BASE_URL, VITE_DEMO_MODE)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript root project references
├── tsconfig.app.json          # App compiler configuration
├── tsconfig.node.json         # Node/Vite compiler configuration
├── vite.config.ts             # Vite & Vitest configuration
└── src/
    ├── main.tsx               # Application entry point
    ├── App.tsx                # Route definitions & AuthProvider wrapper
    ├── index.css              # Dark slate enterprise design system
    ├── config/                # Environment configuration & demo mode helper
    │   └── index.ts
    ├── types/                 # Backend contract type definitions
    │   └── index.ts
    ├── services/              # Centralized domain API & demo data services
    │   ├── apiClient.ts
    │   ├── authService.ts
    │   ├── businessDataService.ts
    │   ├── factoryService.ts
    │   ├── reportService.ts
    │   ├── realtimeService.ts
    │   ├── aiRiskService.ts
    │   ├── localizationService.ts
    │   └── demoData.ts
    ├── context/               # React contexts (AuthContext)
    │   └── AuthContext.tsx
    ├── components/
    │   ├── auth/              # ProtectedRoute guard
    │   │   └── ProtectedRoute.tsx
    │   ├── common/            # LoadingSpinner, ErrorState, EmptyState
    │   │   ├── LoadingSpinner.tsx
    │   │   ├── ErrorState.tsx
    │   │   └── EmptyState.tsx
    │   ├── dashboard/         # Unit 2 Executive KPI & Visualization components
    │   │   ├── DemoDataBanner.tsx
    │   │   ├── DashboardHeader.tsx
    │   │   ├── KpiCard.tsx
    │   │   ├── RevenueExpenseChart.tsx
    │   │   ├── FactoryPerformanceCard.tsx
    │   │   ├── SalesProductCard.tsx
    │   │   ├── ActionItemsCard.tsx
    │   │   ├── FinancialHealthCard.tsx
    │   │   ├── SapWorkCard.tsx
    │   │   └── index.ts
    │   └── layout/            # Application Shell (Sidebar, Header, Logout)
    │       └── AppShell.tsx
    ├── pages/                 # Views & Page Placeholders
    │   ├── LoginPage.tsx
    │   ├── DashboardPage.tsx
    │   └── PlaceholderPages.tsx
    └── test/                  # Test setup & unit/integration test suites
        ├── setup.ts
        ├── apiClient.test.ts
        ├── App.test.tsx
        └── DashboardPage.test.tsx
```

---

## 3. Running the Frontend

### Development Server
```bash
cd Frontend
npm install
npm run dev
```
The application will start on `http://localhost:5173`.

### Demo Mode vs. Real API Mode

- **Demo Mode (`VITE_DEMO_MODE=true`)**:
  Utilizes the isolated frontend mock dataset from `src/services/demoData.ts` for offline testing. A persistent `DEMO DATA — LOCAL TESTING` banner is rendered at the top of the dashboard.
- **Real Mode (`VITE_DEMO_MODE=false`)**:
  Sends authentic HTTP requests through `apiClient` to backend REST endpoints (`/api/v1/...`). Never silently replaces failed requests with demo data; displays standard `ErrorState` or `EmptyState` components.

### Production Build & Validation
```bash
npm run build
npm run test
```

---

## 4. Dashboard Architecture & Components
- **Executive KPI Row**:
  - `Operational Factories` (links to `/factories`)
  - `Revenue & Net P&L` (net margin calculation & trends)
  - `Accounts Receivable` (30d aging indicators)
  - `Accounts Payable` (overdue cycles)
- **Operations Telemetry Row**:
  - `Stock & Inventory` (SKU counts & stockout alerts)
  - `Sales Volume` (links to `/reports`)
  - `Production Output` (target achievement & active lines)
  - `Plant Solvency & Health` (composite availability)
- **Analytics & Visualizations**:
  - `RevenueExpenseChart`: Pure CSS SVG responsive bar chart showing monthly revenue, expenditure, and margin.
  - `FactoryPerformanceCard`: Multi-facility status table with revenue/output breakdown.
  - `SalesProductCard`: Commercial sales distribution and top-tier customers.
  - `FinancialHealthCard`: Operating margin, quick ratio, liquidity index, and AI risk composite gauge.
- **Actions & Integrations**:
  - `ActionItemsCard`: Priority operations tasks with interactive `resolveAction` state management.
  - `SapWorkCard`: Explicit placeholder area indicating `"Awaiting SAP integration"`.

---

## 5. Authentication & Registration Architecture

### Public Routes
- `/login`: Standard enterprise login supporting Company ID, Email, and Password. Prefills Company ID and Email when navigated from `/register`.
- `/register`: Enterprise registration creating a new tenant Company and its initial Administrator account atomically.

### Registration Flow & Security Rules
1. **Endpoint**: `POST /api/v1/auth/register` called exclusively via centralized `authService.register` and `apiClient`.
2. **Form Sections**:
   - **Company Information**: Company Name, Country Code (ISO-2), Currency Code (ISO-3), Timezone (IANA), Locale, Fiscal Year Start Month (1–12).
   - **Administrator Account**: Full Name, Work Email, Password (min 8 characters), Confirm Password.
3. **Frontend Validation**:
   - Trimmed non-empty validation on required strings.
   - ISO code length validation (2-letter country, 3-letter currency).
   - Password minimum length and matching confirmation.
   - Authoritative validation and Argon2id password hashing are executed on the backend.
4. **Success Redirection**:
   - Backend returns `201 Created` with metadata (`company_id`, `company_name`, `email`, `full_name`).
   - Frontend redirects to `/login` passing **only** `companyId` and `email` via React Router location state.
   - **Password Security Invariant**: Passwords and secrets are **never** persisted in `localStorage`, `sessionStorage`, cookies, query parameters, console logs, or React Router navigation state.
   - `LoginPage` automatically prefills `companyId` and `email` while ensuring the password input field remains strictly empty for manual entry.
5. **Demo Mode Non-interference**:
   - `VITE_DEMO_MODE` does not bypass or mock registration or login. Both public authentication routes always communicate with the real backend.

---

## 6. SAP ERP Boundary
SAP integration is scheduled for **Phase 8**. The frontend explicitly displays `"Awaiting SAP integration"` within the SAP Work Area and does not connect to or simulate live SAP databases. No fabricated credentials or fake synchronization states are created.
