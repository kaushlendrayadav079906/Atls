import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Clock, ShieldAlert } from 'lucide-react';

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/reports')}
        className="inline-flex items-center gap-2 text-[13.5px] sm:text-[14px] font-semibold text-slate-600 hover:text-blue-600 transition cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Back to Reports Hub</span>
      </button>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-xs text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-100 text-blue-600 shadow-2xs">
          {isAI ? <Sparkles size={32} className="animate-pulse text-indigo-600" /> : <Clock size={32} className="text-blue-600" />}
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[12px] sm:text-[12.5px] font-bold">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
            <span>Module In Progress</span>
          </div>
          <h1 className="text-[26px] sm:text-[28px] font-bold text-slate-900 tracking-tight">{title}</h1>
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
  );
};

export default ReportPlaceholderPage;
