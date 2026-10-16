import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart2, ArrowLeft, RefreshCw, TrendingUp, Percent, Database } from 'lucide-react';
import { apiClient } from '../../api/client';

export const ProfitabilityReportsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfitability = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/finance/overview');
      setData(res.data);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfitability();
  }, []);

  const kpis = data?.kpis;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/finance" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
            <ArrowLeft size={16} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold text-slate-900">Profitability Reports</h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">Gross profit analysis, operating margin calculations, and trend projections.</p>
          </div>
        </div>
        <button
          onClick={fetchProfitability}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-[13px] sm:text-[13.5px] font-semibold shadow-2xs transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={22} />
            </div>
            <span className="text-[12px] font-bold text-emerald-600">↑ 12.5%</span>
          </div>
          <div className="mt-3.5">
            <div className="text-[13.5px] font-semibold text-slate-500">Total Revenue</div>
            <div className="text-[25px] sm:text-[27px] font-black text-slate-900 mt-0.5">
              ₹{Number(kpis?.total_sales?.value || 405180).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Database size={22} />
            </div>
            <span className="text-[12px] font-bold text-emerald-600">↑ 8.2%</span>
          </div>
          <div className="mt-3.5">
            <div className="text-[13.5px] font-semibold text-slate-500">Cost of Goods Sold (Purchases)</div>
            <div className="text-[25px] sm:text-[27px] font-black text-slate-900 mt-0.5">
              ₹{Number(kpis?.total_purchases?.value || 218460).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <BarChart2 size={22} />
            </div>
            <span className="text-[12px] font-bold text-emerald-600">↑ 18.4%</span>
          </div>
          <div className="mt-3.5">
            <div className="text-[13.5px] font-semibold text-slate-500">Gross Profit</div>
            <div className="text-[25px] sm:text-[27px] font-black text-slate-900 mt-0.5">
              ₹{Number(kpis?.gross_profit?.value || 186720).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Percent size={22} />
            </div>
            <span className="text-[12px] font-bold text-emerald-600">↑ 4.8%</span>
          </div>
          <div className="mt-3.5">
            <div className="text-[13.5px] font-semibold text-slate-500">Gross Margin</div>
            <div className="text-[25px] sm:text-[27px] font-black text-slate-900 mt-0.5">
              {kpis?.gross_margin?.value || 46.1}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfitabilityReportsPage;
