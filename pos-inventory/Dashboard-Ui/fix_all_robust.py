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
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        c = f.read()
        
    # 1. Type
    c = re.sub(r"type DateRange = [\s\S]*?;", "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';", c)
    
    # 2. Imports
    if "getLocalISODate" not in c and "import" in c:
        c = c.replace("import", "import { getLocalISODate } from '../../utils/date';\nimport", 1)
        
    if "import { ChevronLeft, ChevronRight" not in c and "lucide-react" in c:
        c = re.sub(r"import \{([\s\S]*?)\} from 'lucide-react';", r"import { ChevronLeft, ChevronRight, \1 } from 'lucide-react';", c)

    if p == "ProductionOverviewPage.tsx" and "useEffect" not in c[:c.find("from 'react'")]:
        c = c.replace("useState", "useState, useEffect")
        
    # 3. State
    c = re.sub(r"const \[dateRange, setDateRange\] = useState<DateRange>\(.*?\);", "const [dateRange, setDateRange] = useState<DateRange>('total');", c)
    
    # Custom removals
    lines = c.split('\n')
    new_lines = []
    for l in lines:
        if "setCustomFrom" in l or "setCustomTo" in l or "customFrom" in l or "customTo" in l:
            continue
        new_lines.append(l)
    c = '\n'.join(new_lines)

    # 4. useMemo
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
    
    c = re.sub(r"const \{ date_from, date_to \} = useMemo\(\(\) => \{[\s\S]*?\},\s*\[.*?\]\);", use_memo_str, c)
    
    # 5. Buttons
    c = c.replace("['today', 'week', 'month', 'year', 'custom'] as const", "['today', 'week', 'month', 'year', 'total'] as const")
    
    # 6. Enabled
    c = re.sub(r"enabled:\s*!!date_from\s*&&\s*!!date_to", "enabled: dateRange === 'total' || (!!date_from && !!date_to)", c)
    
    # 7. Remove Custom UI
    c = re.sub(r"\{\s*dateRange === 'custom' &&\s*\(\s*<div className=\"flex items-center gap-2[\s\S]*?</div>\s*\)\s*\}", "", c)

    with open(path, "w", encoding="utf-8") as f:
        f.write(c)

print("Fixed again")
