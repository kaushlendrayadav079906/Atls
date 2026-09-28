import { useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Filter,
  MoreVertical,
  RotateCcw,
  Settings2,
  TrendingUp,
  User,
  Warehouse,
  PieChart,
  Eye
} from 'lucide-react';

export const SalesReportPage = () => {
  const [activeTab, setActiveTab] = useState('Sales Details');

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Sales Report</h1>
            <p className="mt-0.5 text-[13px] text-sky-200/60">View and export sales summary, items, and customer wise reports.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500">
          <Download className="h-4 w-4" />
          Quick Export
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-[16px] border border-sky-900/60 bg-[#061a2f] p-4">
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-sky-200/60">Date Range</label>
            <div className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-2 text-[12px] text-white">
              <CalendarDays className="h-3.5 w-3.5 text-sky-400" />
              <span className="flex-1">Nov 1, 2024 - Nov 30, 2024</span>
              <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-sky-200/60">Branch</label>
            <div className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-2 text-[12px] text-white">
              <Warehouse className="h-3.5 w-3.5 text-sky-400" />
              <span className="flex-1">Main Branch (WH-001)</span>
              <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-sky-200/60">Report View</label>
            <div className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-2 text-[12px] text-white">
              <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
              <span className="flex-1">Summary</span>
              <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-sky-200/60">Group By</label>
            <div className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-2 text-[12px] text-white">
              <CalendarDays className="h-3.5 w-3.5 text-sky-400" />
              <span className="flex-1">Date (Daily)</span>
              <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />
            </div>
          </div>
          <div className="row-span-2 hidden items-end justify-end gap-2 lg:flex">
            <button className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-5 text-[12px] font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500">
              <Filter className="h-3.5 w-3.5" />
              Apply Filters
            </button>
            <button className="flex h-9 items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] px-4 text-[12px] font-semibold text-sky-200 hover:bg-[#0b2340]">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-sky-200/60">Customer</label>
            <div className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-2 text-[12px] text-white">
              <User className="h-3.5 w-3.5 text-sky-400" />
              <span className="flex-1">All Customers</span>
              <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-sky-200/60">Product Category</label>
            <div className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-2 text-[12px] text-white">
              <div className="h-3.5 w-3.5 rounded bg-sky-400" />
              <span className="flex-1">All Categories</span>
              <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-sky-200/60">Payment Method</label>
            <div className="flex items-center gap-2 rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-2 text-[12px] text-white">
              <div className="h-3.5 w-3.5 rounded bg-sky-400" />
              <span className="flex-1">All Payment Methods</span>
              <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Total Sales', val: '₹12,840.50', up: true, pct: '+12.5%', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: TrendingUp },
          { title: 'Total Invoices', val: '28', up: false, pct: '-16.7%', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: FileText },
          { title: 'Total Customers', val: '156', up: false, pct: '-8.2%', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: User },
          { title: 'Avg. Order Value', val: '₹458.60', up: false, pct: '-2.4%', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: CalendarDays },
        ].map((card, i) => (
          <div key={i} className="flex items-center gap-4 rounded-[16px] border border-sky-900/60 bg-[#061a2f] p-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-[12px] text-sky-200/60">{card.title}</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-bold text-white">{card.val}</span>
                <span className={`text-[10px] ${card.up ? 'text-emerald-400' : 'text-red-400'}`}>{card.pct}</span>
              </div>
              <p className="text-[10px] text-sky-200/40">vs. previous period</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[16px] border border-sky-900/60 bg-[#061a2f] p-4">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-sky-400" />
              <h3 className="font-semibold text-white">Daily Sales Trend</h3>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-sky-800/60 bg-[#071d34] px-3 py-1.5 text-[11px] text-sky-200">
              Sales Amount
              <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />
            </div>
          </div>
          {/* Chart Placeholder */}
          <div className="relative h-[200px] w-full border-b border-l border-sky-800/50">
            <div className="absolute -left-8 flex h-full flex-col justify-between text-[10px] text-sky-200/40">
              <span>₹20K</span>
              <span>₹15K</span>
              <span>₹10K</span>
              <span>₹5K</span>
              <span>₹0</span>
            </div>
            <div className="flex h-full items-end justify-between px-2">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="w-[2%] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]" style={{ height: `${Math.random() * 80 + 20}%` }} />
              ))}
            </div>
            <div className="absolute -bottom-6 flex w-full justify-between px-2 text-[10px] text-sky-200/40">
              <span>Nov 1</span>
              <span>Nov 5</span>
              <span>Nov 10</span>
              <span>Nov 15</span>
              <span>Nov 20</span>
              <span>Nov 25</span>
              <span>Nov 30</span>
            </div>
          </div>
        </div>

        <div className="rounded-[16px] border border-sky-900/60 bg-[#061a2f] p-4">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-sky-400" />
              <h3 className="font-semibold text-white">Sales by Payment Method</h3>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-sky-200/60">
              This Period
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>
          {/* Circular Chart Placeholder */}
          <div className="flex flex-col items-center gap-6 xl:flex-row">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[12px] border-blue-500 border-l-purple-500 border-r-amber-500 border-t-emerald-500">
              <div className="text-center">
                <div className="text-[14px] font-bold text-white">₹12,840.50</div>
                <div className="text-[10px] text-sky-200/60">Total Sales</div>
              </div>
            </div>
            <div className="flex-1 space-y-3 text-[11px]">
              {[
                { label: 'Cash', val: '42%', amt: '₹5,393.01', color: 'bg-blue-500' },
                { label: 'Card (Visa/Mastercard)', val: '28%', amt: '₹3,594.94', color: 'bg-purple-500' },
                { label: 'UPI / Wallet', val: '20%', amt: '₹2,568.10', color: 'bg-amber-500' },
                { label: 'Credit', val: '8%', amt: '₹1,026.45', color: 'bg-emerald-500' },
                { label: 'Other', val: '2%', amt: '₹257.99', color: 'bg-slate-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-100">
                    <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </div>
                  <div className="flex gap-4">
                    <span className="text-sky-200/60">{item.val}</span>
                    <span className="text-white">{item.amt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Table */}
      <div className="rounded-[16px] border border-sky-900/60 bg-[#061a2f] p-4">
        <div className="mb-4 flex flex-col justify-between gap-4 border-b border-sky-800/50 sm:flex-row sm:items-center">
          <div className="flex gap-4 text-[13px] font-semibold text-sky-200/60">
            {['Sales Details', 'Top Selling Items', 'Customer Wise Sales', 'Branch Wise Sales'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 pb-3 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pb-2">
            <button className="flex items-center gap-2 rounded border border-sky-800/60 px-3 py-1.5 text-[11px] text-sky-200 hover:bg-[#071d34]">
              <Download className="h-3 w-3" />
              Download
              <ChevronDown className="h-3 w-3" />
            </button>
            <button className="flex items-center gap-2 rounded border border-sky-800/60 px-3 py-1.5 text-[11px] text-sky-200 hover:bg-[#071d34]">
              <Settings2 className="h-3 w-3" />
              Customize Columns
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] text-sky-100">
            <thead className="text-[10px] text-sky-200/50">
              <tr>
                <th className="py-2">#</th>
                <th className="py-2">Invoice No.</th>
                <th className="py-2">Date & Time</th>
                <th className="py-2">Customer</th>
                <th className="py-2 text-center">Items</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2">Payment Method</th>
                <th className="py-2 text-center">Status</th>
                <th className="py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-800/30">
              {[
                { no: 'INV-7843', dt: '30 Nov 2024 10:24 AM', name: 'Jane Smith', items: 3, amt: '₹234.00', pay: 'Cash', status: 'Completed' },
                { no: 'INV-7842', dt: '30 Nov 2024 10:12 AM', name: 'Mike Chen', items: 5, amt: '₹567.50', pay: 'Card (Visa)', status: 'Completed' },
                { no: 'INV-7841', dt: '29 Nov 2024 09:58 AM', name: 'Robert Davis', items: 2, amt: '₹123.00', pay: 'Cash', status: 'Completed' },
                { no: 'INV-7840', dt: '29 Nov 2024 09:45 AM', name: 'Sarah Wilson', items: 6, amt: '₹890.00', pay: 'Card (Mastercard)', status: 'Completed' },
                { no: 'INV-7839', dt: '29 Nov 2024 09:30 AM', name: 'David Kim', items: 1, amt: '₹456.00', pay: 'UPI', status: 'Completed' },
                { no: 'INV-7838', dt: '29 Nov 2024 09:12 AM', name: 'Emily Brown', items: 4, amt: '₹320.00', pay: 'Cash', status: 'Refunded', isRed: true },
                { no: 'INV-7837', dt: '28 Nov 2024 08:55 AM', name: 'Alex Johnson', items: 2, amt: '₹789.00', pay: 'Card (Visa)', status: 'Completed' },
                { no: 'INV-7836', dt: '28 Nov 2024 08:40 AM', name: 'Chris Lee', items: 3, amt: '₹345.00', pay: 'UPI', status: 'Completed' },
              ].map((r, i) => (
                <tr key={r.no} className="hover:bg-[#071d34]">
                  <td className="py-2.5 text-sky-200/50">{i + 1}</td>
                  <td className="py-2.5 font-medium text-blue-400">{r.no}</td>
                  <td className="py-2.5 text-sky-200/70">{r.dt}</td>
                  <td className="py-2.5">{r.name}</td>
                  <td className="py-2.5 text-center">{r.items}</td>
                  <td className="py-2.5 text-right font-semibold">{r.amt}</td>
                  <td className="py-2.5 text-sky-200/70">{r.pay}</td>
                  <td className="py-2.5 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      r.isRed ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-sky-200/50">
                    <div className="flex items-center justify-center gap-2">
                      <Eye className="h-3.5 w-3.5 cursor-pointer hover:text-white" />
                      <MoreVertical className="h-3.5 w-3.5 cursor-pointer hover:text-white" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between text-[11px] text-sky-200/60">
            <span>Showing 1 to 8 of 28 invoices</span>
            <div className="flex items-center gap-1">
              <button className="flex h-6 w-6 items-center justify-center rounded border border-sky-800/60 bg-[#071d34] hover:text-white">{'<'}</button>
              <button className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white">1</button>
              <button className="flex h-6 w-6 items-center justify-center rounded border border-sky-800/60 bg-[#071d34] hover:text-white">2</button>
              <button className="flex h-6 w-6 items-center justify-center rounded border border-sky-800/60 bg-[#071d34] hover:text-white">3</button>
              <button className="flex h-6 w-6 items-center justify-center rounded border border-sky-800/60 bg-[#071d34] hover:text-white">4</button>
              <button className="flex h-6 w-6 items-center justify-center rounded border border-sky-800/60 bg-[#071d34] hover:text-white">{'>'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
