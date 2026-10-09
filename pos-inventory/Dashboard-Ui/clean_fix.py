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

use_memo_str = """  const { date_from, date_to } = useMemo(() => {
    if (dateRange === 'total') return { date_from: undefined, date_to: undefined };
    const today = new Date();
    let from = '';
    let to = '';
    if (dateRange === 'today') {
      from = getLocalISODate(today);
      to = from;
    } else if (dateRange === 'week') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      from = getLocalISODate(startOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      to = getLocalISODate(endOfWeek);
    } else if (dateRange === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      from = getLocalISODate(startOfMonth);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      to = getLocalISODate(endOfMonth);
    } else if (dateRange === 'year') {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      from = getLocalISODate(startOfYear);
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      to = getLocalISODate(endOfYear);
    }
    return { date_from: from, date_to: to };
  }, [dateRange]);"""

for p in pages:
    path = os.path.join("src/pages/production", p)
    if not os.path.exists(path): continue
    
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    out = []
    skip = False
    in_use_memo = False
    use_memo_braces = 0
    
    for l in lines:
        # Type
        if "type DateRange =" in l:
            out.append("type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';\n")
            continue
            
        # State
        if "const [dateRange, setDateRange] =" in l:
            out.append("  const [dateRange, setDateRange] = useState<DateRange>('total');\n")
            continue
            
        # Custom dates state
        if "const [customFrom, setCustomFrom] =" in l or "const [customTo, setCustomTo] =" in l:
            continue
            
        # Buttons
        if "(['today', 'week', 'month', 'year', 'custom'] as const)" in l:
            l = l.replace("['today', 'week', 'month', 'year', 'custom']", "['today', 'week', 'month', 'year', 'total']")
            
        # Enabled
        if "enabled:" in l and "!!date_from && !!date_to" in l:
            l = l.replace("!!date_from && !!date_to", "dateRange === 'total' || (!!date_from && !!date_to)")
            
        # Custom UI block
        if "{dateRange === 'custom' && (" in l:
            skip = True
            continue
            
        if skip:
            if ")}" in l:
                # We reached the end of custom UI block
                skip = False
            continue
            
        # useMemo block replacement
        if "const { date_from, date_to } = useMemo(() => {" in l:
            in_use_memo = True
            out.append(use_memo_str + "\n")
            continue
            
        if in_use_memo:
            if "}, [dateRange, customFrom, customTo]);" in l or "}, [dateRange]);" in l:
                in_use_memo = False
            continue
            
        out.append(l)
        
    c = "".join(out)
    
    # Imports check
    if "getLocalISODate" not in c:
        c = c.replace("import", "import { getLocalISODate } from '../../utils/date';\nimport", 1)
        
    with open(path, "w", encoding="utf-8") as f:
        f.write(c)

print("Dates fixed cleanly")
