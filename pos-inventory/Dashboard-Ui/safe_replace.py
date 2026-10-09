import os

pages = [
    "ProductionOverviewPage.tsx",
    "ProductionOrdersPage.tsx",
    "ProductionItemWisePage.tsx",
    "ProductionRejectionPage.tsx",
    "ProductionDateWisePage.tsx",
    "ProductionReportsPage.tsx"
]

use_memo_old = """  const { date_from, date_to } = useMemo(() => {
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
  }, [dateRange, customFrom, customTo]);"""

use_memo_new = """  const { date_from, date_to } = useMemo(() => {
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
        c = f.read()

    # 1. Type
    c = c.replace("type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';", "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';")
    
    # 2. State
    c = c.replace("const [dateRange, setDateRange] = useState<DateRange>('month');", "const [dateRange, setDateRange] = useState<DateRange>('total');")
    
    # 3. Custom Date States
    lines = c.split('\n')
    new_lines = []
    for l in lines:
        if "const [customFrom, setCustomFrom] =" in l or "const [customTo, setCustomTo] =" in l:
            continue
        new_lines.append(l)
    c = '\n'.join(new_lines)
    
    # 4. useMemo
    c = c.replace(use_memo_old, use_memo_new)
    
    # 5. Buttons Array
    c = c.replace("(['today', 'week', 'month', 'year', 'custom'] as const)", "(['today', 'week', 'month', 'year', 'total'] as const)")
    
    # 6. Enabled condition
    c = c.replace("enabled: !!date_from && !!date_to,", "enabled: dateRange === 'total' || (!!date_from && !!date_to),")

    # 7. Remove Custom UI safely
    # It starts with {dateRange === 'custom' && (
    # And ends with )} after </div>
    custom_ui_start = "{dateRange === 'custom' && ("
    if custom_ui_start in c:
        start_idx = c.find(custom_ui_start)
        # Search for )} after start_idx
        end_str = ")}\n"
        end_idx = c.find(end_str, start_idx)
        if end_idx != -1:
            # We want to remove from start_idx to end_idx + len(end_str)
            # wait, is there another )} before the end?
            # Usually the picker is simple. Let's just remove lines manually.
            lines = c.split('\n')
            nl = []
            skip = False
            for l in lines:
                if "{dateRange === 'custom' && (" in l:
                    skip = True
                    continue
                if skip and l.strip() == ")}":
                    skip = False
                    continue
                if not skip:
                    nl.append(l)
            c = '\n'.join(nl)

    with open(path, "w", encoding="utf-8") as f:
        f.write(c)

print("Exact replace done")
