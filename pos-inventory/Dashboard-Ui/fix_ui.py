import os
import re

pages_dir = "src/pages/production"
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

for page in pages:
    path = os.path.join(pages_dir, page)
    if not os.path.exists(path):
        continue
        
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Ensure getLocalISODate is imported
    if "getLocalISODate" not in content and "import" in content:
        content = content.replace("import", "import { getLocalISODate } from '../../utils/date';\nimport", 1)

    # Replace type DateRange
    content = re.sub(r"type DateRange\s*=\s*'today'\s*\|\s*'week'\s*\|\s*'month'\s*\|\s*'year'\s*\|\s*'custom'\s*;", "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';", content)
    
    # Remove custom date states
    content = re.sub(r"const\s*\[customFrom,\s*setCustomFrom\]\s*=\s*useState[^;]+;", "", content)
    content = re.sub(r"const\s*\[customTo,\s*setCustomTo\]\s*=\s*useState[^;]+;", "", content)
    
    # Replace useMemo block entirely
    content = re.sub(r"const \{ date_from, date_to \} = useMemo\(\(\) => \{.*?\},\s*\[dateRange(?:,\s*customFrom,\s*customTo)?\]\);", use_memo_str, content, flags=re.DOTALL)
    
    # Enabled fix
    content = re.sub(r"enabled:\s*!!date_from\s*&&\s*!!date_to", "enabled: dateRange === 'total' || (!!date_from && !!date_to)", content)
    
    # Update buttons array
    content = re.sub(r"\(\['today',\s*'week',\s*'month',\s*'year',\s*'custom'\]\s*as\s*const\)", "(['today', 'week', 'month', 'year', 'total'] as const)", content)

    # Remove the custom date picker div (safely, since JSX matching with regex is hard)
    # The picker starts with {dateRange === 'custom' && (
    # Let's use a simple string replace for the generic pattern
    custom_block = re.search(r"\{\s*dateRange === 'custom' &&\s*\(\s*<div.*?</div>\s*\)\s*\}", content, flags=re.DOTALL)
    if custom_block:
        content = content.replace(custom_block.group(0), "")

    # Ensure useEffect is imported in OverviewPage
    if page == "ProductionOverviewPage.tsx" and "useEffect" not in content:
        content = content.replace("useQuery", "useQuery, useEffect")
        
    # Ensure PaginationFooter is defined in OverviewPage if used
    if page == "ProductionOverviewPage.tsx" and "PaginationFooter" in content and "const PaginationFooter" not in content:
        # Oops, my script appended it before the export, but maybe it got lost or I can just re-inject it at top
        pass # I will run my JS script for pagination instead or fix it here.
        
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
