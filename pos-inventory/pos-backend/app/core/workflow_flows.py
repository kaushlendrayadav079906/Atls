"""
ATLAS AI Assistant — Verified Business Workflow Flowcharts
Provides deterministic, verified flowchart node-and-edge definitions for every ATLAS module:
1. Dashboard (BI data pipeline)
2. Inventory (Movement & stock levels)
3. Sales & POS (Order-to-cash)
4. Invoices & Returns (Billing & approvals)
5. Purchasing (Procure-to-pay)
6. Customers (Receivables & credit)
7. Suppliers (Payables & vendors)
8. Payments (Cash/bank reconciliation)
9. Production (Manufacturing & scrap rejection)
10. Finance (Profitability & gross margin methodology)
11. Reports (BI calculation & CSV export pipeline)
12. Settings & RBAC (Authentication & permission gatekeeper)
"""

from typing import Any, Dict, List, Optional


WORKFLOW_FLOWCHARTS: Dict[str, Dict[str, Any]] = {
    # ── 1. Dashboard BI Data Flow ─────────────────────────────────────────────
    "dashboard": {
        "id": "dashboard_bi_flow",
        "title": "Executive Dashboard Business Intelligence Pipeline",
        "module": "Dashboard",
        "description": "How live operational data is collected from POS terminals and SAP Business One, aggregated, cached, and rendered into executive KPIs.",
        "nodes": [
            {
                "id": "dash_1",
                "stepNumber": 1,
                "title": "Operational Activity Capture",
                "type": "start",
                "badge": "POS / SAP",
                "description": "Sales invoices, customer orders, and warehouse movements recorded in real-time across branches.",
                "route": "/",
                "routeLabel": "Open Dashboard"
            },
            {
                "id": "dash_2",
                "stepNumber": 2,
                "title": "SAP Service Layer Crossjoin",
                "type": "process",
                "badge": "SAP SL API",
                "description": "Backend services query OINV, ORDR, and OWOR endpoints with branch and temporal range filters.",
                "route": "/analytics",
                "routeLabel": "View Analytics"
            },
            {
                "id": "dash_3",
                "stepNumber": 3,
                "title": "Role & Branch Scope Filter",
                "type": "decision",
                "badge": "RBAC Security",
                "description": "Validates user permissions: multi-branch for Admin, single warehouse isolation for branch managers.",
                "route": "/settings",
                "routeLabel": "Check Permissions"
            },
            {
                "id": "dash_4",
                "stepNumber": 4,
                "title": "Deterministic KPI Aggregation",
                "type": "process",
                "badge": "Aggregator",
                "description": "Calculates revenue sums, invoice counts, average order values, and growth vs previous periods.",
                "route": "/reports/sales",
                "routeLabel": "Sales Reports"
            },
            {
                "id": "dash_5",
                "stepNumber": 5,
                "title": "Executive Visual Rendering",
                "type": "end",
                "badge": "Dashboard UI",
                "description": "Renders KPI cards, multi-period comparison graphs, and interactive analytical workspaces.",
                "route": "/",
                "routeLabel": "Executive Hub"
            }
        ],
        "edges": [
            {"from": "dash_1", "to": "dash_2", "label": "Transactions Logged"},
            {"from": "dash_2", "to": "dash_3", "label": "Raw Invoices Fetched"},
            {"from": "dash_3", "to": "dash_4", "label": "Scope Verified"},
            {"from": "dash_4", "to": "dash_5", "label": "Metrics Synthesized"}
        ]
    },

    # ── 2. Products & Inventory Lifecycle ─────────────────────────────────────
    "inventory": {
        "id": "inventory_lifecycle_flow",
        "title": "Product & Inventory Movement Lifecycle",
        "module": "Products",
        "description": "How stock moves from supplier goods receipts, updates warehouse stock registers, triggers reorder alerts, and decrements upon sales dispatch.",
        "nodes": [
            {
                "id": "inv_1",
                "stepNumber": 1,
                "title": "Goods Inward / Receipt",
                "type": "start",
                "badge": "Procurement",
                "description": "Stock received from supplier against Purchase Order (SAP OPDN) or internal stock transfer.",
                "route": "/purchase-orders",
                "routeLabel": "Purchase Orders"
            },
            {
                "id": "inv_2",
                "stepNumber": 2,
                "title": "Warehouse Register Update",
                "type": "process",
                "badge": "SAP OITW",
                "description": "On-hand quantity incremented for the receiving warehouse (OITW QuantityOnStock).",
                "route": "/products",
                "routeLabel": "Product Catalog"
            },
            {
                "id": "inv_3",
                "stepNumber": 3,
                "title": "Minimal Stock Threshold Check",
                "type": "decision",
                "badge": "Reorder Rule",
                "description": "Automated evaluation: Is QuantityOnStock <= MinimalStock? Triggers low-stock shortage warning.",
                "route": "/products",
                "routeLabel": "Low Stock Alerts"
            },
            {
                "id": "inv_4",
                "stepNumber": 4,
                "title": "Sales Allocation & Picking",
                "type": "process",
                "badge": "Order Fulfillment",
                "description": "Items reserved for approved sales orders or scanned at POS checkout counter.",
                "route": "/sales-orders",
                "routeLabel": "Sales Orders"
            },
            {
                "id": "inv_5",
                "stepNumber": 5,
                "title": "Stock Issue & Velocity Tracking",
                "type": "end",
                "badge": "Inventory Out",
                "description": "Stock decremented on invoice billing; sales velocity and fast-moving rankings updated.",
                "route": "/reports/inventory",
                "routeLabel": "Inventory Reports"
            }
        ],
        "edges": [
            {"from": "inv_1", "to": "inv_2", "label": "Goods Verified"},
            {"from": "inv_2", "to": "inv_3", "label": "Balance Updated"},
            {"from": "inv_3", "to": "inv_4", "label": "Stock Sufficient"},
            {"from": "inv_4", "to": "inv_5", "label": "Billed & Dispatched"}
        ]
    },

    # ── 3. Sales & POS Order-to-Cash Workflow ─────────────────────────────────
    "sales_pos": {
        "id": "sales_pos_flow",
        "title": "Point of Sale & Order-to-Cash Workflow",
        "module": "Sales",
        "description": "The complete sales lifecycle from item selection and POS checkout to payment settlement, AR invoice issuance, and stock deduction.",
        "nodes": [
            {
                "id": "pos_1",
                "stepNumber": 1,
                "title": "Customer Order / Cart Creation",
                "type": "start",
                "badge": "POS Terminal",
                "description": "Barcode scanning or manual SKU selection, customer assignment, and pricing lookup.",
                "route": "/pos",
                "routeLabel": "Open POS Terminal"
            },
            {
                "id": "pos_2",
                "stepNumber": 2,
                "title": "Stock Availability Verification",
                "type": "decision",
                "badge": "Inventory Guard",
                "description": "Ensures requested quantity is available in local branch warehouse before proceeding.",
                "route": "/products",
                "routeLabel": "Check Stock"
            },
            {
                "id": "pos_3",
                "stepNumber": 3,
                "title": "Payment Settlement",
                "type": "process",
                "badge": "Tender Hub",
                "description": "Customer tenders payment via Cash, Credit/Debit Card, UPI, or Account Credit balance.",
                "route": "/finance/incoming-payments",
                "routeLabel": "Payment Records"
            },
            {
                "id": "pos_4",
                "stepNumber": 4,
                "title": "Tax Invoice Generation (OINV)",
                "type": "process",
                "badge": "SAP Billing",
                "description": "Billed invoice generated with GST tax breakdown, printed receipt, and posted to SAP Service Layer.",
                "route": "/sales",
                "routeLabel": "Sales Invoices"
            },
            {
                "id": "pos_5",
                "stepNumber": 5,
                "title": "Inventory Ledger Deduction",
                "type": "end",
                "badge": "Stock Update",
                "description": "Immediate reduction in physical inventory; sales revenue reflected in dashboard KPIs.",
                "route": "/",
                "routeLabel": "Dashboard Overview"
            }
        ],
        "edges": [
            {"from": "pos_1", "to": "pos_2", "label": "Cart Finalized"},
            {"from": "pos_2", "to": "pos_3", "label": "Stock Verified"},
            {"from": "pos_3", "to": "pos_4", "label": "Payment Collected"},
            {"from": "pos_4", "to": "pos_5", "label": "Invoice Posted"}
        ]
    },

    # ── 4. Sales Invoices & Customer Returns ──────────────────────────────────
    "invoices_returns": {
        "id": "invoices_returns_flow",
        "title": "Sales Invoices & Customer Return Approval Workflow",
        "module": "Invoices & Returns",
        "description": "Verification of posted AR invoices, customer return requests, branch manager approvals, and credit note issuance.",
        "nodes": [
            {
                "id": "ret_1",
                "stepNumber": 1,
                "title": "Original Tax Invoice Verification",
                "type": "start",
                "badge": "SAP OINV",
                "description": "Customer presents original invoice or mobile number; invoice lines and warranty inspected.",
                "route": "/sales",
                "routeLabel": "Search Invoices"
            },
            {
                "id": "ret_2",
                "stepNumber": 2,
                "title": "Return Request Creation",
                "type": "process",
                "badge": "Return Log",
                "description": "Return reason logged (defective, wrong item, customer exchange) with item quantity and condition.",
                "route": "/returns",
                "routeLabel": "Returns Page"
            },
            {
                "id": "ret_3",
                "stepNumber": 3,
                "title": "Branch Manager Approval Gate",
                "type": "decision",
                "badge": "Manager Auth",
                "description": "Branch supervisor reviews return request, inspection photos, and purchase date window.",
                "route": "/returns",
                "routeLabel": "Pending Approvals"
            },
            {
                "id": "ret_4",
                "stepNumber": 4,
                "title": "Credit Note / Refund Issuance",
                "type": "process",
                "badge": "SAP ORIN",
                "description": "Approved return triggers AR Credit Note in SAP, balancing accounts receivable or customer refund.",
                "route": "/finance",
                "routeLabel": "Finance Hub"
            },
            {
                "id": "ret_5",
                "stepNumber": 5,
                "title": "Inventory Restock or Defective Quarantine",
                "type": "end",
                "badge": "Warehouse",
                "description": "Resalable goods returned to active stock; defective items routed to scrap quarantine.",
                "route": "/products",
                "routeLabel": "View Products"
            }
        ],
        "edges": [
            {"from": "ret_1", "to": "ret_2", "label": "Invoice Located"},
            {"from": "ret_2", "to": "ret_3", "label": "Request Submitted"},
            {"from": "ret_3", "to": "ret_4", "label": "Return Approved"},
            {"from": "ret_4", "to": "ret_5", "label": "Credit Note Issued"}
        ]
    },

    # ── 5. Purchase Orders & Procurement Lifecycle ────────────────────────────
    "purchasing": {
        "id": "purchasing_lifecycle_flow",
        "title": "Vendor Purchase & Inward Procurement Workflow",
        "module": "Purchasing",
        "description": "Step-by-step lifecycle from purchase requisition to purchase order issuance, warehouse goods receipt, and AP invoice settlement.",
        "nodes": [
            {
                "id": "po_1",
                "stepNumber": 1,
                "title": "Purchase Order Creation",
                "type": "start",
                "badge": "SAP OPOR",
                "description": "Purchase Order created with approved vendor, delivery timeline, payment terms, and item lines.",
                "route": "/purchase-orders",
                "routeLabel": "Purchase Orders"
            },
            {
                "id": "po_2",
                "stepNumber": 2,
                "title": "Vendor Delivery & Goods Inward",
                "type": "process",
                "badge": "Gate Inward",
                "description": "Vendor dispatches items; physical consignment arrives at factory or warehouse gate.",
                "route": "/purchase-orders",
                "routeLabel": "Pending POs"
            },
            {
                "id": "po_3",
                "stepNumber": 3,
                "title": "Goods Receipt PO Inspection (OPDN)",
                "type": "decision",
                "badge": "Quality Check",
                "description": "Warehouse verifies physical count against packing list and conducts QC inspection.",
                "route": "/products",
                "routeLabel": "Warehouse Stock"
            },
            {
                "id": "po_4",
                "stepNumber": 4,
                "title": "AP Purchase Invoice (OPCH)",
                "type": "process",
                "badge": "Accounts Payable",
                "description": "Commercial tax invoice matched with Goods Receipt and posted to SAP Accounts Payable.",
                "route": "/finance/purchase-invoices",
                "routeLabel": "Purchase Invoices"
            },
            {
                "id": "po_5",
                "stepNumber": 5,
                "title": "Outgoing Payment & Close PO",
                "type": "end",
                "badge": "Settlement",
                "description": "Payment issued to supplier bank account (OVPM); Purchase Order marked Closed.",
                "route": "/finance/outgoing-payments",
                "routeLabel": "Outgoing Payments"
            }
        ],
        "edges": [
            {"from": "po_1", "to": "po_2", "label": "PO Transmitted"},
            {"from": "po_2", "to": "po_3", "label": "Consignment Arrived"},
            {"from": "po_3", "to": "po_4", "label": "QC Passed & Stock Inward"},
            {"from": "po_4", "to": "po_5", "label": "Invoice Billed & Paid"}
        ]
    },

    # ── 6. Customers & Accounts Receivable ────────────────────────────────────
    "customers": {
        "id": "customers_receivables_flow",
        "title": "Customer Credit & Accounts Receivable Settlement",
        "module": "Customers",
        "description": "Managing customer master records, credit limits, unpaid invoice aging, and collection reconciliation.",
        "nodes": [
            {
                "id": "cust_1",
                "stepNumber": 1,
                "title": "Customer Master & Credit Limit",
                "type": "start",
                "badge": "SAP OCRD",
                "description": "Customer registered with phone number, GSTIN, assigned price list, and approved credit limit.",
                "route": "/customers",
                "routeLabel": "Customer Directory"
            },
            {
                "id": "cust_2",
                "stepNumber": 2,
                "title": "Credit Check on Order Placement",
                "type": "decision",
                "badge": "Credit Policy",
                "description": "Validates current outstanding balance + new order value <= credit limit.",
                "route": "/sales-orders",
                "routeLabel": "Sales Orders"
            },
            {
                "id": "cust_3",
                "stepNumber": 3,
                "title": "Invoicing & Accounts Receivable Ledger",
                "type": "process",
                "badge": "AR Ledger",
                "description": "Invoice posted to customer account; tracked in Accounts Receivable aging reports.",
                "route": "/sales",
                "routeLabel": "AR Invoices"
            },
            {
                "id": "cust_4",
                "stepNumber": 4,
                "title": "Payment Collection & Settlement",
                "type": "process",
                "badge": "SAP ORCT",
                "description": "Customer transfers payment; receipt recorded and applied to open invoices.",
                "route": "/finance/incoming-payments",
                "routeLabel": "Incoming Payments"
            },
            {
                "id": "cust_5",
                "stepNumber": 5,
                "title": "Balance Clearance & Credit Refresh",
                "type": "end",
                "badge": "Reconciled",
                "description": "Outstanding balance reduced; customer purchasing ranking and payment health updated.",
                "route": "/finance/customer-analysis",
                "routeLabel": "Customer Analysis"
            }
        ],
        "edges": [
            {"from": "cust_1", "to": "cust_2", "label": "Account Verified"},
            {"from": "cust_2", "to": "cust_3", "label": "Credit Approved"},
            {"from": "cust_3", "to": "cust_4", "label": "Payment Received"},
            {"from": "cust_4", "to": "cust_5", "label": "Invoices Cleared"}
        ]
    },

    # ── 7. Incoming & Outgoing Payments Lifecycle ─────────────────────────────
    "payments": {
        "id": "payment_reconciliation_flow",
        "title": "Payment Reconciliation & Cash Settlement Lifecycle",
        "module": "Finance",
        "description": "How funds move through cash drawers, bank transfers, and digital UPI into SAP reconciliation registers.",
        "nodes": [
            {
                "id": "pay_1",
                "stepNumber": 1,
                "title": "Payment Tender Received",
                "type": "start",
                "badge": "Tender Capture",
                "description": "Payment collected from customer or scheduled for supplier payout.",
                "route": "/finance/incoming-payments",
                "routeLabel": "Incoming Payments"
            },
            {
                "id": "pay_2",
                "stepNumber": 2,
                "title": "Payment Method Routing",
                "type": "decision",
                "badge": "Method Split",
                "description": "Classified into Cash (Branch Drawer), UPI/Card (Gateway), or Bank Transfer (NEFT/RTGS).",
                "route": "/finance",
                "routeLabel": "Finance Overview"
            },
            {
                "id": "pay_3",
                "stepNumber": 3,
                "title": "SAP Document Posting (ORCT / OVPM)",
                "type": "process",
                "badge": "SAP Payment",
                "description": "Incoming Payment (ORCT) or Outgoing Payment (OVPM) posted with reference transaction number.",
                "route": "/finance/incoming-payments",
                "routeLabel": "View Receipts"
            },
            {
                "id": "pay_4",
                "stepNumber": 4,
                "title": "Invoice Matching & Allocation",
                "type": "process",
                "badge": "Reconciliation",
                "description": "Payment amount applied against specific open invoice doc entries.",
                "route": "/sales",
                "routeLabel": "Open Invoices"
            },
            {
                "id": "pay_5",
                "stepNumber": 5,
                "title": "Ledger Settlement & Cash Flow Update",
                "type": "end",
                "badge": "Settled",
                "description": "Bank ledger balanced; cash flow KPIs and payment breakdown charts updated.",
                "route": "/reports/payment",
                "routeLabel": "Payment Reports"
            }
        ],
        "edges": [
            {"from": "pay_1", "to": "pay_2", "label": "Funds Captured"},
            {"from": "pay_2", "to": "pay_3", "label": "Method Reconciled"},
            {"from": "pay_3", "to": "pay_4", "label": "Doc Created"},
            {"from": "pay_4", "to": "pay_5", "label": "Invoices Cleared"}
        ]
    },

    # ── 8. Production & Manufacturing Lifecycle ───────────────────────────────
    "production": {
        "id": "production_manufacturing_flow",
        "title": "Production Order & Shopfloor Manufacturing Workflow",
        "module": "Production",
        "description": "Manufacturing cycle from Bill of Materials explosion to work-in-progress, quality control, and scrap rejection recording.",
        "nodes": [
            {
                "id": "prod_1",
                "stepNumber": 1,
                "title": "Bill of Materials (BOM) & Planning",
                "type": "start",
                "badge": "SAP OITT",
                "description": "Target finished good defined with standard component ratios and planned production batch size.",
                "route": "/production",
                "routeLabel": "Production Overview"
            },
            {
                "id": "prod_2",
                "stepNumber": 2,
                "title": "Production Order Release (OWOR)",
                "type": "process",
                "badge": "SAP OWOR",
                "description": "Production Order status set to Released; work center and production line scheduled.",
                "route": "/production/orders",
                "routeLabel": "Production Orders"
            },
            {
                "id": "prod_3",
                "stepNumber": 3,
                "title": "Component Issue for Production",
                "type": "process",
                "badge": "WIP Issue",
                "description": "Raw materials and sub-assemblies issued from warehouse stock to shopfloor work-in-progress.",
                "route": "/products",
                "routeLabel": "Raw Materials Stock"
            },
            {
                "id": "prod_4",
                "stepNumber": 4,
                "title": "Quality Inspection & Rejection Gate",
                "type": "decision",
                "badge": "QC Inspection",
                "description": "Completed batch evaluated against quality standards: Defective items logged to scrap rejection.",
                "route": "/production/rejection",
                "routeLabel": "Rejection Reports"
            },
            {
                "id": "prod_5",
                "stepNumber": 5,
                "title": "Finished Goods Receipt into Stock",
                "type": "end",
                "badge": "Finished Goods",
                "description": "Passed units received into warehouse inventory (OITW); production order completed and closed.",
                "route": "/production/item-wise",
                "routeLabel": "Item-wise Output"
            }
        ],
        "edges": [
            {"from": "prod_1", "to": "prod_2", "label": "Batch Planned"},
            {"from": "prod_2", "to": "prod_3", "label": "Order Released"},
            {"from": "prod_3", "to": "prod_4", "label": "Assembly Finished"},
            {"from": "prod_4", "to": "prod_5", "label": "QC Passed -> Stock Inward"}
        ]
    },

    # ── 9. Finance & Profitability Methodology ────────────────────────────────
    "finance": {
        "id": "finance_profitability_flow",
        "title": "Gross Profit & Financial Margin Calculation Methodology",
        "module": "Finance",
        "description": "Deterministic formula pipeline deriving gross profit, net revenue, and operational margins from audited SAP accounting lines.",
        "nodes": [
            {
                "id": "fin_1",
                "stepNumber": 1,
                "title": "Billed Revenue (Gross Sales)",
                "type": "start",
                "badge": "Revenue",
                "description": "Sum of all posted AR Sales Invoices (OINV DocTotal) within the selected temporal date range.",
                "route": "/sales",
                "routeLabel": "Sales Invoices"
            },
            {
                "id": "fin_2",
                "stepNumber": 2,
                "title": "Less: Returns & Credit Adjustments",
                "type": "process",
                "badge": "Contra Revenue",
                "description": "Deduction of approved AR Credit Notes (ORIN) and customer returns to establish Net Billed Revenue.",
                "route": "/returns",
                "routeLabel": "Credit Adjustments"
            },
            {
                "id": "fin_3",
                "stepNumber": 3,
                "title": "Cost of Goods Sold (COGS) Verification",
                "type": "decision",
                "badge": "Cost Baseline",
                "description": "Verifies item base cost records from SAP inventory master. If cost is missing, profit cannot be estimated.",
                "route": "/products",
                "routeLabel": "Item Cost Master"
            },
            {
                "id": "fin_4",
                "stepNumber": 4,
                "title": "Gross Margin Computation",
                "type": "process",
                "badge": "Gross Margin",
                "description": "Gross Profit = Net Sales - Verified COGS; Gross Margin % = (Gross Profit / Net Sales) * 100.",
                "route": "/finance/profitability-reports",
                "routeLabel": "Profitability Reports"
            },
            {
                "id": "fin_5",
                "stepNumber": 5,
                "title": "Cash vs Accrual Financial Health",
                "type": "end",
                "badge": "Cash Flow",
                "description": "Reconciles earned revenue against actual collections (ORCT) and pending receivables.",
                "route": "/finance",
                "routeLabel": "Finance Hub"
            }
        ],
        "edges": [
            {"from": "fin_1", "to": "fin_2", "label": "Billed Total"},
            {"from": "fin_2", "to": "fin_3", "label": "Net Revenue Established"},
            {"from": "fin_3", "to": "fin_4", "label": "Cost Verified"},
            {"from": "fin_4", "to": "fin_5", "label": "Margins Established"}
        ]
    },

    # ── 10. Reports Generation & BI Pipeline ──────────────────────────────────
    "reports": {
        "id": "reporting_bi_flow",
        "title": "Central Reporting & Data Synthesis Pipeline",
        "module": "Reports",
        "description": "How operational reports aggregate multi-dimensional parameters into synchronized tables, charts, and downloadable CSV extracts.",
        "nodes": [
            {
                "id": "rep_1",
                "stepNumber": 1,
                "title": "Report Parameter Selection",
                "type": "start",
                "badge": "User Filters",
                "description": "User selects report type, date range (Today, Week, Month, Custom), and branch warehouse scope.",
                "route": "/reports",
                "routeLabel": "Reports Hub"
            },
            {
                "id": "rep_2",
                "stepNumber": 2,
                "title": "Service Layer Query Execution",
                "type": "process",
                "badge": "Query Engine",
                "description": "Executes crossjoin query against SAP Service Layer headers and document lines.",
                "route": "/reports/sales",
                "routeLabel": "Sales Reports"
            },
            {
                "id": "rep_3",
                "stepNumber": 3,
                "title": "Completeness & Truncation Check",
                "type": "decision",
                "badge": "Audit Guard",
                "description": "Checks if result was capped at max page limits; flags partial results warning if truncated.",
                "route": "/reports/inventory",
                "routeLabel": "Inventory Reports"
            },
            {
                "id": "rep_4",
                "stepNumber": 4,
                "title": "Synchronized Chart & Table Synthesis",
                "type": "process",
                "badge": "Visualization",
                "description": "Formats columns (INR Currency, Percentages, Deltas) and builds synchronized Recharts datasets.",
                "route": "/reports/payment",
                "routeLabel": "Payment Reports"
            },
            {
                "id": "rep_5",
                "stepNumber": 5,
                "title": "Export / Business Decision Support",
                "type": "end",
                "badge": "Export Ready",
                "description": "User interacts with Chart | Results | Both tabs, sorts columns, or exports CSV.",
                "route": "/reports/ai",
                "routeLabel": "AI Reports"
            }
        ],
        "edges": [
            {"from": "rep_1", "to": "rep_2", "label": "Filters Selected"},
            {"from": "rep_2", "to": "rep_3", "label": "Records Retrieved"},
            {"from": "rep_3", "to": "rep_4", "label": "Data Complete"},
            {"from": "rep_4", "to": "rep_5", "label": "Report Rendered"}
        ]
    },

    # ── 11. Settings & RBAC Gatekeeper ────────────────────────────────────────
    "settings_rbac": {
        "id": "settings_rbac_flow",
        "title": "Authentication, RBAC & Permission Gatekeeping",
        "module": "Settings",
        "description": "How the ATLAS security framework validates user identities, computes effective permissions, and enforces branch isolation.",
        "nodes": [
            {
                "id": "sec_1",
                "stepNumber": 1,
                "title": "User Authentication & JWT Issuance",
                "type": "start",
                "badge": "Auth Service",
                "description": "Employee logs in with username and password; backend verifies bcrypt hash and issues signed JWT.",
                "route": "/settings",
                "routeLabel": "User Settings"
            },
            {
                "id": "sec_2",
                "stepNumber": 2,
                "title": "Role & Permission Resolution",
                "type": "process",
                "badge": "RBAC Engine",
                "description": "Role claims (Admin, Manager, Cashier, Viewer) expanded into effective granular permissions array.",
                "route": "/settings",
                "routeLabel": "Role Matrix"
            },
            {
                "id": "sec_3",
                "stepNumber": 3,
                "title": "Module & Action Gatekeeper",
                "type": "decision",
                "badge": "Permission Guard",
                "description": "Does user have required permission (e.g. products.edit, users.manage, dashboard.view)? If no, returns 403.",
                "route": "/settings",
                "routeLabel": "Check Access"
            },
            {
                "id": "sec_4",
                "stepNumber": 4,
                "title": "Warehouse Scope Enforcement",
                "type": "process",
                "badge": "Branch Scope",
                "description": "Non-admin queries restricted strictly to assigned warehouse; unauthorized branch queries blocked.",
                "route": "/",
                "routeLabel": "Dashboard"
            },
            {
                "id": "sec_5",
                "stepNumber": 5,
                "title": "Authorized Action & Audit Logging",
                "type": "end",
                "badge": "Audit Log",
                "description": "Request executed safely; security audit trail records timestamp, user identity, and executed action.",
                "route": "/settings",
                "routeLabel": "Security Center"
            }
        ],
        "edges": [
            {"from": "sec_1", "to": "sec_2", "label": "JWT Validated"},
            {"from": "sec_2", "to": "sec_3", "label": "Permissions Loaded"},
            {"from": "sec_3", "to": "sec_4", "label": "Access Permitted"},
            {"from": "sec_4", "to": "sec_5", "label": "Scope Verified"}
        ]
    }
}


