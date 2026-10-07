import os
import re

dashboard_path = r'c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\Dashboard-Ui\src\pages\Dashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The user wants to replace the hardcoded chart.
# Let's find the chart block and replace it.

replacement_chart = """
              {loadingTrend ? (
                <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">Loading chart...</div>
              ) : errorTrend ? (
                <StateMessage type="error" message="Failed to load trend" />
              ) : (
                <div className="relative h-[220px] rounded-xl border border-slate-200 bg-white p-2">
                  <div className="absolute left-2 top-2 flex flex-col justify-between h-[160px] text-[10px] text-slate-500">
                    <span>Max</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0</span>
                  </div>
                  <div className="ml-8 flex h-[160px] items-end justify-between px-2 pb-2">
                    {trendPoints.map((point: any, index: number) => {
                      const h = Math.max(((point.sales || 0) / chartMax) * 100, 5);
                      return (
                        <div key={index} className="flex flex-col items-center gap-2 w-full">
                          <div className="relative flex h-full w-full items-end justify-center group cursor-pointer hover:bg-slate-50">
                            <div className="w-[3px] bg-sky-500/20" style={{ height: `${h}%` }}>
                              <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-sky-400 bg-slate-50 shadow-[0_0_8px_rgba(56,189,248,0.8)] group-hover:scale-125 transition-transform" />
                            </div>
                            <div className="absolute -top-10 hidden group-hover:block whitespace-nowrap rounded border border-slate-200 bg-white px-2 py-1 text-center shadow-lg z-10">
                               <div className="text-[9px] text-slate-500">{point.date || point.label}</div>
                               <div className="text-[12px] font-bold text-slate-900">₹{point.sales?.toFixed(2) || '0.00'}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="ml-8 flex justify-between px-2 text-[10px] text-slate-500">
                     {trendPoints.map((p: any, i: number) => {
                        if (i % max(1, Math.floor(trendPoints.length / 7)) === 0) {
                            return <span key={i}>{p.date || p.label}</span>
                        }
                        return null;
                     })}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-sky-400" /> Current Period</span>
                    <span className="flex items-center gap-1.5"><span className="h-[1px] w-4 border-t border-dashed border-sky-400/50" /> Previous Period</span>
                  </div>
                </div>
              )}
"""

# Need a robust way to replace the chart block.
import re
pattern = re.compile(r'\{\s*loadingTrend \? \([\s\S]*?\{\s*loadingTrend \? \([\s\S]*?Failed to load trend[\s\S]*?<\/div>\s*\)\}\s*<\/div>', re.MULTILINE)
# Wait, this regex might be tricky. Let's just find the start and end by string matching.

start_str = '{loadingTrend ? ('
end_str = '            <div className="rounded-[16px] border border-slate-200 bg-white p-4">'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + replacement_chart + "\n            </div>\n\n" + content[end_idx:]
    # add max to imports if needed, or just define it
    if "Math.max(" not in new_content:
        pass
    new_content = new_content.replace("max(1, Math.floor", "Math.max(1, Math.floor")
    
    with open(dashboard_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Dashboard.tsx chart patched.")
else:
    print("Could not find bounds for chart in Dashboard.tsx")
