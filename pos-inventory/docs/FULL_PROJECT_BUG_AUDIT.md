# FULL PROJECT BUG AUDIT

## Findings

| Level | Type | File | Line | Description |
|-------|------|------|------|-------------|
| HIGH | Hardcoded Data | `patch_customers_react.py:64` | 64 | Found 'WH-001' hardcoded |
| HIGH | Hardcoded Data | `patch_customers_react.py:64` | 64 | Found 'Main Branch' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:17` | 17 | Found 'Amazon' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:17` | 17 | Found 'AMIK KR' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:17` | 17 | Found 'Kaushal' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:17` | 17 | Found 'CUS001' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:17` | 17 | Found 'CUS002' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:17` | 17 | Found 'CUS011' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:18` | 18 | Found 'GZB' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:18` | 18 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:18` | 18 | Found 'WH-001' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:18` | 18 | Found 'Main Branch' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:18` | 18 | Found 'INV-1' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:18` | 18 | Found 'INV-2' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:18` | 18 | Found 'INV-3' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:19` | 19 | Found '₹20K' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:19` | 19 | Found '₹15K' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:19` | 19 | Found '₹0.00' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:19` | 19 | Found '0000000000' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:19` | 19 | Found '1234567890' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:20` | 20 | Found 'mock' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:20` | 20 | Found 'dummy' hardcoded |
| HIGH | Hardcoded Data | `run_full_audit.py:37` | 37 | Found 'mock' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\Dashboard.tsx:72` | 72 | Found '₹0.00' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\Dashboard.tsx:207` | 207 | Found '₹20K' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\Dashboard.tsx:208` | 208 | Found '₹15K' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\pos\PosCheckoutPage.tsx:208` | 208 | Found '0000000000' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\reports\InvoiceReportPage.tsx:77` | 77 | Found '₹0.00' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\reports\InvoiceReportPage.tsx:85` | 85 | Found '₹0.00' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\reports\PaymentReportPage.tsx:79` | 79 | Found '₹0.00' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\reports\PaymentReportPage.tsx:81` | 81 | Found '₹0.00' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\reports\SalesReportPage.tsx:307` | 307 | Found '₹0.00' hardcoded |
| HIGH | Hardcoded Data | `Dashboard-Ui\src\pages\reports\SalesReportPage.tsx:328` | 328 | Found '₹0.00' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\patch.py:62` | 62 | Found 'mock' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\scratch_final.py:37` | 37 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\scratch_sap_inv.py:10` | 10 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\admin.py:24` | 24 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\admin.py:598` | 598 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\admin.py:887` | 887 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\admin.py:888` | 888 | Found '0000000000' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:17` | 17 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:53` | 53 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:54` | 54 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:55` | 55 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:391` | 391 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:542` | 542 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:580` | 580 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:834` | 834 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\dashboard.py:927` | 927 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\returns.py:11` | 11 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\sales.py:13` | 13 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\sales.py:126` | 126 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\sales.py:127` | 127 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\sales.py:360` | 360 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\api\v1\sales.py:361` | 361 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\core\cache.py:121` | 121 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\core\config.py:40` | 40 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\services\sap\invoices_service.py:20` | 20 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\services\sap\invoices_service.py:124` | 124 | Found 'SH' hardcoded |
| HIGH | Hardcoded Data | `pos-backend\app\utils\helpers.py:42` | 42 | Found '1234567890' hardcoded |
