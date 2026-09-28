# Backend API Inventory

This document maps the FastAPI routes present in `pos-backend/app/api/v1/` to the Target Architecture service boundaries.

## Auth & User Service (`auth.py`)
- `POST /auth/login`: Issues JWT tokens for valid Postgres credentials.
- `GET /auth/me`: Retrieves current user details.

## Dashboard Service (`dashboard.py`)
- `GET /dashboard/summary`: Quick daily totals (cached).
- `GET /dashboard/recent-sales`: Last 5 sales for quick actions.
- `GET /dashboard/recent-sales-feed`: Paginated feed with return markers.
- `GET /dashboard/operator`: Extensive branch-specific dashboard with KPI and stock summaries.
- `GET /dashboard/customers`: Thin search wrapper for POS customer selection.

## Analytics Service (`atlas.py`)
- `GET /atlas/overview`: Global/Branch date-ranged sales KPIs.
- `GET /atlas/sales-trends`: Time-series sales data.
- `GET /atlas/inventory-summary`: Point-in-time stock checks.
- `GET /atlas/returns-summary`: Return request counts and SAP credit note totals.
- `GET /atlas/top-customers`: High-value customers query.
- `GET /atlas/product-velocity`: Top moving items by quantity.

## POS & Sales Service (`sales.py`)
- `POST /sales`: Drafts or executes an A/R Invoice.
- `GET /sales`: Fetches invoice list.
- `GET /sales/{id}`: Fetches specific invoice.

## Inventory Service (`products.py`)
- `GET /products`: Fetches active items and stock levels from cache/SAP.
- `GET /products/{id}`: Fetches specific item details.

## Returns & Approval Service (`returns.py`)
- `POST /returns/process`: Creates a return request in PostgreSQL (pending).
- `GET /returns`: Lists return requests.

## Customer Service (`customers.py`)
- `GET /customers`: Lists Business Partners.
- `POST /customers`: Creates new Business Partner.
- `GET /customers/{id}`: Retrieves specific BP details.

## Settings & Administration (`admin.py`)
- `GET /admin/users`: Lists application users.
- `POST /admin/users`: Provisions new users.
- `PATCH /admin/users/{id}`: Updates roles/branch assignments.
- `GET /admin/branches`: Fetches SAP Warehouses.
- `GET /admin/health`: Deep system health checks.
