import os

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

    # Look for the dangling JSX:
    # it starts with className="text-[13px] border-none outline-none text-slate-700 bg-transparent"
    # and ends with )}
    
    start_str = "                className=\"text-[13px] border-none outline-none text-slate-700 bg-transparent\"\n              />\n              <span className=\"text-slate-400\">-</span>\n              <input\n                type=\"date\""
    
    start_idx = c.find("                className=\"text-[13px]")
    if start_idx != -1:
        end_idx = c.find("          )}", start_idx)
        if end_idx != -1:
            c = c[:start_idx] + c[end_idx + 13:]
            
    with open(path, "w", encoding="utf-8") as f:
        f.write(c)

print("Cleaned dangling JSX")
