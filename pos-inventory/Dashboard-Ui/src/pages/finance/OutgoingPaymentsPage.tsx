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
            <h1 className="text-[22px] font-black text-slate-900">Outgoing Payments</h1>
            <p className="text-[12px] text-slate-500">Vendor settlements, accounts payable disbursements, and expense payments.</p>
          </div>
        </div>
        <button
          onClick={fetchPayments}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-[11.5px] font-semibold shadow-2xs transition"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <ArrowUpFromLine size={18} className="text-amber-600" />
          <h2 className="text-[14px] font-bold text-slate-800">Recent Supplier Disbursements</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-slate-100 text-[10.5px] font-semibold text-slate-400">
              <tr>
                <th className="pb-2">Payment Ref.</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Supplier</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">Loading outgoing payments...</td>
                </tr>
              ) : payments.length > 0 ? (
                payments.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 font-mono text-[11px] font-semibold text-amber-600">{p.refNo}</td>
                    <td className="py-2.5 text-slate-500">{p.date}</td>
                    <td className="py-2.5 font-semibold text-slate-800">{p.supplier}</td>
                    <td className="py-2.5">
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">
                        {p.status || 'Completed'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">No outgoing payments recorded in this period.</td>
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
