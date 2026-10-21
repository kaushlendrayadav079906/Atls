import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, ArrowLeft, RefreshCw, Calendar, ChevronDown, Download, Search, Building2, ShoppingCart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { commonApi } from '../../api/common';

export const SupplierAnalysisPage: React.FC = () => {
  type QuickFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time' | 'custom';
  const [range, setRange] = useState<QuickFilter>('monthly');
  const [branch, setBranch] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => commonApi.getFilterOptions(),
    staleTime: 300_000,
  });

  const applyQuickFilter = (f: QuickFilter) => {
    setRange(f);
    if (f === 'all_time') {
      setDateFrom('');
      setDateTo('');
      setCustomFrom('');
      setCustomTo('');
      return;
    }
    if (f === 'custom') {
      setDateFrom(customFrom);
      setDateTo(customTo);
      return;
    }
    const now = new Date();
    const to = new Date();
    let from = new Date(now);
    if (f === 'daily') {
      from = new Date(now);
    } else if (f === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      from = new Date(now.setDate(diff));
    } else if (f === 'monthly') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (f === 'yearly') {
      from = new Date(now.getFullYear(), 0, 1);
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    setDateFrom(`${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`);
    setDateTo(`${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`);
  };

  const { data: overviewData, isLoading, refetch } = useQuery({
    queryKey: ['supplier-analysis-overview', range, branch, dateFrom, dateTo],
    queryFn: async () => {
      const params: any = { range };
      if (branch) params.branch = branch;
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await apiClient.get('/finance/overview', { params });
      return res.data;
    }
  });

  const rawSuppliers = overviewData?.tables?.top_suppliers || [];
  const filteredSuppliers = rawSuppliers.filter((s: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (s.supplierName || '').toLowerCase().includes(term) || (s.supplierCode || '').toLowerCase().includes(term);
  });

  const totalPurchases = filteredSuppliers.reduce((sum: number, s: any) => sum + (Number(s.netPurchases) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/finance" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
            <ArrowLeft size={16} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold text-slate-900">Supplier Analysis</h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">Procurement volumes, vendor purchase spend, and concentration analysis.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Selector */}
          <div className="relative date-dropdown-container">
            <button 
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-2 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors font-medium text-[13px] shadow-2xs"
            >
              <Calendar className="w-4 h-4 text-slate-500" />
              {range === 'all_time' ? 'All Dates (Total)' :
               range === 'daily' ? 'Today' : 
               range === 'custom' ? 'Custom Range' :
               `This ${range.charAt(0).toUpperCase() + range.slice(1).replace('ly', '')}`}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isDateDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl py-1 z-50">
                <button
                  onClick={() => { applyQuickFilter('all_time'); setIsDateDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${
                    range === 'all_time' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Dates (Total)
                </button>
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50">Quick Filters</div>
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(f => {
                  const label = f === 'daily' ? 'Today' : `This ${f.charAt(0).toUpperCase() + f.slice(1).replace('ly', '')}`;
                  return (
                    <button
                      key={f}
                      onClick={() => { applyQuickFilter(f); setIsDateDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${
                        range === f ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50 mt-1">Custom Range</div>
                <div className="p-3 flex flex-col gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">From</label>
                    <input type="date" className="w-full text-[12.5px] border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">To</label>
                    <input type="date" className="w-full text-[12.5px] border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                  </div>
                  <button 
                    disabled={!customFrom || !customTo}
                    onClick={() => { applyQuickFilter('custom'); setIsDateDropdownOpen(false); }}
                    className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded font-medium text-[12.5px] transition-colors"
                  >
                    Apply Custom
                  </button>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/purchase-orders"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-2xs transition"
          >
            <ShoppingCart size={15} />
            <span>Purchase Orders</span>
          </Link>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-[13px] font-semibold shadow-2xs transition cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search supplier by name or code..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="relative w-[200px]">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <select 
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13.5px] text-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">All Branches</option>
            {filterOptions?.branches?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => {
            if (filteredSuppliers.length === 0) return;
            const headers = ["Rank", "Supplier Code", "Supplier Name", "Invoices", "Net Purchases", "% of Procurement"];
            const rows = filteredSuppliers.map((s: any, idx: number) => [
              s.rank || idx + 1,
              `"${s.supplierCode}"`,
              `"${(s.supplierName || '').replace(/"/g, '""')}"`,
              s.invoices,
              s.netPurchases,
              s.percentage
            ]);
            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `supplier_analysis_${new Date().toISOString().substring(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="flex items-center gap-2 px-4 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer"
        >
          <Download size={15} />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Truck size={20} className="text-rose-500" />
            <h2 className="text-[16px] font-bold text-slate-900">Supplier Procurement Breakdown ({filteredSuppliers.length})</h2>
          </div>
          <div className="text-[13.5px] font-semibold text-slate-700">
            Total Net Purchases: <span className="text-rose-600 font-bold">₹{totalPurchases.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] sm:text-[14px]">
            <thead className="border-b border-slate-100 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2.5 w-8">#</th>
                <th className="pb-2.5">Supplier Code</th>
                <th className="pb-2.5">Supplier Name</th>
                <th className="pb-2.5 text-center">Invoices</th>
                <th className="pb-2.5 text-right">Net Purchases</th>
                <th className="pb-2.5 pl-4 w-36">% of Procurement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">Loading supplier analysis from SAP...</td>
                </tr>
              ) : filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((s: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3 text-[12px] text-slate-400">{s.rank || idx + 1}</td>
                    <td className="py-3 font-mono text-[12px] font-semibold text-slate-600">{s.supplierCode}</td>
                    <td className="py-3 font-bold text-slate-900">{s.supplierName}</td>
                    <td className="py-3 text-center text-slate-600">{s.invoices}</td>
                    <td className="py-3 text-right font-bold text-slate-900">₹{Number(s.netPurchases).toLocaleString('en-IN')}</td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-slate-600 w-11">{s.percentage}%</span>
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div style={{ width: `${Math.min(100, s.percentage)}%` }} className="bg-rose-500 h-full rounded-full" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">No supplier records found for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default SupplierAnalysisPage;

