import os

FRONTEND_DIR = r"c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\Dashboard-Ui"

def patch_app_and_layout():
    app_tsx_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    layout_tsx_path = os.path.join(FRONTEND_DIR, "src", "components", "Layout.tsx")
    
    with open(app_tsx_path, "r", encoding="utf-8") as f:
        app_content = f.read()
        
    if "InventoryReportPage" not in app_content:
        app_content = app_content.replace(
            "import { CustomersPage } from './pages/CustomersPage';",
            "import { CustomersPage } from './pages/CustomersPage';\nimport { InventoryReportPage } from './pages/InventoryReportPage';"
        )
        app_content = app_content.replace(
            "<Route path=\"/reports/payments\" element={<PaymentReportPage />} />",
            "<Route path=\"/reports/payments\" element={<PaymentReportPage />} />\n              <Route path=\"/reports/inventory\" element={<InventoryReportPage />} />"
        )
        with open(app_tsx_path, "w", encoding="utf-8") as f:
            f.write(app_content)
            
    with open(layout_tsx_path, "r", encoding="utf-8") as f:
        layout_content = f.read()
        
    if "/reports/inventory" not in layout_content:
        replacement = "{ path: '/reports/payments', label: 'Payment Reports' },\n        { path: '/reports/inventory', label: 'Inventory Reports' },"
        if "{ path: '/reports/payments', label: 'Payment Reports' }" in layout_content:
             layout_content = layout_content.replace("{ path: '/reports/payments', label: 'Payment Reports' }", replacement)
             with open(layout_tsx_path, "w", encoding="utf-8") as f:
                 f.write(layout_content)
                 
    print("App and Layout patched")

if __name__ == "__main__":
    patch_app_and_layout()
