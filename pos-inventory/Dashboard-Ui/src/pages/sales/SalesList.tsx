import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  Receipt,
  Search
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesApi } from '../../api/sales';
import { useDebounce } from '../../hooks/useDebounce';
import type { DashboardRecentSalesPage, SalesFeedParams } from '../../types/sales';

export const SalesList = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [dateRange, setDateRange] = useState<SalesFeedParams['range']>('monthly');
  const [page, setPage] = useState(1);
  const limit = 10;

  const offset = (page - 1) * limit;

  const { data, isLoading, isError, error, refetch } = useQuery<DashboardRecentSalesPage>({
    queryKey: ['sales', dateRange, debouncedSearch, offset, limit],
    queryFn: () => salesApi.getSalesFeed({
      range: dateRange,
      search: debouncedSearch || undefined,
      limit,
      offset
    })
  });

  const handleRowClick = (saleId?: number) => {
    if (saleId) {
      navigate(`/sales/${saleId}`);
    }
  };

  const totalPages = data?.total ? Math.ceil(data.total / limit) : 1;

  const renderStatusBadge = (hasReturn: boolean) => {
    if (hasReturn) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">Returned</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">Completed</span>;
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales & Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and view all sales invoices for your selected branch.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Invoice no., customer name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white transition-colors"
              />
            </div>
          </div>
          
          <div className="w-full sm:w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Date Range</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar size={16} />
              </div>
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value as SalesFeedParams['range']);
                  setPage(1);
                }}
                className="block w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white transition-colors appearance-none"
              >
                <option value="daily">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
                <option value="yearly">This Year</option>
                <option value="all_time">All Time</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-end">
            <button 
              onClick={() => {
                setSearchTerm('');
                setDateRange('monthly');
                setPage(1);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors flex items-center gap-2"
            >
              <Filter size={16} />
              Clear Filters
            </button>
          </div>
        </div>

        {isError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading sales data</h3>
              <p className="mt-1 text-sm text-red-700">{(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not connect to the server.'}</p>
              <button onClick={() => refetch()} className="mt-3 text-sm font-medium text-red-700 hover:text-red-600 underline">Try again</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice No.</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Items</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Method</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="relative px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                    <p className="mt-2 text-sm text-slate-500">Loading invoices...</p>
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-base font-medium text-slate-900">No invoices found</p>
                    <p className="text-sm mt-1">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              ) : (
                data?.items?.map((sale) => (
                  <tr 
                    key={sale.docEntry} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => handleRowClick(sale.docEntry)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                      {sale.saleId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                      {sale.docDate}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      <div className="font-medium">{sale.customerName || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{sale.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-center">
                      {sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900 text-right">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(sale.total)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-center capitalize">
                      {sale.paymentMethod || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {renderStatusBadge(sale.hasReturn)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleRowClick(sale.docEntry); }}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.total ? (
          <div className="flex items-center justify-between border-t border-slate-200 mt-4 pt-4">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium">{offset + 1}</span> to <span className="font-medium">{Math.min(offset + limit, data.total)}</span> of <span className="font-medium">{data.total}</span> invoices
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-sm font-medium text-slate-700 px-2">
                Page {page} of {totalPages}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
