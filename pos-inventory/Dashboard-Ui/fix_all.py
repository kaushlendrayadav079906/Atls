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
    c = re.sub(r"type DateRange = [^;]+;", "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';", c)
    
    # 2. State
    c = re.sub(r"const \[dateRange, setDateRange\] = useState<DateRange>\(.*?\);", "const [dateRange, setDateRange] = useState<DateRange>('total');", c)
    c = re.sub(r"const \[customFrom, setCustomFrom\] = useState[^\n]*\n", "", c)
    c = re.sub(r"const \[customTo, setCustomTo\] = useState[^\n]*\n", "", c)
    
    # 3. useMemo
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
    
    c = re.sub(r"const \{ date_from, date_to \} = useMemo\(\(\) => \{.*?\},\s*\[.*?\]\);", use_memo_str, c, flags=re.DOTALL)
    
    # 4. Buttons
    c = re.sub(r"\(\['today', 'week', 'month', 'year', 'custom'\] as const\)", "(['today', 'week', 'month', 'year', 'total'] as const)", c)
    
    # 5. Enabled
    c = re.sub(r"enabled:\s*!!date_from\s*&&\s*!!date_to", "enabled: dateRange === 'total' || (!!date_from && !!date_to)", c)
    
    # 6. Custom Picker UI
    c = re.sub(r"\{\s*dateRange === 'custom' &&\s*\(\s*<div className=\"flex items-center gap-2[\s\S]*?</div>\s*\)\s*\}", "", c)

    with open(path, "w", encoding="utf-8") as f:
        f.write(c)

print("Dates fixed")
