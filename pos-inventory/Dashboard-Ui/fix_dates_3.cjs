const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages', 'production');
const pages = [
  'ProductionOverviewPage.tsx',
  'ProductionOrdersPage.tsx',
  'ProductionItemWisePage.tsx',
  'ProductionRejectionPage.tsx',
  'ProductionDateWisePage.tsx',
  'ProductionReportsPage.tsx'
];

for (const page of pages) {
  const filePath = path.join(pagesDir, page);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace State Types
  content = content.replace(
    /type DateRange = 'today' \| 'week' \| 'month' \| 'year' \| 'custom';/g,
    "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';"
  );

  // Replace initial state
  content = content.replace(
    /const \[dateRange, setDateRange\] = useState<DateRange>\('month'\);/g,
    "const [dateRange, setDateRange] = useState<DateRange>('month');"
  );
  
  // Remove customFrom, customTo
  content = content.replace(/const \[customFrom, setCustomFrom\].*?\n/g, "");
  content = content.replace(/const \[customTo, setCustomTo\].*?\n/g, "");

  // Update useMemo for dateRange
  const useMemoRegex = /const { date_from, date_to } = useMemo\(\(\) => {[\s\S]*?}, \[dateRange, customFrom, customTo\]\);/g;
  
  const newUseMemo = `const { date_from, date_to } = useMemo(() => {
    if (dateRange === 'total') {
      return { date_from: undefined, date_to: undefined };
    }

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
  }, [dateRange]);`;

  content = content.replace(useMemoRegex, newUseMemo);

  // Update Buttons
  content = content.replace(
    /\(\['today', 'week', 'month', 'year', 'custom'\] as const\)/g,
    "(['today', 'week', 'month', 'year', 'total'] as const)"
  );

  // Remove the Custom Date Picker UI
  content = content.replace(
    /{\s*dateRange === 'custom' && \([\s\S]*?}\)/g,
    ""
  );
  
  // Replace references in query definitions if enabled uses date_from and date_to
  // for total we still want it to be enabled.
  content = content.replace(/enabled: !!date_from && !!date_to,/g, "enabled: dateRange === 'total' || (!!date_from && !!date_to),");

  fs.writeFileSync(filePath, content);
}
console.log("Updated date filters in 6 pages");
