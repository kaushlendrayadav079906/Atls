import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, ArrowLeft, RefreshCw, ShoppingCart } from 'lucide-react';
import { apiClient } from '../../api/client';

export const PurchaseInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchaseInvoices = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/finance/overview');
      setInvoices(res.data?.tables?.top_suppliers || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseInvoices();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/finance" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
            <ArrowLeft size={16} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="text-[22px] font-black text-slate-900">Purchase Invoices</h1>
            <p className="text-[12px] text-slate-500">A/P Purchase invoices and vendor billing from SAP Business One.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/purchase-orders"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-[11.5px] font-semibold text-slate-700 shadow-2xs transition"
          >
            <ShoppingCart size={13} />
            <span>Purchase Orders</span>
          </Link>
          <button
            onClick={fetchPurchaseInvoices}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-[11.5px] font-semibold shadow-2xs transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <FileSpreadsheet size={18} className="text-amber-500" />
          <h2 className="text-[14px] font-bold text-slate-800">A/P Invoices by Supplier</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-slate-100 text-[10.5px] font-semibold text-slate-400">
              <tr>
                <th className="pb-2">Supplier Code</th>
                <th className="pb-2">Supplier Name</th>
                <th className="pb-2 text-center">Invoices Count</th>
                <th className="pb-2 text-right">Net Purchases</th>
                <th className="pb-2 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">Loading purchase invoices...</td>
                </tr>
              ) : invoices.length > 0 ? (
                invoices.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 font-mono text-[11px] text-slate-500">{s.supplierCode}</td>
                    <td className="py-2.5 font-semibold text-slate-900">{s.supplierName}</td>
                    <td className="py-2.5 text-center text-slate-600">{s.invoices}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">₹{Number(s.netPurchases).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 text-right text-slate-500 font-medium">{s.percentage}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">No purchase invoices found in SAP.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default PurchaseInvoicesPage;
