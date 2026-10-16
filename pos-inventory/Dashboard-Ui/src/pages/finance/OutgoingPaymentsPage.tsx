import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpFromLine, ArrowLeft, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';


export const OutgoingPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/finance/overview');
      setPayments(res.data?.tables?.recent_payments?.outgoing || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/finance" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
            <ArrowLeft size={16} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold text-slate-900">Outgoing Payments</h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">Vendor settlements, accounts payable disbursements, and expense payments.</p>
          </div>
        </div>
        <button
          onClick={fetchPayments}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-[13px] sm:text-[13.5px] font-semibold shadow-2xs transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4 pb-2.5 border-b border-slate-100">
          <ArrowUpFromLine size={20} className="text-amber-600" />
          <h2 className="text-[16px] font-bold text-slate-900">Recent Supplier Disbursements</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] sm:text-[14px]">
            <thead className="border-b border-slate-100 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2.5">Payment Ref.</th>
                <th className="pb-2.5">Date</th>
                <th className="pb-2.5">Supplier</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">Loading outgoing payments...</td>
                </tr>
              ) : payments.length > 0 ? (
                payments.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3 font-mono text-[12px] font-semibold text-amber-600">{p.refNo}</td>
                    <td className="py-3 text-slate-500 text-[12.5px]">{p.date}</td>
                    <td className="py-3 font-semibold text-slate-800">{p.supplier}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        {p.status || 'Completed'}
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">No outgoing payments recorded in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default OutgoingPaymentsPage;
