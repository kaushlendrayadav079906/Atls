# ATLAS — Role and Permission Matrix

**System:** ATLAS POS, Inventory, Sales, Production, Finance & Reports  
**Version:** 1.0.0  
**Effective Date:** October 2026  

---

## 1. Overview

ATLAS uses a hybrid Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) architecture:
1. **Roles:** High-level groupings (`admin`, `manager`, `operator`, `user` / `cashier`).
2. **Granular Permissions:** Specific per-module and per-action privileges (`<module>.<action>`).
3. **User-Level Overrides:** Custom permissions granted or denied directly to an individual employee by an administrator.
4. **Scope Constraints:** Branch, warehouse, and SAP tenant constraints are evaluated alongside permissions.

---

## 2. Standard Permission Catalog

The following table defines all official permission identifiers in the ATLAS platform:

| Module Group | Permission Identifier | Action Type | Description |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `dashboard.view` | Read | Access the main overview dashboard and analytics widgets |
| **Products & Inventory** | `products.view` | Read | View products, categories, barcode, prices, and stock levels |
| | `products.create` | Create | Create new products or stock definitions in the catalog |
| | `products.edit` | Edit | Modify existing product details, prices, or descriptions |
| | `products.delete` | Delete | Archive or delete products from the local system |
| | `products.export` | Export | Download product catalog lists or stock reports |
| **Point of Sale** | `pos.access` | Read | Access the POS terminal page and scan items |
| | `pos.checkout` | Execute | Create orders, submit cash/card/UPI payments, and issue receipts |
| **Sales Orders** | `sales_orders.view` | Read | View sales order listing and individual order details |
| | `sales_orders.create` | Create | Create new customer sales orders in the system |
| | `sales_orders.edit` | Edit | Modify pending sales orders |
| | `sales_orders.export` | Export | Export sales orders to spreadsheet or CSV |
| **Sales Invoices** | `invoices.view` | Read | View sales invoices, tax summaries, and customer bills |
| | `invoices.create` | Create | Generate sales invoices and process SAP billing documents |
| | `invoices.edit` | Edit | Update invoice remarks or customer attribution |
| | `invoices.export` | Export | Export invoice reports and financial summaries |
| **Purchase Orders** | `purchase_orders.view`| Read | View purchase orders submitted to vendors |
| | `purchase_orders.create`| Create | Create new purchase orders |
| | `purchase_orders.edit` | Edit | Modify vendor purchase orders |
| | `purchase_orders.export`| Export | Export purchase order summaries |
| **Customers** | `customers.view` | Read | View customer profiles, contact numbers, and purchase history |
| | `customers.create` | Create | Register new customer profiles |
| | `customers.edit` | Edit | Update customer information, address, or phone number |
| **Returns & Approvals** | `returns.view` | Read | View return and exchange requests and logs |
| | `returns.create` | Create | Submit an item return or exchange request |
| | `returns.approve` | Approve | Review and approve/reject high-value return/refund workflows |
| | `returns.process` | Execute | Post approved credit notes or replacement invoices to SAP |
| **Production** | `production.view` | Read | View production overview, item-wise, and date-wise status |
| | `production.orders.view`| Read | View manufacturing production orders |
| | `production.reports.view`| Read | View scrap, rejection, and yield production reports |
| **Financial** | `finance.view` | Read | View finance overview, balance KPIs, and cash summaries |
| | `finance.invoices.view` | Read | View accounts payable purchase invoices |
| | `finance.payments.view` | Read | View incoming and outgoing payment transactions |
| | `finance.reports.view` | Read | View customer/supplier financial aging & profitability reports |
| **Reports** | `reports.view` | Read | Access the Reports Hub (Sales, Invoice, Payment, Inventory) |
| | `reports.export` | Export | Download official Excel/CSV analytical reports |
| **Settings & Admin** | `settings.view` | Read | Access administrative settings navigation |
| | `users.manage` | Admin | Create, edit, activate, deactivate users and view logins |
| | `roles.manage` | Admin | Modify role assignments and role definitions |
| | `permissions.manage` | Admin | Assign or revoke granular permissions per user |