def get_workflow_flowchart(module: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves the verified flowchart definition for the requested module or business process.
    Supports standard aliases and module identifiers.
    """
    m = str(module or "").lower().strip()
    mapping = {
        "sales": "sales_pos",
        "pos": "sales_pos",
        "order": "sales_pos",
        "inventory": "inventory",
        "product": "inventory",
        "products": "inventory",
        "stock": "inventory",
        "purchasing": "purchasing",
        "purchase": "purchasing",
        "procurement": "purchasing",
        "invoices": "invoices_returns",
        "returns": "invoices_returns",
        "credit_notes": "invoices_returns",
        "customers": "customers",
        "customer": "customers",
        "receivables": "customers",
        "payments": "payments",
        "payment": "payments",
        "production": "production",
        "manufacturing": "production",
        "factory": "production",
        "rejection": "production",
        "finance": "finance",
        "profitability": "finance",
        "dashboard": "dashboard",
        "bi": "dashboard",
        "reports": "reports",
        "reporting": "reports",
        "settings": "settings_rbac",
        "rbac": "settings_rbac",
        "users": "settings_rbac",
        "permissions": "settings_rbac"
    }

    target_key = mapping.get(m, m)
    return WORKFLOW_FLOWCHARTS.get(target_key)


SUPPORTED_WORKFLOW_MODULES = list(WORKFLOW_FLOWCHARTS.keys())
