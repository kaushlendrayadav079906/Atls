import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileText,
  MoreVertical,
  Receipt,
  User,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useState } from 'react';
import { salesApi } from '../../api/sales';
import { useDebounce } from '../../hooks/useDebounce';
import type { DashboardRecentSalesPage, SalesFeedParams } from '../../types/sales';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

export const InvoiceReportPage = () => {
  const [activeTab, setActiveTab] = useState('Invoice List');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [dateRange] = useState<SalesFeedParams['range']>('monthly');
  const [page, setPage] = useState(1);
  const limit = 7;
  const offset = (page - 1) * limit;

  const { data, isLoading } = useQuery<DashboardRecentSalesPage>({
    queryKey: ['invoice-report', dateRange, debouncedSearch, offset, limit],
    queryFn: () => salesApi.getSalesFeed({
      range: dateRange,
      search: debouncedSearch || undefined,
      limit,
      offset
    })
  });

  const kpis = [
    {
      title: 'Total Invoices',
      val: '1,248',
      icon: FileText,
      pct: '+12.5%',
      isUp: true,
      iconBg: 'bg-blue-100 text-blue-700',
    },
    {
      title: 'Total Sales',
      val: '₹12,48,650',
      icon: TrendingUp,
      pct: '+14.2%',
      isUp: true,
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'Total Paid',
      val: '₹11,92,300',
      icon: CreditCard,
      subtitle: '95.5% collected',
      isUp: true,
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'Total Due',
      val: '₹56,350',
      icon: Receipt,
      subtitle: '4.5% pending',
      isUp: false,
      iconBg: 'bg-red-100 text-red-600',
    },
    {
      title: 'Avg. Invoice Value',
      val: '₹1,000',
      icon: PieChartIcon,
      pct: '+6.8%',
      isUp: true,
      iconBg: 'bg-violet-100 text-violet-700',
    },
  ];

  return (
    <div className="flex flex-col min-h-full bg-slate-50 font-sans -m-4 sm:-m-5 lg:-m-6 p-4 sm:p-5 lg:p-6 overflow-y-auto">

      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Invoice Report</h1>
          <p className="mt-1.5 text-[14px] font-medium text-slate-500">
            View and analyze invoice details, payments and sales transactions.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors w-fit">
          <Download className="h-4 w-4" />
          Export
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>

      {/* ── Main Tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-8 bg-slate-200/50 p-1 rounded-xl w-fit">
        {['Invoice Report', 'Payment Report', 'Summary & Analytics'].map(tab => (
          <button
            key={tab}
            className={cn(
              'px-5 py-2 text-[13px] font-semibold rounded-lg transition-all',
              tab === 'Invoice Report'
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        {kpis.map((card, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_4px_15px_-3px_rgba(6,81,237,0.1)] transition-shadow flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-2">{card.title}</p>
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{card.val}</div>
              </div>
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', card.iconBg)}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="text-[12px]">
              {card.pct && (
                <>
                  <span className={cn('font-bold', card.isUp ? 'text-emerald-600' : 'text-red-500')}>
                    {card.pct}
                  </span>
                  <span className="text-slate-400 font-medium ml-1.5">vs. prev. month</span>
                </>
              )}
              {card.subtitle && (
                <span className={cn('font-bold', card.isUp ? 'text-emerald-600' : 'text-red-500')}>
                  {card.subtitle}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Date Range</label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>Nov 1, 2024 – Nov 30, 2024</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Branch</label>
            <div className="relative">
              <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>Main Branch (WH-001)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Customer</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>All Customers</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Invoice Status</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>All Status</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Payment Status</label>
            <div className="relative">
              <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>All</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Payment Method</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>All Methods</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm">
              Apply Filters
            </button>
            <button
              onClick={() => { setSearchTerm(''); setPage(1); }}
              className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-tabs: Invoice List / Analytics ───────────────────── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200/60 pb-1 w-full">
        {['Invoice List', 'Analytics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-[14px] font-bold rounded-lg transition-all relative',
              activeTab === tab
                ? 'text-blue-700 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            )}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-4 text-center w-10 text-[11px] font-bold uppercase tracking-widest text-slate-500">#</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">Invoice No</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">Customer</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">Date &amp; Time</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">Amount</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">Payment Method</th>
                <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">Payment Status</th>
                <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Loader2 className="w-7 h-7 text-blue-500 animate-spin mx-auto" />
                    <p className="mt-2 text-sm text-slate-500">Loading invoices...</p>
                  </td>
                </tr>
              ) : data?.items?.map((sale, idx) => {
                const rowIndex = offset + idx + 1;
                let paymentStatus = 'Paid';
                let pClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';

                if (sale.hasReturn) {
                  paymentStatus = 'Refunded';
                  pClass = 'bg-red-50 text-red-600 border border-red-200';
                } else if (sale.saleId?.includes('38')) {
                  paymentStatus = 'Partially Paid';
                  pClass = 'bg-amber-50 text-amber-700 border border-amber-200';
                }

                return (
                  <tr key={sale.docEntry || idx} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-5 py-4 text-center text-[13px] font-medium text-slate-400">{rowIndex}</td>
                    <td className="px-5 py-4 text-[13px] font-bold text-blue-600">{sale.saleId}</td>
                    <td className="px-5 py-4 text-[14px] font-semibold text-slate-800">{sale.customerName || 'Walk-in'}</td>
                    <td className="px-5 py-4 text-[13px] font-medium text-slate-500">{sale.docDate}</td>
                    <td className="px-5 py-4 text-[14px] font-extrabold text-slate-900">{fmt(sale.total)}</td>
                    <td className="px-5 py-4 text-[13px] font-medium text-slate-600 capitalize">{sale.paymentMethod || 'Cash'}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Completed
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border', pClass)}>
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"><Eye size={16} /></button>
                        <button className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"><Download size={16} /></button>
                        <button className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"><MoreVertical size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────── */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing{' '}
            <span className="font-semibold text-slate-700">{data?.total ? offset + 1 : 0}</span>
            {' '}–{' '}
            <span className="font-semibold text-slate-700">{Math.min(offset + limit, data?.total || 0)}</span>
            {' '}of{' '}
            <span className="font-semibold text-slate-700">{data?.total || 0}</span>
            {' '}invoices
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                  page === n
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {n}
              </button>
            ))}
            <span className="px-1 text-slate-400 text-sm">…</span>
            <button
              onClick={() => setPage(p => p + 1)}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// SVG icon for PieChart (no lucide equivalent)
function PieChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  );
}
