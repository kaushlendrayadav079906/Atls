const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages', 'production');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Add getLocalISODate import if needed
  if (content.includes('getLocalISODate') && !content.includes('getLocalISODate')) {
    // Wait, the check above is wrong, let's just do:
  }
  if (content.includes('getLocalISODate') && !content.includes('import { getLocalISODate }')) {
    content = content.replace(
      "import {",
      "import { getLocalISODate } from '../../utils/date';\nimport {"
    );
    changed = true;
  }

  // Fix the overlap issue in enabled: dateRange === 'total' || (dateRange === 'total' || (!!date_from && !!date_to))
  const matchOverlap = content.match(/enabled:\s*dateRange\s*===\s*'total'\s*\|\|\s*\(dateRange\s*===\s*'total'\s*\|\|\s*\(\!\!date_from\s*&&\s*\!\!date_to\)\),/g);
  if (matchOverlap) {
    for (const match of matchOverlap) {
      content = content.replace(match, "enabled: dateRange === 'total' || (!!date_from && !!date_to),");
    }
    changed = true;
  }

  if (file === 'ProductionOverviewPage.tsx') {
    // Fix imports
    content = content.replace(
      "import React, { useState, useMemo } from 'react';",
      "import React, { useState, useMemo, useEffect } from 'react';"
    );
    content = content.replace(
      "import { ChevronLeft, ChevronRight,  useQuery } from '@tanstack/react-query';",
      "import { useQuery } from '@tanstack/react-query';"
    );
    
    // Insert DateRange type definition before export const ProductionOverviewPage
    if (!content.includes('type DateRange =')) {
      content = content.replace(
        "export const ProductionOverviewPage = () => {",
        "type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';\n\nexport const ProductionOverviewPage = () => {"
      );
    }
    
    // Replace PaginationFooter with custom simple div
    const paginationRegex = /<PaginationFooter[\s\S]*?\/>/g;
    content = content.replace(paginationRegex, (match) => {
      if (match.includes('ordersPage')) {
        return `<div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                  disabled={ordersPage === 1}
                  className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="px-4 py-1.5 text-sm font-medium text-slate-700">
                  Page {ordersPage} of {recentOrders?.total_pages || 1}
                </div>
                <button
                  onClick={() => setOrdersPage(p => Math.min(recentOrders?.total_pages || 1, p + 1))}
                  disabled={ordersPage >= (recentOrders?.total_pages || 1)}
                  className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>`;
      }
      return match;
    });

    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed', file);
  }
}
