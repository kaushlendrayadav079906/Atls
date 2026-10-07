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
  lifetimeValue?: number;
  status?: string;
  cardType?: string;
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

    const [selectedCardCode, setSelectedCardCode] = useState<string | null>(null);

  const selectedCustomer = useMemo(
    () => filteredCustomers.find((c) => c.cardCode === selectedCardCode) || filteredCustomers[0] || null,
    [filteredCustomers, selectedCardCode]
  );
  
  const currentCardCode = selectedCustomer?.cardCode;

  const { data: profile } = useQuery({
    queryKey: ['customer-profile', currentCardCode],
    queryFn: () => currentCardCode ? customersApi.getCustomerProfile(currentCardCode) : null,
    enabled: !!currentCardCode,
  });

  const { data: purchases } = useQuery({
    queryKey: ['customer-purchases', currentCardCode],
    queryFn: () => currentCardCode ? customersApi.getCustomerPurchases(currentCardCode) : null,
    enabled: !!currentCardCode,
  });

  const { data: returns } = useQuery({
    queryKey: ['customer-returns', currentCardCode],
    queryFn: () => currentCardCode ? customersApi.getCustomerReturns(currentCardCode) : null,
    enabled: !!currentCardCode,
  });


  return (
    <div className="min-h-full bg-slate-50">
      <div className="space-y-6 max-w-[1500px] mx-auto pb-8">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Customers</h1>
            <p className="mt-1 text-sm text-slate-600">Manage your customers and view purchase history</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
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
          <StatCard title="Total Customers" value={String(insights?.totalCustomers || 0)} change="vs. last month" tone="blue" icon={<Users className="h-5 w-5" />} />
          <StatCard title="New Customers" value={String(insights?.newCustomerCount ?? 0)} change="vs. last month" tone="cyan" icon={<Sparkles className="h-5 w-5" />} loading={insightsLoading} />
          <StatCard title="Loyalty Customers" value={String(insights?.repeatCustomerCount ?? 0)} change="vs. last month" tone="purple" icon={<Users className="h-5 w-5" />} loading={insightsLoading} />
          <StatCard title="Total Sales (Customers)" value={formatMoney(insights?.totalCLV ?? 0)} change="vs. last month" tone="emerald" icon={<BadgeDollarSign className="h-5 w-5" />} loading={insightsLoading} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,0.8fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, phone, email or customer code..."
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-full lg:w-[170px]">
                    <select
                      value={range}
                      onChange={(event) => setRange(event.target.value as (typeof rangeOptions)[number]['value'])}
                      className="block w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {rangeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
                  </div>
                  <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Search</button>
                  <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Clear</button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-sm text-slate-600">Loading customers...</td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-300">Could not load customers</p>
                          <p className="text-sm text-slate-600">{(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'The customer service is unavailable.'}</p>
                          <button type="button" onClick={() => refetch()} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-500/20">Retry</button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-sm text-slate-600">No customer records match your search.</td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer, index) => (
                      <tr onClick={() => setSelectedCardCode(customer.cardCode || null)} key={`${customer.cardCode ?? 'customer'}-${index}`} className={`transition ${currentCardCode === customer.cardCode ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-100 font-semibold text-xs">
                              {initials(customer.cardName)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{customer.cardName || 'Unknown customer'}</div>
                              <div className="text-xs text-blue-600">{customer.cardCode || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{customer.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{customer.email || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{customer.cardType || 'Retail'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatMoney(customer.lifetimeValue || 0)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${customer.status === 'Active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{customer.status || 'Active'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100" aria-label="Row actions">
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

          <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sticky top-4 self-start">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-white">JS</div>
                <div>
                  <div className="font-semibold text-slate-900">{selectedCustomer?.cardName || '-'}</div>
                  <div className="text-xs text-blue-600">{selectedCustomer?.cardCode || "-"} · Retail Customer</div>
                </div>
              </div>
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">Edit</button>
            </div>

            <div className="mt-5 border-b border-slate-200 pb-2">
              <div className="flex gap-3 text-sm font-medium">
                <button type="button" className="border-b-2 border-sky-400 pb-2 text-slate-600">Profile</button>
                <button type="button" className="pb-2 text-sky-400">Purchases ({purchases?.length || 0})</button>
                <button type="button" className="pb-2 text-sky-400">Returns ({returns?.length || 0})</button>
                <button type="button" className="pb-2 text-sky-400">Activity</button>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Contact Information</h3>
                  <button type="button" className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 text-xs px-2 shadow-sm">Edit</button>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <InfoRow icon={<CircleUserRound className="h-4 w-4" />} label="Full Name" value={selectedCustomer?.cardName || '-'} />
                  <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedCustomer?.phone || '-'} />
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedCustomer?.email || '-'} />
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={selectedCustomer?.whatsappNumber || '-'} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Additional Details</h3>
                  <button type="button" className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 text-xs px-2 shadow-sm">Edit</button>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <InfoRow icon={<Users className="h-4 w-4" />} label="Customer Type" value={profile?.cardType || "Retail"} />
                  <InfoRow icon={<ShieldAlert className="h-4 w-4" />} label="Status" value={profile?.status || "Active"} />
                  <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Registered On" value={profile?.registeredOn ? new Date(profile.registeredOn).toLocaleDateString() : "-"} />
                  <InfoRow icon={<BadgeDollarSign className="h-4 w-4" />} label="Last Purchase" value={profile?.lastPurchase ? new Date(profile.lastPurchase).toLocaleDateString() : "-"} />
                  <InfoRow icon={<Sparkles className="h-4 w-4" />} label="Preferred Branch" value={profile?.preferredBranch || "-"} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStat label="Recent Invoices" value={profile?.recentInvoicesCount?.toString() || "0"} accent="emerald" />
                <MiniStat label="Recent Returns" value={profile?.recentReturnsCount?.toString() || "0"} accent="amber" />
              </div>
            </div>
          </aside>
        </div>

        {insightsError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <span>{(insightsErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Customer insights are temporarily unavailable.'}</span>
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
  blue:    'bg-blue-100 text-blue-700',
  cyan:    'bg-cyan-100 text-cyan-700',
  purple:  'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
};

const StatCard = ({ title, value, change, tone, icon, loading }: StatCardProps) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{loading ? <span className="inline-block h-7 w-20 animate-pulse rounded-lg bg-slate-100" /> : value}</p>
      </div>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>{icon}</div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-2">
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">+12.5%</span>
      <span className="text-xs text-slate-400">{change}</span>
    </div>
  </div>
);

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-blue-600">{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-blue-600">{label}</div>
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
    </div>
  </div>
);

const MiniStat = ({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'amber' }) => (
  <div className={`rounded-xl border ${accent === 'emerald' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'} p-3`}>
    <div className="text-[11px] uppercase tracking-[0.12em] text-slate-600">{label}</div>
    <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
  </div>
);

export default CustomersPage;
