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
            <h1 className="text-[22px] font-black text-slate-900">Customer Analysis</h1>
            <p className="text-[12px] text-slate-500">Revenue concentration, purchase frequency, and billing distribution.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/customers"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-[11.5px] font-semibold text-slate-700 shadow-2xs transition"
          >
            <Users size={13} />
            <span>Manage Customers</span>
          </Link>
          <button
            onClick={fetchCustomerAnalysis}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-[11.5px] font-semibold shadow-2xs transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            <h2 className="text-[14px] font-bold text-slate-800">Customer Sales Performance</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-slate-100 text-[10.5px] font-semibold text-slate-400">
              <tr>
                <th className="pb-2 w-8">#</th>
                <th className="pb-2">Customer Code</th>
                <th className="pb-2">Customer Name</th>
                <th className="pb-2 text-center">Invoices</th>
                <th className="pb-2 text-right">Net Sales</th>
                <th className="pb-2 pl-4 w-32">% of Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Loading customer analysis...</td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 text-slate-400">{c.rank || idx + 1}</td>
                    <td className="py-2.5 font-mono text-[11px] text-slate-500">{c.customerCode}</td>
                    <td className="py-2.5 font-bold text-slate-900">{c.customerName}</td>
                    <td className="py-2.5 text-center text-slate-600">{c.invoices}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">₹{Number(c.netSales).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] font-medium text-slate-500 w-10">{c.percentage}%</span>
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div style={{ width: `${Math.min(100, c.percentage)}%` }} className="bg-emerald-600 h-full rounded-full" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No customer records found.</td>
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
