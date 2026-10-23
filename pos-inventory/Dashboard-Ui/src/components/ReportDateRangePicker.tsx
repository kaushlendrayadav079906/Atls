import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import {
  resolveDashboardDateRange,
  validateCustomDateRange,
  getDateScopeLabel,
  type QuickFilter,
  type AuthoritativeDateFilterState,
} from '../utils/date';

export interface ReportDateRangePickerProps {
  quickFilter: QuickFilter;
  dateFrom: string;
  dateTo: string;
  onRangeChange: (state: AuthoritativeDateFilterState) => void;
  className?: string;
}

export const ReportDateRangePicker: React.FC<ReportDateRangePickerProps> = ({
  quickFilter,
  dateFrom,
  dateTo,
  onRangeChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);
  const [customError, setCustomError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomFrom(dateFrom);
    setCustomTo(dateTo);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleQuickFilter = (filter: QuickFilter) => {
    setCustomError(null);
    const resolved = resolveDashboardDateRange(filter);
    if (!filter) {
      setCustomFrom('');
      setCustomTo('');
    } else {
      setCustomFrom(resolved.dateFrom);
      setCustomTo(resolved.dateTo);
    }
    setIsOpen(false);
    onRangeChange(resolved);
  };

  const handleApplyCustom = () => {
    const validation = validateCustomDateRange(customFrom, customTo);
    if (!validation.isValid) {
      setCustomError(validation.error || 'Invalid date range');
      return;
    }
    setCustomError(null);
    const resolved = resolveDashboardDateRange('custom', customFrom, customTo);
    setIsOpen(false);
    onRangeChange(resolved);
  };

  return (
    <div className={`relative date-dropdown-container ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2.5 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors font-semibold text-[13.5px] shadow-2xs cursor-pointer"
      >
        <Calendar className="w-4 h-4 text-slate-500" />
        <span>{getDateScopeLabel(quickFilter, dateFrom, dateTo)}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 sm:w-72 bg-white border border-slate-200 shadow-xl rounded-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={() => handleQuickFilter('')}
            className={`w-full text-left px-4 py-2 text-[13.5px] transition-colors cursor-pointer flex items-center justify-between ${
              quickFilter === ''
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-700 hover:bg-slate-50 font-medium'
            }`}
          >
            <span>All Dates (Total)</span>
            {quickFilter === '' && <Check className="w-4 h-4 text-blue-600" />}
          </button>

          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50">
            Quick Filters
          </div>

          {(['today', 'week', 'month', 'year'] as const).map((f) => {
            const label = f === 'today' ? 'Today' : `This ${f.charAt(0).toUpperCase() + f.slice(1)}`;
            const isSelected = quickFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => handleQuickFilter(f)}
                className={`w-full text-left px-4 py-2 text-[13.5px] transition-colors cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 font-medium'
                }`}
              >
                <span>{label}</span>
                {isSelected && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            );
          })}

          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50 mt-1">
            Custom Range
          </div>

          <div className="p-3 flex flex-col gap-2">
            <div>
              <label className="text-[11.5px] font-semibold text-slate-600 mb-1 block">From</label>
              <input
                type="date"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc]"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  if (customError) setCustomError(null);
                }}
              />
            </div>
            <div>
              <label className="text-[11.5px] font-semibold text-slate-600 mb-1 block">To</label>
              <input
                type="date"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc]"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  if (customError) setCustomError(null);
                }}
              />
            </div>
            {customError && (
              <p className="text-[11px] text-rose-600 font-medium">{customError}</p>
            )}
            <button
              type="button"
              disabled={!customFrom || !customTo || customFrom > customTo}
              onClick={handleApplyCustom}
              className="w-full mt-2 py-2 bg-[#0052cc] hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-sm"
            >
              Apply Custom
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
