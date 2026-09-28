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
    Users
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

  const { data: recentSales, isLoading: loadingSales, isError: errorSales } = useQuery({
    queryKey: ['recentSales', user?.branch_id],
    queryFn: () => dashboardApi.getRecentSales(user?.branch_id),
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery({
    queryKey: ['dashboardAlerts'],
    queryFn: () => dashboardApi.getAlerts(),
  });

  const { data: topProducts } = useQuery({
    queryKey: ['topProducts'],
    queryFn: atlasApi.getTopProducts,
  });

  const { data: trendData, isLoading: loadingTrend, isError: errorTrend } = useQuery({
    queryKey: ['salesTrend'],
    queryFn: atlasApi.getSalesTrend,
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
      tint: 'bg-emerald-500/12 text-emerald-300',
    },
    {
      title: 'Completed Bills',
      highlight: '+16.7%',
      value: `${summary?.billCount ?? 0}`,
      meta: 'vs. yesterday',
      icon: Check,
      accent: 'from-blue-500 to-sky-300',
      tint: 'bg-blue-500/12 text-blue-300',
    },
    {
      title: 'Active Shift',
      highlight: 'Open',
      value: 'John Doe',
      meta: 'Started 08:00 AM',
      icon: Clock3,
      accent: 'from-violet-500 to-violet-300',
      tint: 'bg-violet-500/12 text-violet-300',
    },
    {
      title: 'Low-stock Items',
      highlight: '-40%',
      value: `${Math.max((topProducts?.length ?? 0), 7)}`,
      meta: 'vs. last week',
      icon: TriangleAlert,
      accent: 'from-amber-500 to-orange-300',
      tint: 'bg-amber-500/12 text-amber-300',
    },
    {
      title: 'Pending Approvals',
      highlight: '+1.8%',
      value: `${Math.max((alerts?.filter((item) => item.status === 'Pending').length ?? 0), 3)}`,
      meta: 'vs. last week',
      icon: Bell,
      accent: 'from-pink-500 to-pink-300',
      tint: 'bg-pink-500/12 text-pink-300',
    },
  ];

  const alertRows = (alerts ?? []).slice(0, 4);

  return (
    <div className="h-full w-full bg-[#061a2f] text-white">
      <div className="mx-auto flex max-w-[1600px] gap-6">
        <div className="flex-1 space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-[42px] font-black leading-none tracking-[-0.06em] text-white">Retail Operations Dashboard</h1>
              <p className="mt-2 text-[14px] text-sky-100/75">Real-time overview of your business operations</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="flex items-center gap-2 rounded-xl border border-sky-700/80 bg-[#0d2341] px-4 py-2.5 text-sm font-medium text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.08)]">
                <ShoppingBag className="h-4 w-4 text-sky-300" />
                <span>Main Branch (WH-001)</span>
                <ChevronDown className="h-4 w-4 text-sky-200" />
              </button>

              <button className="flex items-center gap-2 rounded-xl border border-sky-700/80 bg-[#0d2341] px-4 py-2.5 text-sm font-medium text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.08)]">
                <span>Nov 1, 2024 - Nov 30, 2024</span>
                <ChevronDown className="h-4 w-4 text-sky-200" />
              </button>

              <button className="flex items-center gap-2 rounded-xl border border-sky-700/80 bg-[#0d2341] px-4 py-2.5 text-sm font-medium text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.08)]">
                <RefreshCcw className="h-4 w-4 text-sky-300" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            {statCards.map(({ title, value, highlight, meta, icon: Icon, accent, tint }) => (
              <div key={title} className="rounded-[20px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#0a1d39_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${tint}`}>
                      {highlight}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-1">
                  <div className="text-[13px] font-medium text-sky-100/85">{title}</div>
                  <div className="text-[28px] font-black leading-none tracking-[-0.06em] text-white">{value}</div>
                  <div className="text-[11px] text-sky-100/65">{meta}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <div className="overflow-hidden rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-4 w-4 text-sky-300" />
                  <span className="text-[18px] font-semibold">Sales Overview</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-sky-800 bg-[#0d2341] px-2.5 py-1.5 text-xs text-sky-100">
                  <span>7D</span>
                  <span className="rounded-md bg-sky-500/25 px-2 py-1 text-sky-100">30D</span>
                  <span>90D</span>
                  <span>1Y</span>
                </div>
              </div>

              {loadingTrend ? (
                <div className="flex min-h-[260px] items-center justify-center text-sky-100/70">Loading chart</div>
              ) : errorTrend ? (
                <StateMessage type="error" message="Failed to load sales overview." />
              ) : (
                <div className="relative min-h-[280px] rounded-2xl border border-sky-900/70 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),rgba(15,23,42,0.1)_30%,rgba(15,23,42,0)_100%)] p-4">
                  <div className="mb-5 flex items-end justify-between text-[12px] text-sky-100/60">
                    <span className="text-[14px] font-medium text-sky-100/80">₹0</span>
                    <span className="text-[14px] font-medium text-sky-100/80">₹50k</span>
                    <span className="text-[14px] font-medium text-sky-100/80">₹100k</span>
                  </div>

                  <div className="flex h-52 items-end justify-between gap-2 px-2 pb-6 pt-4">
                    {trendPoints.length > 0 ? (
                      trendPoints.map((point, index) => {
                        const height = Math.max((point.total / chartMax) * 100, 8);
                        return (
                          <div key={`${point.label}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-2">
                            <div className="relative flex h-full w-full items-end justify-center">
                              <div
                                className="w-full max-w-[18px] rounded-t-[10px] bg-gradient-to-t from-sky-500 to-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-sky-100/70">{point.label}</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex w-full items-center justify-center text-sm text-sky-100/70">No sales trend data available</div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-sky-100/70">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Current Period</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border border-sky-400/70 bg-transparent" /> Previous Period</span>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <ShoppingCart className="h-4 w-4 text-sky-300" />
                  <span className="text-[18px] font-semibold">Orders This Week</span>
                </div>
                <button className="text-xs text-sky-300">This Week</button>
              </div>

              <div className="flex h-[260px] items-end justify-between gap-2 pt-6">
                {[150, 168, 142, 178, 110, 98, 135].map((value, idx) => (
                  <div key={idx} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative flex h-full w-full items-end justify-center">
                      <div
                        className={`w-full max-w-[26px] rounded-t-[10px] ${idx % 2 === 0 ? 'bg-gradient-to-t from-orange-500 to-amber-300' : 'bg-gradient-to-t from-sky-500 to-blue-300'}`}
                        style={{ height: `${(value / 200) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-sky-100/65">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_360px]">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                <div className="flex items-center justify-between border-b border-sky-900/80 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <ShoppingCart className="h-4 w-4 text-sky-300" />
                    <span className="text-[18px] font-semibold">Recent Sales</span>
                  </div>
                  <button className="text-sm font-medium text-sky-300">View all</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-sky-100">
                    <thead className="bg-[#0b1d38] text-[11px] uppercase tracking-[0.12em] text-sky-200/70">
                      <tr>
                        <th className="px-4 py-3 font-medium">Invoice</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Payment</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingSales ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sky-100/65">Loading recent sales...</td>
                        </tr>
                      ) : errorSales ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-red-300">Could not load recent sales</td>
                        </tr>
                      ) : recentSales && recentSales.length > 0 ? (
                        recentSales.slice(0, 6).map((sale, index) => (
                          <tr key={`${sale.saleId ?? sale.docNum ?? index}`} className="border-t border-sky-900/70 hover:bg-[#102949]">
                            <td className="px-4 py-3 text-sky-100">{sale.docNum || sale.saleId || 'N/A'}</td>
                            <td className="px-4 py-3 text-sky-100/80">{sale.customerName || 'Walk-in Customer'}</td>
                            <td className="px-4 py-3 font-semibold text-white">{money.format(sale.total || 0)}</td>
                            <td className="px-4 py-3 text-sky-100/80">Cash</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-semibold text-emerald-300">Completed</span>
                            </td>
                            <td className="px-4 py-3 text-sky-100/80">{sale.docDate || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sky-100/65">No recent sales found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                <div className="rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <TriangleAlert className="h-4 w-4 text-amber-300" />
                      <span className="text-[18px] font-semibold">Risk Analysis Summary</span>
                    </div>
                    <button className="text-sm font-medium text-sky-300">View details</button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <MetricPill title="Overall Risk Score" value="72" level="Medium Risk" tone="amber" />
                    <MetricPill title="Low Stock" value="3" level="High Priority" tone="red" />
                    <MetricPill title="Returns" value="2" level="Medium" tone="orange" />
                    <MetricPill title="Inventory" value="4" level="Low" tone="green" />
                  </div>
                </div>

                <div className="rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <CreditCard className="h-4 w-4 text-sky-300" />
                      <span className="text-[18px] font-semibold">Quick Actions</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'New Sale', icon: ShoppingCart },
                      { label: 'Add Product', icon: PackageSearch },
                      { label: 'Generate Report', icon: TrendingUp },
                      { label: 'View Approval', icon: Bell },
                      { label: 'Customers', icon: Users },
                      { label: 'More', icon: CircleHelp },
                    ].map(({ label, icon: Icon }) => (
                      <button key={label} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-sky-800 bg-[#0d2341] p-3 text-center text-sm font-medium text-sky-100/80 transition hover:border-sky-600 hover:bg-[#112847]">
                        <Icon className="h-5 w-5 text-sky-300" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <aside className="flex flex-col gap-5">
              <div className="flex min-h-[318px] flex-col rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Sparkles className="h-4 w-4 text-sky-300" />
                    <span className="text-[18px] font-semibold">AI Assistant</span>
                  </div>
                  <button className="rounded-lg border border-sky-700/80 bg-[#0d2341] px-2 py-1 text-[10px] font-medium text-sky-100">New Chat</button>
                </div>

                <div className="space-y-3 rounded-2xl border border-sky-900/70 bg-[#0b1d38] p-3 text-sm text-sky-100/85">
                  <div className="font-medium text-white">Hello! I’m your AI Assistant.</div>
                  <ul className="space-y-2 text-sky-100/75">
                    <li>• Check sales, inventory, customers</li>
                    <li>• Generate reports (PDF)</li>
                    <li>• Analyze business risks</li>
                    <li>• Find data from SAP system</li>
                  </ul>
                </div>

                <div className="mt-4 space-y-2">
                  {['Show today’s sales summary', 'Find low stock products', 'Generate customer wise sales report', 'What are the top 5 products this month?'].map((text) => (
                    <button key={text} className="flex w-full items-center justify-between rounded-xl border border-sky-800 bg-[#0d2341] px-3 py-2 text-left text-sm text-sky-100/80 transition hover:border-sky-600 hover:bg-[#112847]">
                      <span>{text}</span>
                      <ArrowRight className="h-4 w-4 text-sky-300" />
                    </button>
                  ))}
                </div>

                <div className="mt-auto rounded-xl border border-sky-800 bg-[#0d2341] px-2 py-2 text-right text-sky-200">
                  <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-900/30">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                <div className="mb-3 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-sky-300" />
                    <span className="text-[16px] font-semibold">Alerts & Approvals</span>
                  </div>
                  <button className="text-[11px] font-medium text-sky-300">View all</button>
                </div>

                {loadingAlerts ? (
                  <div className="text-sm text-sky-100/65">Loading alerts...</div>
                ) : alertRows.length > 0 ? (
                  <div className="space-y-2">
                    {alertRows.map((alert) => (
                      <div key={alert.id} className="rounded-xl border border-sky-800 bg-[#0d2341] p-2.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-sky-100/75">
                          <span className="font-medium text-white">{alert.request_type}</span>
                          <span className="inline-flex rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">{alert.status}</span>
                        </div>
                        <div className="mt-2 text-[12px] text-sky-100/80">{alert.reason}</div>
                        <div className="mt-2 text-[11px] text-sky-100/60">₹{alert.amount.toLocaleString()} • {alert.branch_id}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-sky-100/65">No alerts</div>
                )}
              </div>
            </aside>
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

const MetricPill = ({ title, value, level, tone }: { title: string; value: string; level: string; tone: 'amber' | 'red' | 'orange' | 'green' }) => {
  const toneClass = {
    amber: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
    red: 'bg-red-500/12 text-red-300 border-red-500/30',
    orange: 'bg-orange-500/12 text-orange-300 border-orange-500/30',
    green: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30',
  }[tone];

  return (
    <div className="rounded-2xl border border-sky-800 bg-[#0d2341] p-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-sky-100/60">{title}</div>
      <div className="mt-2 text-[28px] font-black tracking-[-0.06em] text-white">{value}</div>
      <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-medium ${toneClass}`}>{level}</div>
    </div>
  );
};
