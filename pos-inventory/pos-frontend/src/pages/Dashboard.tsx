import { useQueryClient } from '@tanstack/react-query';
import type { UIEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Loader from '../components/Loader';
import { useOperatorDashboard } from '../hooks/useOperatorDashboard';
import { useRecentSalesFeed } from '../hooks/useRecentSalesFeed';
import { cancelSale } from '../services/api';
import type { DashboardRecentSale, DateRange } from '../types';
import { handleError } from '../utils/errorHandler';
import { buildReceiptDocument, getReceiptLogoDataUrl, printReceiptInBrowser } from '../utils/receiptPrinter';

const formatCurrency = (amount: number) => `Rs ${amount.toFixed(2)}`;

const formatSaleDate = (value?: string) => {
  if (!value) return '-';
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return value;
  return dateValue.toLocaleString();
};

const RANGE_LABELS: Record<DateRange, string> = {
  daily: "Today's",
  weekly: "This Week's",
  monthly: "This Month's",
  yearly: "This Year's",
  all_time: 'All-Time',
};

const Dashboard = () => {
  const [range, setRange] = useState<DateRange>('daily');
  const [salesSearch, setSalesSearch] = useState('');
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();
  const { data, isLoading, error, forceRefresh, dataUpdatedAt } = useOperatorDashboard(range);
  const {
    data: salesFeed,
    isLoading: isSalesFeedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecentSalesFeed({ range, search: debouncedSearch });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(salesSearch.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [salesSearch]);

  const feedItems = useMemo(
    () => salesFeed?.pages.flatMap((page) => page.items) ?? [],
    [salesFeed]
  );

  const handleSalesFeedScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (remaining < 80 && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  const handlePrint = async (sale: DashboardRecentSale) => {
    try {
      const saleId = sale.saleId || String(sale.docNum ?? sale.docEntry ?? 'N/A');
      const paymentType = (sale.paymentMethod || 'cash').toLowerCase();
      const logoSrc = await getReceiptLogoDataUrl();
      const receiptDocument = buildReceiptDocument({
        saleId,
        timestamp: formatSaleDate(sale.docDate),
        items: sale.items.map((item) => ({
          name: item.itemName || item.itemCode || 'Item',
          quantity: item.quantity,
          amount: item.lineTotal > 0 ? item.lineTotal : item.unitPrice * item.quantity,
          hsnCode: item.itemCode || 'N/A',
        })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        total: sale.total,
        paymentMethod: sale.paymentMethod || 'cash',
        paidAmount: paymentType === 'cash' ? sale.total : undefined,
        changeAmount: 0,
        customer: { name: sale.customerName || '' },
        logoSrc,
      });
      await printReceiptInBrowser(receiptDocument);
      toast.success('Receipt sent to printer');
    } catch (errorValue) {
      const message = handleError(errorValue, 'Receipt Print');
      toast.error(message);
    }
  };

  const handleCancelSale = async (sale: DashboardRecentSale) => {
    if (!sale.docEntry) {
      toast.error('Cannot void sale without an SAP Document Entry ID.');
      return;
    }
    
    if (sale.hasReturn) {
      toast.error('Cannot void a sale that has already been returned.');
      return;
    }

    if (!window.confirm(`Are you sure you want to void Sale #${sale.docNum || sale.docEntry}? This cannot be undone.`)) {
      return;
    }

    setCancellingSaleId(String(sale.docEntry));
    try {
      const result = await cancelSale(sale.docEntry);
      toast.success(result.message || 'Sale voided successfully.');
      queryClient.invalidateQueries({ queryKey: ['recentSalesFeed'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    } catch (error) {
      const err = error as any;
      const msg = err.response?.data?.detail || err.message || 'Failed to void sale';
      toast.error(msg);
    } finally {
      setCancellingSaleId(null);
    }
  };

  if (isLoading) {
    return <Loader message="Loading command center..." />;
  }

  if (!data) {
    return (
      <div className="h-full bg-gray-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Dashboard Data Unavailable</h3>
          <p className="text-slate-500 mb-6 text-sm">{handleError(error, 'Dashboard')}</p>
          <button
            onClick={() => forceRefresh()}
            className="w-full py-2.5 bg-slate-900 text-white shadow-md hover:bg-slate-800 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const periodLabel = RANGE_LABELS[range];

  return (
    <div className="h-full bg-gray-50/50 p-4 sm:p-6 lg:p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {error && data && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold">Service Unavailable - Showing Stale Data</p>
                <p className="text-xs text-amber-700/80">
                  {handleError(error, 'Dashboard')}. 
                  {dataUpdatedAt ? ` Last loaded: ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}
                </p>
              </div>
            </div>
            <button onClick={() => forceRefresh()} className="px-3 py-1.5 text-xs font-semibold bg-amber-100 hover:bg-amber-200 rounded-md transition-colors cursor-pointer">
              Retry
            </button>
          </div>
        )}
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 text-white pb-6 pt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">Retail Operations Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">Branch overview • Today • Data from SAP Business One</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-900 rounded-lg p-2 border border-slate-700 flex items-center gap-2 shadow-sm">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              <select className="bg-transparent text-sm text-slate-300 outline-none font-medium">
                <option>Main Branch (WH-001)</option>
              </select>
            </div>
            
            <div className="bg-slate-900 rounded-lg p-2 border border-slate-700 flex items-center gap-2 shadow-sm">
               <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               <select className="bg-transparent text-sm text-slate-300 outline-none font-medium" value={range} onChange={(e) => setRange(e.target.value as any)}>
                 <option value="daily">Today</option>
                 <option value="weekly">This Week</option>
                 <option value="monthly">This Month</option>
               </select>
            </div>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
          
          {/* Sales Today */}
          <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-5 flex flex-col justify-between text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>
              <p className="text-slate-400 text-sm font-medium">Sales {periodLabel}</p>
              <h3 className="text-3xl font-bold text-white mt-1">{formatCurrency(data.todayTotal)}</h3>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <span className="text-cyan-400">{data.billCount} completed bills</span>
            </div>
          </div>

          {/* Completed Bills */}
          <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-5 flex flex-col justify-between text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
              </div>
              <p className="text-slate-400 text-sm font-medium">Completed Bills</p>
              <h3 className="text-3xl font-bold text-white mt-1">{data.billCount}</h3>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              <span className="text-blue-400">Based on SAP Invoices</span>
            </div>
          </div>

          {/* Active Shift */}
          <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-5 flex flex-col justify-between text-white relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-800 text-slate-400">Offline</span>
              </div>
              <p className="text-slate-400 text-sm font-medium">Active Shift</p>
              <h3 className="text-lg font-semibold text-white mt-1 leading-tight">Shift data unavailable</h3>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span className="text-slate-400">Feature pending backend</span>
            </div>
          </div>

          {/* Low-Stock Items */}
          <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-5 flex flex-col justify-between text-white relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
              </div>
              <p className="text-slate-400 text-sm font-medium">Low-stock Items</p>
              <h3 className="text-lg font-semibold text-white mt-1 leading-tight">Access Restricted</h3>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <span className="text-slate-400">Managers/Admins only</span>
            </div>
          </div>
        </div>

        {/* Charts Container - Left honest unavailable states */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
          <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-5 min-h-[300px] flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-2">Sales Overview</h2>
              <div className="flex gap-2 mb-4">
                <span className="px-3 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-400">7D</span>
                <span className="px-3 py-1 text-xs font-semibold rounded-md bg-cyan-500/20 text-cyan-400">30D</span>
                <span className="px-3 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-400">90D</span>
                <span className="px-3 py-1 text-xs font-semibold rounded-md bg-slate-800 text-slate-400">1Y</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <h3 className="text-slate-300 font-medium">Chart Restricted</h3>
              <p className="text-slate-500 text-sm max-w-xs mt-1">This chart requires Manager or Admin permissions. It is available in Atlas Analytics.</p>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-5 min-h-[300px] flex flex-col justify-between">
            <h2 className="text-lg font-bold text-white mb-2">Orders This Week</h2>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <h3 className="text-slate-300 font-medium">Chart Restricted</h3>
              <p className="text-slate-500 text-sm max-w-xs mt-1">This chart requires Manager or Admin permissions. It is available in Atlas Analytics.</p>
            </div>
          </div>
        </div>

        {/* Tables Container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
          
          {/* Recent Sales */}
          <div className="lg:col-span-2 bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Recent Sales
              </h2>
              <div className="flex gap-4 items-center w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search transactions..."
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-500 transition-colors"
                  />
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto" onScroll={handleSalesFeedScroll}>
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-500 uppercase bg-slate-950/50 sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    <th className="px-4 py-3 font-semibold">Payment Method</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {isSalesFeedLoading && feedItems.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading transactions...</td></tr>
                  ) : feedItems.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No transactions found.</td></tr>
                  ) : (
                    feedItems.map((sale) => {
                      const billLabel = sale.docNum ?? sale.docEntry ?? 'N/A';
                      const rowKey = String(sale.docEntry ?? sale.docNum ?? `${sale.docDate || ''}-${sale.total}`);
                      
                      return (
                        <tr key={rowKey} className="hover:bg-slate-800/50 transition-colors group">
                          <td className="px-4 py-3 font-medium text-cyan-500">INV-{billLabel}</td>
                          <td className="px-4 py-3 text-slate-200 truncate max-w-[120px]" title={sale.customerName || 'Walk-in'}>
                            {sale.customerName || 'Walk-in'}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-200 text-right">{formatCurrency(sale.total)}</td>
                          <td className="px-4 py-3 text-slate-400 capitalize">
                            {(sale.paymentMethod || 'cash').toLowerCase()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sale.hasReturn ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'}`}>
                                {sale.hasReturn ? 'RETURNED' : 'COMPLETED'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatSaleDate(sale.docDate).split(', ')[1] || formatSaleDate(sale.docDate)}</td>
                          <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                            <button
                              onClick={() => void handlePrint(sale)}
                              className="p-1 text-slate-500 hover:text-cyan-400 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Print"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                            {(!sale.hasReturn) && (
                              <button
                                onClick={() => void handleCancelSale(sale)}
                                disabled={cancellingSaleId === String(sale.docEntry)}
                                className={`p-1 rounded-md transition-colors ${cancellingSaleId === String(sale.docEntry) ? 'text-slate-600 cursor-wait' : 'text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                                title="Void"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {isFetchingNextPage && (
                    <tr><td colSpan={7} className="px-4 py-4 text-center text-xs text-slate-500">Loading more...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Top Products */}
          <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
               <h2 className="text-base font-bold text-white flex items-center gap-2">
                 <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                 Top Products
               </h2>
               <button className="text-xs text-cyan-500 hover:text-cyan-400 font-medium">View all</button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900">
               <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
               <h3 className="text-slate-300 font-medium text-sm">Products Restricted</h3>
               <p className="text-slate-500 text-xs max-w-[180px] mx-auto mt-1">This report requires Manager or Admin permissions.</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Dashboard;
