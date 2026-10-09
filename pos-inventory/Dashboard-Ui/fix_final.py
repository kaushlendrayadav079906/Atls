import os
import re

pages = [
    "ProductionOverviewPage.tsx",
    "ProductionOrdersPage.tsx",
    "ProductionItemWisePage.tsx",
    "ProductionRejectionPage.tsx",
    "ProductionDateWisePage.tsx",
    "ProductionReportsPage.tsx"
]

for p in pages:
    path = os.path.join("src/pages/production", p)
    if not os.path.exists(path): continue
    
    with open(path, "r", encoding="utf-8") as f:
        c = f.read()

    # Add DateRange type if missing
    if "type DateRange =" not in c:
        c = c.replace("export const Production", "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';\n\nexport const Production")
        c = c.replace("export default function Production", "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';\n\nexport default function Production")

    # Add getLocalISODate import
    if "getLocalISODate" not in c and "import { getLocalISODate" not in c:
        c = c.replace("import ", "import { getLocalISODate } from '../../utils/date';\nimport ", 1)
        
    # Remove custom UI variables usage from JSX
    c = re.sub(r"setCustomFrom\([^)]*\)", "undefined", c)
    c = re.sub(r"setCustomTo\([^)]*\)", "undefined", c)
    c = c.replace("value={customFrom}", 'value=""')
    c = c.replace("value={customTo}", 'value=""')
    
    # Fix OverviewPage imports
    if p == "ProductionOverviewPage.tsx":
        if "useEffect" not in c[:c.find("from 'react'")]:
            c = c.replace("useState", "useState, useEffect")

    with open(path, "w", encoding="utf-8") as f:
        f.write(c)

print("Final patch applied")
