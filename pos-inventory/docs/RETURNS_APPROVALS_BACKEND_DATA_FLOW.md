# Returns & Approvals Backend Data Flow

## Overview
This document traces the data flow from the React frontend, through the FastAPI backend, down to the PostgreSQL workflow database and SAP Business One.

## Data Flow Architecture

### 1. Creation Flow (Returns/Exchanges)
1. **React**: User submits a return request targeting an existing SAP invoice.
2. **API**: `POST /api/v1/returns/refund`
3. **FastAPI Route**: `app/api/v1/returns.py -> create_return()`
4. **Service (SAP)**: `SAPInvoicesService.get_invoice(originalDocEntry)` validates the source invoice with the SAP Service Layer.
5. **Service (DB)**: `approval_service.create_approval_request()` stores a snapshot of the return details (items, prices, customer) into the `approval_requests` PostgreSQL table.
   * **Note:** This intentionally captures a *snapshot* of the SAP data at the moment of request to ensure the approver reviews the exact data submitted, avoiding mutations if SAP data changes post-submission.

### 2. Retrieval Flow (Approvals Queue)
1. **React**: `ReturnsApprovalsPage.tsx` loads.
2. **API**: `GET /api/v1/admin/approvals` (with pagination, date, branch, and status filters).
3. **FastAPI Route**: `app/api/v1/admin.py -> get_approvals()`
4. **Service (DB)**: `approval_service.get_approvals()`
5. **Query**: Executes a `SELECT` on the `approval_requests` PostgreSQL table applying limit, offset, date range, and branch scoping.
6. **Response**: Returns paginated rows along with aggregate counts calculated dynamically via SQL window functions.

### 3. Action Flow (Approve/Reject)
1. **React**: User clicks "Approve" or "Reject".
2. **API**: `POST /api/v1/admin/approvals/{id}/approve`
3. **FastAPI Route**: `app/api/v1/admin.py -> approve_request()`
4. **Service (DB)**: `update_approval_status()` transitions the workflow state in PostgreSQL.
5. **Service (SAP)**: (If implemented) Dispatches the final approved return to the SAP Service Layer to generate a Credit Note.

## Analysis of "Repeated Data"
The frontend is exclusively rendering live database records. The repeated values observed (e.g., identical `Invoice No.` or `Customer Name`) arise strictly because multiple approval requests have been submitted against the **same source SAP invoice** during manual application testing. The application does not currently enforce a strictly `1:1` unique constraint preventing multiple active return requests for a single invoice.
