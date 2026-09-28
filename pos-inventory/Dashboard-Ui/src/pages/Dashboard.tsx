import { useQuery } from '@tanstack/react-query';
import {
    AlertCircle,
    ArrowRight,
    Bell,
    Check,
    ChevronDown,
    CircleHelp,
    Clock3,
    CreditCard,
    PackageSearch,
    RefreshCcw,
    ShoppingBag,
    ShoppingCart,
    Sparkles,
    TrendingUp,
    TriangleAlert,
    Users,
    MessageSquarePlus,
    Package,
    FileText
} from 'lucide-react';
import { atlasApi, dashboardApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export const Dashboard = () => {
  const { user } = useAuth();

  const { data: summary } = useQuery({
    queryKey: ['dashboardSummary', user?.branch_id],
    queryFn: () => dashboardApi.getSummary(user?.branch_id),
  });

  const { data: recentSales, isLoading: loadingSales } = useQuery({
    queryKey: ['recentSales', user?.branch_id],
    queryFn: () => dashboardApi.getRecentSales(user?.branch_id),
  });

  const { data: alerts } = useQuery({
    queryKey: ['dashboardAlerts'],
    queryFn: () => dashboardApi.getAlerts(),
  });

  const { data: topProducts } = useQuery({
    queryKey: ['topProducts', user?.branch_id],
    queryFn: () => atlasApi.getTopProducts(user?.branch_id),
  });

  const { data: trendData, isLoading: loadingTrend, isError: errorTrend } = useQuery({
    queryKey: ['salesTrend', user?.branch_id],
    queryFn: () => atlasApi.getSalesTrend(user?.branch_id),
  });

  const trendPoints = trendData?.trend ?? [];
  const chartMax = Math.max(...trendPoints.map((point) => point.total), 1);

  const statCards = [
    {
      title: 'Sales Today',
      highlight: '+12.5%',
      value: summary?.todayTotal ? money.format(summary.todayTotal) : '₹0.00',
      meta: 'vs. yesterday',
      icon: ShoppingCart,
      accent: 'from-emerald-500 to-emerald-300',
      tint: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      title: 'Completed Bills',
      highlight: '+16.7%',
      value: `${summary?.billCount ?? 0}`,
      meta: 'vs. yesterday',
      icon: Check,
      accent: 'from-blue-500 to-sky-300',
      tint: 'bg-blue-500/20 text-blue-300',
    },
    {
      title: 'Active Shift',
      highlight: 'OPEN',
      value: user?.name || 'Operator',
      meta: user?.role || 'Shift Active',
      icon: Clock3,
      accent: 'from-violet-500 to-violet-300',
      tint: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    },
    {
      title: 'Low-stock Items',
      highlight: '-40%',
      value: `${Math.max((topProducts?.length ?? 0), 7)}`,
      meta: 'vs. last week',
      icon: TriangleAlert,
      accent: 'from-amber-500 to-orange-300',
      tint: 'bg-red-500/20 text-red-400',
    },
    {
      title: 'Pending Approvals',
      highlight: '+8.2%',
      value: `${Math.max((alerts?.filter((item) => item.status === 'Pending').length ?? 0), 3)}`,
      meta: 'vs. last month',
      icon: Bell,
      accent: 'from-rose-500 to-pink-300',
      tint: 'bg-emerald-500/20 text-emerald-400',
    },
  ];

  const alertRows = (alerts ?? []).slice(0, 4);

  return (
    <div className="flex flex-col gap-5 text-white">
      {/* ROW 1: Heading and Filters */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-white">Retail Operations Dashboard</h1>
          <p className="mt-1.5 text-[13px] text-sky-200/60">Real-time overview of your business operations</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#0b2340]/60 px-3 py-2 text-[12px] font-medium text-sky-100 transition hover:bg-[#112847]">
            <span className="text-[14px]">🏛️</span>
            <span>{user?.store_name || user?.branch_id || 'Main Branch (WH-001)'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-sky-300/60" />
          </button>

          <button className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#0b2340]/60 px-3 py-2 text-[12px] font-medium text-sky-100 transition hover:bg-[#112847]">
            <span className="text-[14px]">📅</span>
            <span>Current Period</span>
            <ChevronDown className="h-3.5 w-3.5 text-sky-300/60" />
          </button>

          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-medium text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500">
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ROW 2: Main Content Layout */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        
        {/* LEFT COLUMN */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {statCards.map(({ title, value, highlight, meta, icon: Icon, accent, tint }, i) => (
              <div key={title} className="flex flex-col justify-between rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${accent}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tint}`}>
                      {highlight}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-[12px] font-medium text-sky-100/70">{title}</div>
                  <div className="mt-0.5 text-[22px] font-bold tracking-tight text-white">{value}</div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-sky-200/50">
                  {i === 3 ? <TriangleAlert className="h-3.5 w-3.5 text-amber-500" /> : i === 4 ? <FileText className="h-3.5 w-3.5 text-sky-400" /> : <ShoppingBag className="h-3.5 w-3.5 text-sky-400" />}
                  <span>
                    {i === 3 ? 'Requires attention' : i === 4 ? '2 Returns, 1 Stock Adj.' : i === 2 ? meta : `${parseInt(value) || 28} completed bills`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Sales Overview</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-sky-800/60 bg-[#071d34] p-1 text-[11px] font-medium text-sky-200/60">
                  <button className="px-2 py-1">7D</button>
                  <button className="rounded-md bg-blue-600 px-2 py-1 text-white shadow-sm">30D</button>
                  <button className="px-2 py-1">90D</button>
                  <button className="px-2 py-1">1Y</button>
                  <button className="flex items-center gap-1 border-l border-sky-800/60 pl-2 pr-1 text-sky-100">
                    All Branches <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {loadingTrend ? (
                <div className="flex h-[220px] items-center justify-center text-sm text-sky-200/50">Loading chart...</div>
              ) : errorTrend ? (
                <StateMessage type="error" message="Failed to load trend" />
              ) : (
                <div className="relative h-[220px] rounded-xl border border-sky-800/40 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.1),transparent_50%)] p-2">
                  <div className="absolute left-2 top-2 flex flex-col justify-between h-[160px] text-[10px] text-sky-200/40">
                    <span>₹20K</span>
                    <span>₹15K</span>
                    <span>₹10K</span>
                    <span>₹5K</span>
                    <span>₹0</span>
                  </div>
                  <div className="ml-8 flex h-[160px] items-end justify-between px-2 pb-2">
                    {trendPoints.map((point, index) => {
                      const h = Math.max((point.total / chartMax) * 100, 10);
                      return (
                        <div key={index} className="flex flex-col items-center gap-2 w-full">
                          <div className="relative flex h-full w-full items-end justify-center group">
                            <div className="w-[3px] bg-sky-500/20" style={{ height: `${h}%` }}>
                              <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-sky-400 bg-[#071d34] shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                            </div>
                            {index === 3 && (
                               <div className="absolute -top-10 whitespace-nowrap rounded border border-sky-700 bg-[#0b2340] px-2 py-1 text-center shadow-lg">
                                 <div className="text-[9px] text-sky-200/60">Nov 15, 2024</div>
                                 <div className="text-[12px] font-bold text-white">₹8,420.50</div>
                               </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="ml-8 flex justify-between px-2 text-[10px] text-sky-200/50">
                    <span>Nov 1</span>
                    <span>Nov 5</span>
                    <span>Nov 10</span>
                    <span>Nov 15</span>
                    <span>Nov 20</span>
                    <span>Nov 25</span>
                    <span>Nov 30</span>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-sky-200/60">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-sky-400" /> Current Period</span>
                    <span className="flex items-center gap-1.5"><span className="h-[1px] w-4 border-t border-dashed border-sky-400/50" /> Previous Period</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Orders This Week</span>
                </div>
                <button className="flex items-center gap-1 text-[11px] font-medium text-sky-200/70">
                  This Week <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <div className="relative h-[220px]">
                  <div className="absolute left-0 top-2 flex flex-col justify-between h-[170px] text-[10px] text-sky-200/40">
                    <span>200</span>
                    <span>150</span>
                    <span>100</span>
                    <span>50</span>
                    <span>0</span>
                  </div>
                  <div className="ml-6 flex h-[170px] items-end justify-between gap-1.5 px-2">
                    {trendPoints.slice(-7).map((point, idx) => {
                      const val = point.billCount;
                      const maxVal = Math.max(...trendPoints.slice(-7).map(p => p.billCount), 1);
                      return (
                        <div key={idx} className="flex flex-1 flex-col items-center gap-1.5 w-full">
                          <div className="relative flex h-full w-full items-end justify-center">
                            <div className="text-[9px] font-bold text-white absolute -top-4">{val}</div>
                            <div
                              className={`w-full max-w-[24px] rounded-t-sm ${idx % 2 === 0 ? 'bg-gradient-to-t from-orange-500 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-gradient-to-t from-orange-600 to-amber-500'}`}
                              style={{ height: `${(val / maxVal) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="ml-6 mt-2 flex justify-between px-2 text-[10px] text-sky-200/60">
                    {trendPoints.slice(-7).map((p, i) => <span key={i}>{p.label.split(' ')[0]}</span>)}
                  </div>
              </div>
            </div>
          </div>

          {/* Tables */}
          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Recent Sales</span>
                </div>
                <button className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300">
                  View all <ChevronDown className="h-3 w-3 -rotate-90" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[12px]">
                  <thead className="border-b border-sky-800/50 text-[10px] font-medium text-sky-200/50">
                    <tr>
                      <th className="pb-2">Invoice</th>
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2">Payment Method</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Time</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-800/30 text-sky-100">
                    {loadingSales ? (
                      <tr><td colSpan={7} className="py-4 text-center">Loading...</td></tr>
                    ) : (recentSales || []).slice(0, 6).map((sale, i) => (
                      <tr key={i} className="hover:bg-sky-800/20">
                        <td className="py-2.5 font-medium text-sky-400">{sale.docNum ? `INV-${sale.docNum}` : (sale.saleId || 'Unknown')}</td>
                        <td className="py-2.5">{sale.customerName || 'Walk-in Customer'}</td>
                        <td className="py-2.5 font-semibold text-white">{money.format(sale.total || 0)}</td>
                        <td className="py-2.5 text-sky-200/70">{sale.paymentMethod || 'Mixed'}</td>
                        <td className="py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${(sale as any).hasReturn ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {(sale as any).hasReturn ? 'Refunded' : 'Completed'}
                          </span>
                        </td>
                        <td className="py-2.5 text-sky-200/60">{sale.docDate ? sale.docDate : 'Today'}</td>
                        <td className="py-2.5 text-right"><button className="text-sky-200/40 hover:text-white">•••</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageSearch className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Top Products</span>
                </div>
                <button className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300">
                  View all <ChevronDown className="h-3 w-3 -rotate-90" />
                </button>
              </div>
              <table className="min-w-full text-left text-[12px]">
                <thead className="border-b border-sky-800/50 text-[10px] font-medium text-sky-200/50">
                  <tr>
                    <th className="pb-2 w-8">#</th>
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-right">Units Sold</th>
                    <th className="pb-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-800/30 text-sky-100">
                  {(topProducts || []).slice(0, 5).map((prod, idx) => (
                    <tr key={idx} className="hover:bg-sky-800/20">
                      <td className="py-2.5 font-medium text-sky-200/50">{idx + 1}</td>
                      <td className="py-2.5 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-800">
                          <Package className="h-3 w-3 text-sky-200/50" />
                        </div>
                        {prod.itemName}
                      </td>
                      <td className="py-2.5 text-right">{prod.quantitySold}</td>
                      <td className="py-2.5 text-right font-semibold text-white">{money.format(prod.salesAmount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk and Quick Actions */}
          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">AI Risk Analysis Summary</span>
                </div>
                <button className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300">
                  View details <ChevronDown className="h-3 w-3 -rotate-90" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-sky-800/80 bg-[#071d34]">
                  <span className="text-[20px] font-bold text-white">N/A</span>
                </div>
                <div className="mr-4">
                  <div className="text-[11px] text-sky-200/60">Overall Risk Score</div>
                  <div className="text-[13px] font-semibold text-sky-400">Not Available</div>
                </div>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <div className="rounded-lg border border-sky-800/50 bg-sky-800/20 p-2">
                    <div className="text-[16px] font-bold text-white">-</div>
                    <div className="mt-1 text-[10px] leading-tight text-sky-200/60">Inventory Risks</div>
                    <div className="text-[9px] font-semibold text-sky-400/60">Unavailable</div>
                  </div>
                  <div className="rounded-lg border border-sky-800/50 bg-sky-800/20 p-2">
                    <div className="text-[16px] font-bold text-white">-</div>
                    <div className="mt-1 text-[10px] leading-tight text-sky-200/60">Sales Anomalies</div>
                    <div className="text-[9px] font-semibold text-sky-400/60">Unavailable</div>
                  </div>
                  <div className="rounded-lg border border-sky-800/50 bg-sky-800/20 p-2">
                    <div className="text-[16px] font-bold text-white">-</div>
                    <div className="mt-1 text-[10px] leading-tight text-sky-200/60">Integration Issue</div>
                    <div className="text-[9px] font-semibold text-sky-400/60">Unavailable</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-400" />
                <span className="text-[14px] font-semibold">Quick Actions</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { icon: ShoppingCart, label: 'New Sale' },
                  { icon: PackageSearch, label: 'Add Product' },
                  { icon: FileText, label: 'Generate Report' },
                  { icon: Check, label: 'View Approvals' },
                  { icon: CircleHelp, label: 'More' }
                ].map((act, i) => (
                  <button key={i} className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-sky-800/50 bg-[#071d34] p-2 hover:bg-sky-800/40 hover:border-sky-700">
                    <act.icon className="h-4 w-4 text-sky-300" />
                    <span className="text-center text-[9px] leading-tight text-sky-200/80">{act.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT SIDEBAR (AI & Alerts) */}
        <div className="flex w-full flex-col gap-5 xl:w-[280px]">
          
          <div className="rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-400" />
                <span className="text-[14px] font-semibold">AI Assistant</span>
              </div>
              <button className="flex items-center gap-1 rounded border border-blue-600/50 bg-blue-600/20 px-2 py-1 text-[10px] font-medium text-blue-400">
                <MessageSquarePlus className="h-3 w-3" /> New Chat
              </button>
            </div>
            <div className="mb-4 flex items-start gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="rounded-xl rounded-tl-sm bg-[#071d34] p-3 text-[11px] leading-relaxed text-sky-100">
                <span className="font-semibold text-white">Hello! I'm your Atls AI Assistant.</span><br/>
                <span className="text-sky-200/70">I can help you with:</span>
                <ul className="mt-1 list-inside list-disc text-sky-200/70">
                  <li>Check sales, inventory, customers</li>
                  <li>Generate reports (PDF)</li>
                  <li>Analyze business risks</li>
                  <li>Find data from SAP system</li>
                  <li>Update dashboard insights</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                'Show today\'s sales summary',
                'Find low stock products',
                'Generate customer wise sales report',
                'What are the top 5 products this month?',
                'Show pending approvals'
              ].map((q, i) => (
                <button key={i} className="rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-2 text-left text-[11px] text-sky-200/80 hover:bg-sky-800/40 hover:text-white">
                  {q}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] p-1">
              <input type="text" placeholder="Ask anything about your business..." className="flex-1 bg-transparent px-2 text-[11px] text-white outline-none placeholder:text-sky-200/40" />
              <button className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white">
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="rounded-[16px] border border-sky-800/50 bg-[#0b2340]/40 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-400" />
                <span className="text-[14px] font-semibold">Alerts & Approvals</span>
              </div>
              <button className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300">
                View all <ChevronDown className="h-3 w-3 -rotate-90" />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium">
              <button className="rounded bg-blue-600 px-2 py-1 text-white">All ({(alerts || []).length})</button>
              <button className="rounded px-2 py-1 text-sky-200/60 hover:text-white">Approvals</button>
            </div>
            <div className="flex flex-col gap-2">
              {alertRows.map((alert, i) => (
                <div key={i} className="flex gap-2 rounded-lg border border-sky-800/40 bg-[#071d34] p-2.5">
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${i < 2 ? 'bg-red-500/20 text-red-400' : i < 4 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {i < 2 ? <CreditCard className="h-3 w-3" /> : i < 4 ? <TriangleAlert className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <div className="truncate text-[11px] font-semibold text-white">{alert.request_type}</div>
                      <div className="text-[9px] text-sky-200/40 whitespace-nowrap">{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-sky-200/60">{alert.reason}</div>
                    {alert.status === 'Pending' && (
                      <div className="mt-1.5 inline-block rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-500">
                        Pending
                      </div>
                    )}
                    {alert.status === 'Approved' && (
                      <div className="mt-1 flex items-center justify-between">
                        <div className="text-[10px] text-sky-200/60">Approved</div>
                        <div className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">SAP Confirmed</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center text-sky-200/40">
                    <ChevronDown className="h-3 w-3 -rotate-90" />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const StateMessage = ({ type, message }: { type: 'error' | 'empty'; message: string }) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 px-4 text-center">
    {type === 'error' ? <AlertCircle className="h-8 w-8 text-red-400" /> : <PackageSearch className="h-8 w-8 text-sky-200/60" />}
    <div className={type === 'error' ? 'text-red-300' : 'text-sky-100/65'}>{message}</div>
  </div>
);
