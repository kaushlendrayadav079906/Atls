# ATLAS — Login and Admin Setup Guide

**Guide Version:** 1.0.0  
**Target Environment:** Development, Staging, and Production  

---

## 1. Unified Shared Login Page

ATLAS provides a single shared login portal for both company administrators and retail/operational employees.

### 1.1 Field Requirements & Validations
- **Identifier:** Username or registered Email address.
- **Password:** Secret passphrase (with interactive Show/Hide eye toggle).
- **Validation:** 
  - Prevents empty submissions with visual helper alerts.
  - Interactive spinner indicator during credential verification.
  - Explicit error handling distinguishing:
    - **Invalid credentials** (HTTP 401).
    - **Deactivated / Suspended account** (HTTP 401 with deactivated account message).
    - **Backend server or database unavailability** (HTTP 503).

### 1.2 Session & Cookie / Token Lifecycle
- On successful authentication, the FastAPI backend issues an authenticated JWT token signed with `SECRET_KEY` via `HS256`.
- The token payload embeds:
  - `sub`: Username
  - `user_id`: Unique UUID
  - `role`: Role (`admin`, `manager`, `operator`, `user`)
  - `branch_id`: Assigned SAP warehouse code (e.g., `SH`)
  - `token_version`: Integer tracking session validity for instant global revocation
- Tokens expire automatically after the configured lifetime (`ACCESS_TOKEN_EXPIRE_MINUTES`, default 1440 minutes / 24 hours).
- Calling `POST /api/v1/auth/logout` invalidates the session both locally and server-side.

---

## 2. Administrator Bootstrap Procedure

To prevent hardcoded administrative passwords in version control while ensuring reliable deployment, ATLAS provides an administrative bootstrap script.

### 2.1 Automated CLI Bootstrap

Run the secure bootstrap script from the `pos-backend` directory:

```bash
cd pos-inventory/pos-backend
python scripts/bootstrap_admin.py --username admin --email admin@example.com --password "YourStrongPassword#2026" --name "System Administrator"
```

### 2.2 Interactive Prompt (Non-Echo)
If parameters are omitted, the script prompts securely for passwords without echoing keystrokes:

```bash
python scripts/bootstrap_admin.py --interactive
```

### 2.3 Environment-Based Bootstrap
On containerized deployments (Docker / Kubernetes), set the following backend environment variables:
- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_NAME`

When `pos-backend` starts up, it automatically ensures at least one active administrator account exists. If no administrators exist in the database, it creates the administrator account transactionally and logs the initialization event into the audit trail.

---

## 3. Managing Users, Roles, and Granular Permissions

### 3.1 Navigating to Admin Management
Only users with the `admin` role or `users.manage` permission can view and access the **Settings > Users & Roles** interface (`/settings`). Unauthorized employees are immediately redirected or shown an Access Denied guard.

### 3.2 Creating an Employee Account
1. Open **Settings > Users & Roles**.
2. Click the **Add User** button.
3. Fill in Full Name, Username, Email, Temporary Password, and Role (`Manager`, `Cashier`, or `Operator`).
4. Select the user's assigned SAP Branch / Warehouse (or leave Unassigned for cross-branch managers).
5. Click **Create User**. The new account is saved with PBKDF2-SHA256 password hashing.

### 3.3 Configuring Granular Permissions
1. In the user table, click **Permissions** next to any employee.
2. The modal displays permission groups matching ATLAS modules:
   - Dashboard (`dashboard.view`)
   - Product & Inventory (`products.view`, `products.create`, `products.edit`, `products.delete`, `products.export`)
   - Point of Sale (`pos.access`, `pos.checkout`)
   - Sales & Invoices (`invoices.view`, `invoices.create`, `invoices.edit`, `invoices.export`)
   - Sales Orders (`sales_orders.view`, `sales_orders.create`, `sales_orders.edit`, `sales_orders.export`)
   - Customers (`customers.view`, `customers.create`, `customers.edit`)
   - Returns & Approvals (`returns.view`, `returns.create`, `returns.approve`, `returns.process`)
   - Production (`production.view`, `production.orders.view`, `production.reports.view`)
   - Financial (`finance.view`, `finance.invoices.view`, `finance.payments.view`, `finance.reports.view`)
   - Reports (`reports.view`, `reports.export`)
3. Toggle checkmarks for specific permissions.
4. Click **Save Permissions**. The changes take effect immediately; the user's token session version is updated to force permission re-evaluation on their next request.

### 3.4 Revoking Sessions & Deactivating Accounts
- **Revoke Sessions:** Immediately increments the user's `token_version`. The user's next API request will return 401 Unauthorized, redirecting them to the login screen.
- **Deactivate Account:** Sets `is_active = FALSE` and revokes active sessions. Deactivated users cannot log in.
- **Safety Lock:** The backend strictly prevents deactivating or demoting the last remaining active administrator account to avoid system lockout.
