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
    
    // Add import
    if (!content.includes('getLocalISODate')) {
      content = content.replace("import { useAuth } from '../../contexts/AuthContext';", "import { useAuth } from '../../contexts/AuthContext';\nimport { getLocalISODate } from '../../utils/date';");
    }

    // Replace toISOString
    content = content.replace(/today\.toISOString\(\)\.split\('T'\)\[0\]/g, 'getLocalISODate(today)');
    content = content.replace(/startOfWeek\.toISOString\(\)\.split\('T'\)\[0\]/g, 'getLocalISODate(startOfWeek)');
    content = content.replace(/startOfMonth\.toISOString\(\)\.split\('T'\)\[0\]/g, 'getLocalISODate(startOfMonth)');
    content = content.replace(/startOfYear\.toISOString\(\)\.split\('T'\)\[0\]/g, 'getLocalISODate(startOfYear)');

    fs.writeFileSync(p, content);
    console.log('Fixed', f);
  }
});
