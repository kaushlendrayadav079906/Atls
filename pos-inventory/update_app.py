import sys

content = open('pos-frontend/src/App.tsx', 'r', encoding='utf-8').read()
if 'InventoryRiskView' not in content:
    content = content.replace(
        'import AtlasDashboard from "./pages/atlas/AtlasDashboard";',
        'import AtlasDashboard from "./pages/atlas/AtlasDashboard";\nimport InventoryRiskView from "./pages/atlas/InventoryRiskView";'
    )
    content = content.replace(
        '<Route path="atlas" element={<AtlasDashboard />} />',
        '<Route path="atlas" element={<AtlasDashboard />} />\n          <Route path="inventory-alerts" element={<InventoryRiskView />} />'
    )
    open('pos-frontend/src/App.tsx', 'w', encoding='utf-8').write(content)
