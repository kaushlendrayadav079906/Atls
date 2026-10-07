import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  Download,
  Loader2,
  Printer,
  User
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { salesApi } from '../../api/sales';

export const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: invoice, isLoading, isError, error } = useQuery({
    queryKey: ['saleDetail', id],
    queryFn: () => salesApi.getSaleDetail(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto mt-8 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-red-800 mb-2">Failed to load invoice</h2>
        <p className="text-red-700 mb-6">{(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'The invoice could not be found or you do not have permission to view it.'}</p>
        <button 
          onClick={() => navigate('/sales')}
          className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
        >
          Back to Sales
        </button>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={() => navigate('/sales')}
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Back to Sales
        </button>
        <div className="flex items-center gap-3">
          <button className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
            <Printer size={16} className="mr-1.5" />
            Print
          </button>
          <button className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
            <Download size={16} className="mr-1.5" />
            Download
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Invoice Header */}
        <div className="border-b border-slate-200 p-6 sm:p-8 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Invoice Details</h1>
              <div className="flex items-center flex-wrap gap-3">
                <span className="text-lg font-medium text-blue-600">{invoice.saleId}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {invoice.syncStatus === 'synced' ? 'Completed' : invoice.syncStatus}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:text-right gap-x-8 gap-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Date & Time</p>
                <div className="flex items-center sm:justify-end text-sm text-slate-900 font-medium">
                  <Calendar size={14} className="mr-1.5 text-slate-500" />
                  {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : '-'}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Payment Method</p>
                <div className="flex items-center sm:justify-end text-sm text-slate-900 font-medium capitalize">
                  <CreditCard size={14} className="mr-1.5 text-slate-500" />
                  Cash/Card {/* We would pull this from real data if available in SaleDetail */}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <User className="text-slate-500" size={18} />
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Customer Information</h3>
            </div>
            {invoice.customer ? (
              <div>
                <p className="font-medium text-slate-900 text-base">{invoice.customer}</p>
                {/* Normally we'd have phone/email here if returned in SaleDetail */}
                <p className="text-sm text-slate-500 mt-1">Customer ID: {invoice.customer}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Walk-in Customer</p>
            )}
          </div>
          
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="text-slate-500" size={18} />
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Branch Details</h3>
            </div>
            <div>
              <p className="font-medium text-slate-900 text-base">Branch</p>
              <p className="text-sm text-slate-500 mt-1">System default branch context</p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Items ({invoice.items?.length || 0})</h3>
          
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Qty</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit Price</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {invoice.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {item.ItemDescription || item.ItemCode || 'Unknown Item'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                      {item.ItemCode}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900 text-center font-medium">
                      {item.Quantity}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.Price || item.UnitPrice || 0)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900 text-right">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.LineTotal || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="border-t border-slate-200 p-6 sm:p-8 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row justify-between gap-8">
            <div className="w-full sm:w-1/2">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-slate-500 bg-white p-3 rounded-lg border border-slate-200 min-h-[80px]">
                No additional notes.
              </p>
            </div>
            
            <div className="w-full sm:w-80 space-y-3">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(invoice.total)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Discount</span>
                <span className="font-medium text-red-600">
                  - {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(0)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(0)}
                </span>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-base font-bold text-slate-900 uppercase tracking-wider">Grand Total</span>
                <span className="text-xl font-bold text-blue-600">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(invoice.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
