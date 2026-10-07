import os

path = r'c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\Dashboard-Ui\src\pages\reports\SalesReportPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

hook_addition = """
  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    setChartRange(newRange);
    setAppliedFilters(prev => ({ ...prev, range: newRange }));
    setPage(1);
  };
"""

content = content.replace('const handleApplyFilters = () => {', hook_addition + '\n  const handleApplyFilters = () => {')
content = content.replace('onClick={() => setChartRange(p)}', 'onClick={() => handleRangeChange(p)}')

donut_header_old = '<h3 className="font-bold text-slate-900">Sales by Payment Method</h3>\n            </div>\n          </div>'
donut_header_new = """<h3 className="font-bold text-slate-900">Sales by Payment Method</h3>
            </div>
            <select value={chartRange} onChange={(e) => handleRangeChange(e.target.value)} className="text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-600 rounded px-2 py-1 outline-none">
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="yearly">This Year</option>
              <option value="all_time">Total</option>
            </select>
          </div>"""
content = content.replace(donut_header_old, donut_header_new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
