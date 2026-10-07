# Returns & Approvals - Fix Audit

## 1. "Unable to load return requests. Admin access required." Issue
- **Broken State:** The frontend `returnsApi.getApprovalQueue` was fetching `/admin/approvals`. In `app/api/v1/admin.py`, this endpoint was protected by `Depends(require_admin)`. This hard-blocked Managers and POS Operators from viewing the queue, returning a 401/403.
- **Fix:** Changed the dependency to `Depends(get_current_user)`. Implemented explicit role checking inside the endpoint: Admins see all requests (or filtered by requested `branch_id`), while Managers and POS Operators are restricted to seeing only requests from their assigned `branch_id`.

## 2. Backend Pagination, Search, and Filtering
- **Broken State:** `approval_service.get_pending_approvals` lacked support for fetching anything other than pending/failed requests, breaking the "All", "Approved", and "Rejected" tabs. It also did not support pagination or server-side searching, meaning all filtering was forced to be client-side.
- **Fix:** Rewrote `approval_service.get_pending_approvals` into `get_approvals`. Added `OFFSET`, `LIMIT`, and `WHERE` clauses for `branch_id`, `start_date`, `end_date`, `status`, and `search`. Included a window function to return total row counts for pagination, and an aggregate sub-query to return dynamic tab counts.

## 3. Manager Approval Rights
- **Broken State:** `ReturnsApprovalsPage.tsx` hard-coded `isAdmin = user?.role === 'admin'` and blocked the Approve/Reject buttons if false. Additionally, the `/approvals/{req_id}/approve` endpoint required admin access.
- **Fix:** Changed UI to `canApprove = admin || manager`. Updated the backend `approve_request` and `reject_request` endpoints in `admin.py` to allow managers, while still enforcing that they cannot approve cross-branch or self-approve.

## 4. Dynamic KPI Cards and Tabs
- **Broken State:** KPI cards and tabs relied strictly on whatever data was locally loaded into the frontend arrays, failing to scale or reflect the actual total database values.
- **Fix:** Integrated the backend's `counts` response (which aggregates pending/completed/rejected directly from Postgres) into the frontend `totalCounts` state, ensuring accurate global representations regardless of the current pagination slice.

## 5. UI Alignment & Functional Filters
- **Broken State:** The UI lacked functional date range, branch, and status dropdowns as shown in the reference image. The search bar filtered client-side arrays only.
- **Fix:** Replaced dummy UI elements in `ReturnsApprovalsPage.tsx` with functional selects (CalendarDays for dates, Building2 for branches, ListFilter for status). Passed these states via React Query to `returnsApi.getApprovalQueue`, establishing true server-side reactivity with debounce.
