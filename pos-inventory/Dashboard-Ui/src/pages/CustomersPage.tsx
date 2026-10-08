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
    Eye,
    Edit,
    X,
    ChevronLeft,
    ChevronRight,
    Calendar,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { customersApi } from '../api/customers';
import { useDebounce } from '../hooks/useDebounce';

const rangeOptions = [
  { label: 'All Dates (Total)', value: 'all_time' },
  { label: 'This month', value: 'monthly' },
  { label: 'This week', value: 'weekly' },
  { label: 'Today', value: 'daily' },
  { label: 'This year', value: 'yearly' },
  { label: 'Custom Range', value: 'custom' }
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Profile');
  const [modalPage, setModalPage] = useState(1);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<(typeof rangeOptions)[number]['value'] | string>('monthly');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.date-dropdown-container')) {
        setIsDateDropdownOpen(false);
      }
    };
    if (isDateDropdownOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isDateDropdownOpen]);

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

  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const totalCustomers = filteredCustomers.length;
  const totalPages = Math.ceil(totalCustomers / limit);
  const offset = (page - 1) * limit;
  const paginatedCustomers = filteredCustomers.slice(offset, offset + limit);

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

  const modalLimit = 5;
  const purchasesTotal = purchases?.length || 0;
  const purchasesTotalPages = Math.ceil(purchasesTotal / modalLimit);
  const purchasesOffset = (modalPage - 1) * modalLimit;
  const paginatedPurchases = purchases?.slice(purchasesOffset, purchasesOffset + modalLimit) || [];

  const returnsTotal = returns?.length || 0;
  const returnsTotalPages = Math.ceil(returnsTotal / modalLimit);
  const returnsOffset = (modalPage - 1) * modalLimit;
  const paginatedReturns = returns?.slice(returnsOffset, returnsOffset + modalLimit) || [];

  return (
    <div className="min-h-full bg-slate-50">
      <div className="space-y-6 max-w-[1500px] mx-auto pb-8">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Customers</h1>
            <p className="mt-1 text-sm text-slate-600">Manage your customers and view purchase history</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative date-dropdown-container z-50 hidden sm:block">
              <button 
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors font-medium text-sm"
              >
                <Calendar className="w-4 h-4 text-slate-500" />
                {range === 'all_time' ? 'All Dates (Total)' :
                 range === 'daily' ? 'Today' : 
                 range === 'custom' ? 'Custom Range' :
                 `This ${range.charAt(0).toUpperCase() + range.slice(1).replace('ly', '')}`}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isDateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 shadow-lg rounded-lg py-1">
                  <button
                    onClick={() => { setRange('all_time'); setIsDateDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      range === 'all_time' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    All Dates (Total)
                  </button>
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50">Quick Filters</div>
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(f => {
                    const label = f === 'daily' ? 'Today' : `This ${f.charAt(0).toUpperCase() + f.slice(1).replace('ly', '')}`;
                    return (
                      <button
                        key={f}
                        onClick={() => { setRange(f); setIsDateDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          range === f ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50 mt-1">Custom Range</div>
                  <div className="p-3 flex flex-col gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">From</label>
                      <input type="date" className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">To</label>
                      <input type="date" className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                    </div>
                    <button 
                      disabled={!customFrom || !customTo}
                      onClick={() => { setRange(`${customFrom}_${customTo}` as any); setIsDateDropdownOpen(false); }}
                      className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded font-medium text-sm transition-colors"
                    >
                      Apply Custom
                    </button>
                  </div>
                </div>
              )}
            </div>

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

        <div className="flex flex-col gap-6">
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
                  ) : paginatedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center text-sm text-slate-600">No customer records match your search.</td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((customer, index) => (
                      <tr onClick={() => setSelectedCardCode(customer.cardCode || null)} key={`${customer.cardCode ?? 'customer'}-${index}`} className={`transition ${currentCardCode === customer.cardCode ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3 text-sm text-slate-600">{offset + index + 1}</td>
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
                          <div className="flex items-center justify-end gap-2 opacity-60 hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedCardCode(customer.cardCode || null); setIsModalOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" aria-label="View Details"><Eye className="h-4 w-4" /></button>
                            <button className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" aria-label="Edit"><Edit className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalCustomers > 0 && (
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  Showing{' '}
                  <span className="font-semibold text-slate-700">{totalCustomers ? offset + 1 : 0}</span>
                  {' '}–{' '}
                  <span className="font-semibold text-slate-700">{Math.min(offset + limit, totalCustomers)}</span>
                  {' '}of{' '}
                  <span className="font-semibold text-slate-700">{totalCustomers}</span>
                  {' '}customers
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[13px] font-medium text-slate-600">Page</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages || 1}
                      value={page}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setPage(val);
                        }
                      }}
                      className="w-12 h-8 text-center text-[13px] font-semibold text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-[13px] font-medium text-slate-600">of {totalPages || 1}</span>
                  </div>
                  
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 p-4 sm:p-6 backdrop-blur-[3px]" onClick={() => setIsModalOpen(false)}>
              <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg w-full max-w-4xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                      {initials(selectedCustomer?.cardName)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{selectedCustomer?.cardName || '-'}</div>
                      <div className="text-xs text-blue-600">{selectedCustomer?.cardCode || "-"} · {selectedCustomer?.cardType || "Retail Customer"}</div>
                    </div>
                  </div>
                </div>

            <div className="mt-5 border-b border-slate-200 pb-2">
              <div className="flex gap-3 text-sm font-medium">
                <button type="button" onClick={() => { setActiveTab('Profile'); setModalPage(1); }} className={`pb-2 ${activeTab === 'Profile' ? 'border-b-2 border-sky-400 text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>Profile</button>
                <button type="button" onClick={() => { setActiveTab('Purchases'); setModalPage(1); }} className={`pb-2 ${activeTab === 'Purchases' ? 'border-b-2 border-sky-400 text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>Purchases ({purchasesTotal})</button>
                <button type="button" onClick={() => { setActiveTab('Returns'); setModalPage(1); }} className={`pb-2 ${activeTab === 'Returns' ? 'border-b-2 border-sky-400 text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>Returns ({returnsTotal})</button>
                <button type="button" onClick={() => { setActiveTab('Activity'); setModalPage(1); }} className={`pb-2 ${activeTab === 'Activity' ? 'border-b-2 border-sky-400 text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>Activity</button>
              </div>
            </div>

            <div className="pt-2">
              {activeTab === 'Profile' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 h-full">
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
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 h-full">
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
                  </div>

                  <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 mt-2">
                    <MiniStat label="Recent Invoices" value={profile?.recentInvoicesCount?.toString() || "0"} accent="emerald" />
                    <MiniStat label="Recent Returns" value={profile?.recentReturnsCount?.toString() || "0"} accent="amber" />
                  </div>
                </div>
              )}

              {activeTab === 'Purchases' && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                    <thead className="bg-slate-50 font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Doc Num</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!paginatedPurchases.length ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No purchases found.</td></tr>
                      ) : (
                        paginatedPurchases.map(p => (
                          <tr key={p.docEntry} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-blue-600">{p.docNum}</td>
                            <td className="px-4 py-3 text-slate-600">{new Date(p.docDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-slate-600">{p.branch}</td>
                            <td className="px-4 py-3 text-slate-600">{p.itemCount}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(p.docTotal)}</td>
                            <td className="px-4 py-3"><span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{p.status}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  
                  {purchasesTotal > 0 && (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                      <div className="text-sm text-slate-500">
                        Showing <span className="font-semibold text-slate-700">{purchasesOffset + 1}</span> – <span className="font-semibold text-slate-700">{Math.min(purchasesOffset + modalLimit, purchasesTotal)}</span> of <span className="font-semibold text-slate-700">{purchasesTotal}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setModalPage(p => Math.max(1, p - 1))} disabled={modalPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"><ChevronLeft size={14} /></button>
                        <div className="flex items-center gap-2 px-1">
                          <input type="number" min={1} max={purchasesTotalPages || 1} value={modalPage} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 1 && val <= purchasesTotalPages) setModalPage(val); }} className="w-12 h-8 text-center text-[13px] font-semibold text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <span className="text-[13px] font-medium text-slate-600">of {purchasesTotalPages || 1}</span>
                        </div>
                        <button onClick={() => setModalPage(p => Math.min(purchasesTotalPages, p + 1))} disabled={modalPage >= purchasesTotalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"><ChevronRight size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Returns' && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                    <thead className="bg-slate-50 font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Doc Num</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!paginatedReturns.length ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No returns found.</td></tr>
                      ) : (
                        paginatedReturns.map(r => (
                          <tr key={r.docEntry} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-blue-600">{r.docNum}</td>
                            <td className="px-4 py-3 text-slate-600">{new Date(r.docDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-slate-600">{r.branch}</td>
                            <td className="px-4 py-3 text-slate-600">{r.itemCount}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(r.docTotal)}</td>
                            <td className="px-4 py-3"><span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{r.status}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  
                  {returnsTotal > 0 && (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                      <div className="text-sm text-slate-500">
                        Showing <span className="font-semibold text-slate-700">{returnsOffset + 1}</span> – <span className="font-semibold text-slate-700">{Math.min(returnsOffset + modalLimit, returnsTotal)}</span> of <span className="font-semibold text-slate-700">{returnsTotal}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setModalPage(p => Math.max(1, p - 1))} disabled={modalPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"><ChevronLeft size={14} /></button>
                        <div className="flex items-center gap-2 px-1">
                          <input type="number" min={1} max={returnsTotalPages || 1} value={modalPage} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 1 && val <= returnsTotalPages) setModalPage(val); }} className="w-12 h-8 text-center text-[13px] font-semibold text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <span className="text-[13px] font-medium text-slate-600">of {returnsTotalPages || 1}</span>
                        </div>
                        <button onClick={() => setModalPage(p => Math.min(returnsTotalPages, p + 1))} disabled={modalPage >= returnsTotalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"><ChevronRight size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Activity' && (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No recent activity to display.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
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
