import React from 'react';
import { Filter, Calendar, Users, RefreshCw } from 'lucide-react';

interface ReportFiltersProps {
  selectedYear: number;
  selectedMonth: number;
  availableYears: number[];
  topLimit: number;
  isLoading?: boolean;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onLimitChange: (limit: number) => void;
  onRefresh: () => void;
}

const MONTH_OPTIONS = [
  { value: 0, label: 'All Months (Annual Trend)' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const LIMIT_OPTIONS = [5, 10, 20, 50];

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  selectedYear,
  selectedMonth,
  availableYears,
  topLimit,
  isLoading = false,
  onYearChange,
  onMonthChange,
  onLimitChange,
  onRefresh,
}) => {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '16px 20px',
      }}
    >
      {/* Title & Filter Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Filter size={18} color="var(--primary)" />
        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Report Parameters
        </span>
      </div>

      {/* Selectors Group */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Year Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={15} color="var(--text-muted)" />
          <label htmlFor="report-year-select" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Year:
          </label>
          <select
            id="report-year-select"
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            disabled={isLoading}
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor="report-month-select" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Period:
          </label>
          <select
            id="report-month-select"
            value={selectedMonth}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            disabled={isLoading}
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Top N Limit Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={15} color="var(--text-muted)" />
          <label htmlFor="report-limit-select" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Ranking Limit:
          </label>
          <select
            id="report-limit-select"
            value={topLimit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            disabled={isLoading}
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {LIMIT_OPTIONS.map((lim) => (
              <option key={lim} value={lim}>
                Top {lim}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh Report Data"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            padding: '6px 12px',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            transition: 'background 0.2s ease',
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
};