---

## 3. Role-Based Default Assignment Matrix

| Permission Identifier | Administrator (`admin`) | Operations Manager (`manager`) | Operator / Cashier (`user`) | Read-Only Auditor |
| :--- | :---: | :---: | :---: | :---: |
| `dashboard.view` | **Yes** | **Yes** | **Yes** | **Yes** |
| `products.view` | **Yes** | **Yes** | **Yes** | **Yes** |
| `products.create` | **Yes** | **Yes** | No | No |
| `products.edit` | **Yes** | **Yes** | No | No |
| `products.delete` | **Yes** | No | No | No |
| `products.export` | **Yes** | **Yes** | No | **Yes** |
| `pos.access` | **Yes** | **Yes** | **Yes** | No |
| `pos.checkout` | **Yes** | **Yes** | **Yes** | No |
| `sales_orders.view` | **Yes** | **Yes** | **Yes** | **Yes** |
| `sales_orders.create` | **Yes** | **Yes** | **Yes** | No |
| `sales_orders.edit` | **Yes** | **Yes** | No | No |
| `sales_orders.export` | **Yes** | **Yes** | No | **Yes** |
| `invoices.view` | **Yes** | **Yes** | **Yes** | **Yes** |
| `invoices.create` | **Yes** | **Yes** | **Yes** | No |
| `invoices.edit` | **Yes** | **Yes** | No | No |
| `invoices.export` | **Yes** | **Yes** | No | **Yes** |
| `purchase_orders.view` | **Yes** | **Yes** | No | **Yes** |
| `purchase_orders.create`| **Yes** | **Yes** | No | No |
| `purchase_orders.edit` | **Yes** | **Yes** | No | No |
| `purchase_orders.export`| **Yes** | **Yes** | No | **Yes** |
| `customers.view` | **Yes** | **Yes** | **Yes** | **Yes** |
| `customers.create` | **Yes** | **Yes** | **Yes** | No |
| `customers.edit` | **Yes** | **Yes** | No | No |
| `returns.view` | **Yes** | **Yes** | **Yes** | **Yes** |
| `returns.create` | **Yes** | **Yes** | **Yes** | No |
| `returns.approve` | **Yes** | **Yes** | No | No |
| `returns.process` | **Yes** | **Yes** | No | No |
| `production.view` | **Yes** | **Yes** | No | **Yes** |
| `production.orders.view`| **Yes** | **Yes** | No | **Yes** |
| `production.reports.view`| **Yes** | **Yes** | No | **Yes** |
| `finance.view` | **Yes** | **Yes** | No | **Yes** |
| `finance.invoices.view` | **Yes** | **Yes** | No | **Yes** |
| `finance.payments.view` | **Yes** | **Yes** | No | **Yes** |
| `finance.reports.view` | **Yes** | **Yes** | No | **Yes** |
| `reports.view` | **Yes** | **Yes** | No | **Yes** |
| `reports.export` | **Yes** | **Yes** | No | **Yes** |
| `settings.view` | **Yes** | No | No | No |
| `users.manage` | **Yes** | No | No | No |
| `roles.manage` | **Yes** | No | No | No |
| `permissions.manage` | **Yes** | No | No | No |

---

## 4. User-Level Custom Permissions Evaluation

When a user logs in or makes an API request:
1. If user `role == "admin"`, user receives all permissions (`*`).
2. Otherwise, system resolves the base permissions associated with their `role`.
3. If custom entries exist in `user_permissions` table:
   - Specific granted permissions are appended.
   - Specific denied permissions are subtracted.
4. The calculated set represents the **Effective Permissions**.
5. Effective permissions are cached per request and returned in the `/auth/me` and `/auth/login` responses for frontend route and component authorization.
