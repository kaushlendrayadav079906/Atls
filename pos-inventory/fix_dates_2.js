const fs = require('fs');
const path = require('path');

const files = [
  'ProductionOrdersPage.tsx',
  'ProductionOverviewPage.tsx',
  'ProductionItemWisePage.tsx',
  'ProductionRejectionPage.tsx',
  'ProductionDateWisePage.tsx',
  'ProductionReportsPage.tsx'
];

const dir = path.join(__dirname, 'Dashboard-Ui/src/pages/production');

files.forEach(f => {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');

    const regex = /const \{ date_from, date_to \} = useMemo\(\(\) => \{[\s\S]*?return \{ date_from: from, date_to: to \};\n  \}, \[dateRange, customFrom, customTo\]\);/;

    const newBlock = `const { date_from, date_to } = useMemo(() => {
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
    } else if (dateRange === 'custom') {
      return { date_from: customFrom, date_to: customTo };
    }

    return { date_from: from, date_to: to };
  }, [dateRange, customFrom, customTo]);`;

    content = content.replace(regex, newBlock);
    fs.writeFileSync(p, content);
    console.log('Fixed', f);
  }
});
