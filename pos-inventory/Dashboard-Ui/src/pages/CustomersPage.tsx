import { useQuery } from '@tanstack/react-query';
import {
    BadgeDollarSign,
    CalendarDays,
    ChevronDown,
    CircleUserRound,
    Download,
    Mail,
    MapPin,
    Phone,
    Plus,
    Search,
    ShieldAlert,
    Sparkles,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { customersApi } from '../api/customers';
import { useDebounce } from '../hooks/useDebounce';

const rangeOptions = [
  { label: 'This month', value: 'monthly' },
  { label: 'This week', value: 'weekly' },
  { label: 'Today', value: 'daily' },
  { label: 'This year', value: 'yearly' },
] as const;

type CustomerListItem = {
  cardCode?: string | null;
  cardName?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappNumber?: string | null;
  paymentMethod?: string | null;
  salesEmployee?: string | null;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0);

const initials = (name?: string | null) => (name || 'C').trim().charAt(0).toUpperCase();

export const CustomersPage = () => {
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<(typeof rangeOptions)[number]['value']>('monthly');
  const debouncedSearch = useDebounce(search, 350);

  const { data: insights, isLoading: insightsLoading, isError: insightsError, error: insightsErr } = useQuery({
    queryKey: ['customer-insights', range],
    queryFn: () => customersApi.getInsights(range),
  });

  const { data: customers = [], isLoading, isError, error, refetch } = useQuery<CustomerListItem[]>({
    queryKey: ['customers-list', debouncedSearch],
    queryFn: () => customersApi.searchCustomers(debouncedSearch || undefined),
    staleTime: 60_000,
  });

  const filteredCustomers = useMemo(() => {
    if (!debouncedSearch.trim()) return customers;
    const needle = debouncedSearch.toLowerCase();
    return customers.filter((customer) => {
      const name = (customer.cardName || '').toLowerCase();
      const code = (customer.cardCode || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      return name.includes(needle) || code.includes(needle) || phone.includes(needle);
    });
  }, [customers, debouncedSearch]);

  const selectedCustomer = filteredCustomers[0] ?? null;

  return (
    <div className="min-h-full bg-[#021b2e] text-slate-100">
      <div className="space-y-6 max-w-[1500px] mx-auto pb-8">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Customers</h1>
            <p className="mt-1 text-sm text-slate-300">Manage your customers and view purchase history</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-900/40 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-900/70"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-900/30 hover:bg-blue-500"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Customers" value={String(customers.length || 0)} change="vs. last month" tone="blue" icon={<Users className="h-5 w-5" />} />
          <StatCard title="New Customers" value={String(insights?.newCustomerCount ?? 0)} change="vs. last month" tone="cyan" icon={<Sparkles className="h-5 w-5" />} loading={insightsLoading} />
          <StatCard title="Loyalty Customers" value={String(insights?.repeatCustomerCount ?? 0)} change="vs. last month" tone="purple" icon={<Users className="h-5 w-5" />} loading={insightsLoading} />
          <StatCard title="Total Sales (Customers)" value={formatMoney(insights?.totalCLV ?? 0)} change="vs. last month" tone="emerald" icon={<BadgeDollarSign className="h-5 w-5" />} loading={insightsLoading} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,0.8fr)]">
          <div className="rounded-2xl border border-sky-800/80 bg-[#061d33] shadow-[0_0_0_1px_rgba(56,189,248,0.06)] overflow-hidden">
            <div className="border-b border-sky-900/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sky-300">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, phone, email or customer code..."
                    className="block w-full rounded-xl border border-sky-800 bg-[#0a2744] py-2.5 pl-9 pr-3 text-sm text-sky-50 placeholder:text-sky-300/80 focus:border-sky-500 focus:bg-[#0d2f4e] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-full lg:w-[170px]">
                    <select
                      value={range}
                      onChange={(event) => setRange(event.target.value as (typeof rangeOptions)[number]['value'])}
                      className="block w-full appearance-none rounded-xl border border-sky-800 bg-[#0a2744] px-3 py-2.5 pr-9 text-sm text-sky-50 focus:border-sky-500 focus:bg-[#0d2f4e] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      {rangeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-300" />
                  </div>
                  <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Search</button>
                  <button type="button" className="rounded-xl border border-sky-800 bg-[#0a2744] px-4 py-2.5 text-sm font-medium text-sky-100 hover:bg-[#0d2f4e]">Clear</button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-900/80 text-left">
                <thead className="bg-[#0a2744] text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-200">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Customer Type</th>
                    <th className="px-4 py-3">Lifetime Value</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-900/80 bg-[#071e32] text-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-sm text-sky-200">Loading customers...</td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-300">Could not load customers</p>
                          <p className="text-sm text-sky-200">{(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'The customer service is unavailable.'}</p>
                          <button type="button" onClick={() => refetch()} className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-100 hover:bg-red-500/20">Retry</button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-sm text-sky-200">No customer records match your search.</td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer, index) => (
                      <tr key={`${customer.cardCode ?? 'customer'}-${index}`} className={`transition ${selectedCustomer?.cardCode === customer.cardCode ? 'bg-sky-950/40' : 'hover:bg-sky-900/20'}`}>
                        <td className="px-4 py-3 text-sm text-sky-200">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20 text-blue-100 font-semibold text-xs">
                              {initials(customer.cardName)}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{customer.cardName || 'Unknown customer'}</div>
                              <div className="text-xs text-sky-300">{customer.cardCode || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-sky-100">{customer.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm text-sky-200">{customer.email || '—'}</td>
                        <td className="px-4 py-3 text-sm text-sky-100">Retail</td>
                        <td className="px-4 py-3 text-sm font-medium text-sky-100">{formatMoney(12450)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Active</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" className="rounded-md border border-sky-800 bg-[#0a2744] p-2 text-sky-200 hover:bg-[#0d2f4e]" aria-label="Row actions">
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5 rounded-2xl border border-sky-800/80 bg-[#091f35] p-5 shadow-[0_0_0_1px_rgba(56,189,248,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-white">JS</div>
                <div>
                  <div className="font-semibold text-white">{selectedCustomer?.cardName || 'Jane Smith'}</div>
                  <div className="text-xs text-sky-300">{selectedCustomer?.cardCode || 'CUS-1001'} · Retail Customer</div>
                </div>
              </div>
              <button type="button" className="rounded-lg border border-sky-800 bg-[#0a2744] px-2.5 py-1.5 text-sm font-medium text-sky-100 hover:bg-[#0d2f4e]">Edit</button>
            </div>

            <div className="mt-5 border-b border-sky-800 pb-2">
              <div className="flex gap-3 text-sm font-medium">
                <button type="button" className="border-b-2 border-sky-400 pb-2 text-sky-200">Profile</button>
                <button type="button" className="pb-2 text-sky-400">Purchases (12)</button>
                <button type="button" className="pb-2 text-sky-400">Returns (2)</button>
                <button type="button" className="pb-2 text-sky-400">Activity</button>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-sky-800 bg-[#0a2744]/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">Contact Information</h3>
                  <button type="button" className="rounded-md border border-sky-800 bg-[#0b2d4d] p-1.5 text-sky-200 hover:bg-[#113b63]">Edit</button>
                </div>
                <div className="space-y-3 text-sm text-sky-100">
                  <InfoRow icon={<CircleUserRound className="h-4 w-4" />} label="Full Name" value={selectedCustomer?.cardName || 'Jane Smith'} />
                  <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedCustomer?.phone || '+91 98765 43210'} />
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedCustomer?.email || 'jane.smith@gmail.com'} />
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={selectedCustomer?.whatsappNumber || '123 MG Road, Bangalore 560001, Karnataka, India'} />
                </div>
              </div>

              <div className="rounded-xl border border-sky-800 bg-[#0a2744]/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">Additional Details</h3>
                  <button type="button" className="rounded-md border border-sky-800 bg-[#0b2d4d] p-1.5 text-sky-200 hover:bg-[#113b63]">Edit</button>
                </div>
                <div className="space-y-3 text-sm text-sky-100">
                  <InfoRow icon={<Users className="h-4 w-4" />} label="Customer Type" value="Retail" />
                  <InfoRow icon={<ShieldAlert className="h-4 w-4" />} label="Status" value="Active" />
                  <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Registered On" value="15 Jan 2024" />
                  <InfoRow icon={<BadgeDollarSign className="h-4 w-4" />} label="Last Purchase" value="27 Sep 2024" />
                  <InfoRow icon={<Sparkles className="h-4 w-4" />} label="Preferred Branch" value="Main Branch (WH-001)" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStat label="Recent Invoices" value="4" accent="emerald" />
                <MiniStat label="Recent Returns" value="2" accent="amber" />
              </div>
            </div>
          </aside>
        </div>

        {insightsError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              <span>{(insightsErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Customer insights are temporarily unavailable.'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

type StatCardProps = {
  title: string;
  value: string;
  change: string;
  tone: 'blue' | 'cyan' | 'purple' | 'emerald';
  icon: React.ReactNode;
  loading?: boolean;
};

const toneClasses: Record<StatCardProps['tone'], string> = {
  blue: 'bg-[#0f2d4f] text-blue-200',
  cyan: 'bg-[#0d304a] text-cyan-200',
  purple: 'bg-[#2a1f46] text-violet-200',
  emerald: 'bg-[#0d2d30] text-emerald-200',
};

const StatCard = ({ title, value, change, tone, icon, loading }: StatCardProps) => (
  <div className="rounded-2xl border border-sky-800/80 bg-[#071d31] p-4 shadow-[0_0_0_1px_rgba(56,189,248,0.04)]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-sky-200">{title}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-white">{loading ? '—' : value}</p>
      </div>
      <div className={`rounded-xl p-2.5 ${toneClasses[tone]}`}>{icon}</div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-2">
      <span className="inline-flex items-center rounded-full bg-sky-950/60 px-2 py-1 text-[11px] font-semibold text-sky-200">+12.5%</span>
      <span className="text-xs text-sky-300">{change}</span>
    </div>
  </div>
);

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-sky-300">{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-sky-300">{label}</div>
      <div className="mt-1 break-words text-sm text-sky-50">{value}</div>
    </div>
  </div>
);

const MiniStat = ({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'amber' }) => (
  <div className={`rounded-xl border ${accent === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'} p-3`}>
    <div className="text-[11px] uppercase tracking-[0.12em] text-sky-200">{label}</div>
    <div className="mt-2 text-2xl font-bold text-white">{value}</div>
  </div>
);

export default CustomersPage;
