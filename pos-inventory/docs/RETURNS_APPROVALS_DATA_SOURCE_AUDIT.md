# Returns & Approvals Data Source Audit

## Overview
This document traces the data source mapping for every visible field in the Returns & Approvals page to guarantee that no mock data is utilized.

## Field Mappings

### Returns Table & Details Panel

| UI Field | Frontend Property | API Endpoint | Backend Schema | Backend Source | SAP/DB Field |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Request ID** | `request.id` | `GET /admin/approvals` | `ApprovalRequestRow.id` | PostgreSQL `approval_requests` | `id` (UUID generated on creation) |
| **Invoice No.** | `getInvoiceNumber()` | `GET /admin/approvals` | `ApprovalRequestRow.original_doc_num` | PostgreSQL `approval_requests` | `original_doc_num` (Mapped from SAP `DocNum`) |
| **Customer Name** | `getCustomerName()` | `GET /admin/approvals` | `ApprovalRequestRow.payload` | PostgreSQL `approval_requests` | `payload.cardName` (Mapped from SAP `CardName`) |
| **Amount** | `request.amount` | `GET /admin/approvals` | `ApprovalRequestRow.amount` | PostgreSQL `approval_requests` | `amount` (Calculated refund from SAP items) |
| **Date** | `request.created_at` | `GET /admin/approvals` | `ApprovalRequestRow.created_at` | PostgreSQL `approval_requests` | `created_at` (PostgreSQL Timestamp) |
| **Status** | `request.status` | `GET /admin/approvals` | `ApprovalRequestRow.status` | PostgreSQL `approval_requests` | `status` (Workflow State) |
| **Reason** | `request.reason` | `GET /admin/approvals` | `ApprovalRequestRow.reason` | PostgreSQL `approval_requests` | `reason` (User input) |
| **Items (Product, Qty)** | `getRequestItems()` | `GET /admin/approvals` | `ApprovalRequestRow.payload` | PostgreSQL `approval_requests` | `payload.items` (Mapped from SAP `DocumentLines`) |

### KPI Cards

| KPI Card | Frontend Property | API Endpoint | Backend Field | Query Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Pending Requests** | `totalCounts.pending` | `GET /admin/approvals` | `counts.pending` | `SUM(CASE WHEN status IN ('pending', 'processing'))` |
| **Approved Today** | `totalCounts.completed` | `GET /admin/approvals` | `counts.completed` | `SUM(CASE WHEN status IN ('approved', 'completed'))` |
| **Rejected Today** | `totalCounts.rejected` | `GET /admin/approvals` | `counts.rejected` | `SUM(CASE WHEN status = 'rejected')` |
| **Awaiting Review** | `totalCounts.failed` | `GET /admin/approvals` | `counts.failed` | `SUM(CASE WHEN status IN ('failed', 'outcome-unknown'))` |

## Resolution of "Dummy Data" Symptom
The investigation revealed that no mock arrays or hardcoded fallback data exist in the React frontend. The appearance of repeated data (e.g., repeated `INV-7843` for `Jane Smith`) is the result of multiple test requests being submitted against the **exact same SAP invoice** during manual application testing, resulting in multiple distinct PostgreSQL workflow records capturing the same source invoice snapshot.
