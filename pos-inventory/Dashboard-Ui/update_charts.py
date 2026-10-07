import os

dashboard_path = r'c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\Dashboard-Ui\src\pages\Dashboard.tsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to add the recharts imports at the top
import_str = """import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
"""
# Insert after other imports
content = content.replace("import { Link } from 'react-router-dom';", "import { Link } from 'react-router-dom';\n" + import_str)

# Find the start of the charts section
start_charts_idx = content.find('<div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">')
end_charts_idx = content.find(' {/* Tables */}')

if start_charts_idx != -1 and end_charts_idx != -1:
    new_charts = """<div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            {/* Sales Overview */}
            <div className="rounded-[16px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Sales Overview</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] font-medium text-slate-500">
                  {['daily', 'weekly', 'monthly', 'yearly', 'all_time'].map((p) => (
                    <button 
                      key={p} 
                      className={`px-3 py-1.5 rounded-md transition-colors ${period === p ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:text-slate-900'}`}
                      onClick={() => setPeriod(p)}
                    >
                      {p === 'daily' ? 'Today' : p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : p === 'yearly' ? 'Year' : 'Total'}
                    </button>
                  ))}
                </div>
              </div>

              {loadingTrend ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">Loading chart...</div>
              ) : errorTrend ? (
                <StateMessage type="error" message="Failed to load trend" />
              ) : (trendPoints.length === 0 ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">No sales data for this period</div>
              ) : (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey={(d) => (d.label || d.date || '').split(' ')[0]} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        dy={10} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'K' : value}`}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Sales']}
                        labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#0ea5e9" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorSales)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
              <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5 font-medium"><span className="h-1 w-4 rounded-full bg-sky-500" /> Current Period</span>
              </div>
            </div>

            {/* Orders Overview */}
            <div className="rounded-[16px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Orders Overview</span>
                </div>
              </div>
              
              {loadingTrend ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">Loading orders...</div>
              ) : errorTrend ? (
                <StateMessage type="error" message="Failed to load orders" />
              ) : (trendPoints.length === 0 ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">No orders for this period</div>
              ) : (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey={(d) => (d.label || d.date || '').split(' ')[0]} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        dy={10} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        allowDecimals={false}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [value, 'Orders']}
                        labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar 
                        dataKey="invoice_count" 
                        fill="url(#colorOrders)" 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>
"""
    
    content = content[:start_charts_idx] + new_charts + "\n" + content[end_charts_idx:]
    
    with open(dashboard_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Recharts added!")
else:
    print("Could not find insertion points!")
