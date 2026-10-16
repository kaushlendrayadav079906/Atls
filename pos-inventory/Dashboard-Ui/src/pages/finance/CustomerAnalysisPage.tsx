import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowLeft, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';


export const CustomerAnalysisPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomerAnalysis = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/finance/overview');
      setCustomers(res.data?.tables?.top_customers || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerAnalysis();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/finance" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
            <ArrowLeft size={16} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold text-slate-900">Customer Analysis</h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">Revenue concentration, purchase frequency, and billing distribution.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/customers"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-[13px] sm:text-[13.5px] font-semibold text-slate-700 shadow-2xs transition"
          >
            <Users size={15} />
            <span>Manage Customers</span>
          </Link>
          <button
            onClick={fetchCustomerAnalysis}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-[13px] sm:text-[13.5px] font-semibold shadow-2xs transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Users size={20} className="text-emerald-600" />
            <h2 className="text-[16px] font-bold text-slate-900">Customer Sales Performance</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] sm:text-[14px]">
            <thead className="border-b border-slate-100 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2.5 w-8">#</th>
                <th className="pb-2.5">Customer Code</th>
                <th className="pb-2.5">Customer Name</th>
                <th className="pb-2.5 text-center">Invoices</th>
                <th className="pb-2.5 text-right">Net Sales</th>
                <th className="pb-2.5 pl-4 w-36">% of Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">Loading customer analysis...</td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3 text-[12px] text-slate-400">{c.rank || idx + 1}</td>
                    <td className="py-3 font-mono text-[12px] font-semibold text-slate-600">{c.customerCode}</td>
                    <td className="py-3 font-bold text-slate-900">{c.customerName}</td>
                    <td className="py-3 text-center text-slate-600">{c.invoices}</td>
                    <td className="py-3 text-right font-bold text-slate-900">₹{Number(c.netSales).toLocaleString('en-IN')}</td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-slate-600 w-11">{c.percentage}%</span>
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div style={{ width: `${Math.min(100, c.percentage)}%` }} className="bg-emerald-600 h-full rounded-full" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">No customer records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default CustomerAnalysisPage;
