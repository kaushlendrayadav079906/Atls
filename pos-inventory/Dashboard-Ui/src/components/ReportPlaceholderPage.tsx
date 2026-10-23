import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Clock, ShieldAlert, FileText } from 'lucide-react';
import { ReportDateRangePicker } from './ReportDateRangePicker';
import {
  type QuickFilter,
  type DashboardPeriod,
  type AuthoritativeDateFilterState,
} from '../utils/date';

interface ReportPlaceholderPageProps {
  title: string;
  description: string;
  isAI?: boolean;
}

export const ReportPlaceholderPage: React.FC<ReportPlaceholderPageProps> = ({
  title,
  description,
  isAI = false,
}) => {
  const navigate = useNavigate();
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [, setDateRange] = useState<DashboardPeriod>('all_time');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleDateRangeChange = (filterState: AuthoritativeDateFilterState) => {
    setQuickFilter(filterState.quickFilter);
    setDateRange(filterState.period);
    setDateFrom(filterState.dateFrom);
    setDateTo(filterState.dateTo);
  };

  return (
    <div className="space-y-6">
      {/* ── Standard Page Header with Top Right Date Range ───────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-xs">
            {isAI ? <Sparkles className="h-6 w-6 text-indigo-600" /> : <FileText className="h-6 w-6 text-blue-600" />}
          </div>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1 atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">
              {description}
            </p>
          </div>
        </div>

        {/* Top Position Right Side Controls */}
        <div className="flex items-center gap-2.5">
          <ReportDateRangePicker
            quickFilter={quickFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRangeChange={handleDateRangeChange}
          />
          <button
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2 px-3.5 py-2.5 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors font-semibold text-[13.5px] shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Reports Hub</span>
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="max-w-4xl mx-auto pt-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-xs text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-100 text-blue-600 shadow-2xs">
            {isAI ? <Sparkles size={32} className="animate-pulse text-indigo-600" /> : <Clock size={32} className="text-blue-600" />}
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[12px] sm:text-[12.5px] font-bold">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
              <span>Module In Progress</span>
            </div>
            <h2 className="text-[24px] sm:text-[26px] font-bold text-slate-900 tracking-tight">{title}</h2>
            <p className="text-[14.5px] sm:text-[15px] font-medium text-slate-500 leading-relaxed">
              {description}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-lg mx-auto text-left text-[13.5px] text-slate-600 flex items-start gap-3">
            <ShieldAlert size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-slate-800">Production Notice:</span> This dedicated view is currently in active configuration to ensure authorized SAP schema compatibility. In the meantime, you can generate reports via the main Report Builder or ask ATLAS AI.
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/reports')}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13.5px] sm:text-[14px] font-bold transition cursor-pointer"
            >
              Open Reports Hub
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('atls-toggle-ai', { detail: { open: true } }))}
              className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[13.5px] sm:text-[14px] font-bold shadow-xs transition cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Ask ATLAS AI Assistant</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPlaceholderPage;
