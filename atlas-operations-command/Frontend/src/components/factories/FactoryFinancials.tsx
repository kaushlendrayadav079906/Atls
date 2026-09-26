import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { FactoryFinancials } from '../../types';

interface FactoryFinancialsProps {
  financials: FactoryFinancials | null;
  currencySymbol?: string;
  isLoading?: boolean;
  error?: string | null;
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onRetry?: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const FactoryFinancialsCard: React.FC<FactoryFinancialsProps> = ({
  financials,
  currencySymbol = '$',
  isLoading = false,
  error = null,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  onRetry,
}) => {
  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return `${currencySymbol}${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="card" data-testid="factory-financials-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header with Year / Month Selectors */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Factory Financial Performance
          </h3>
        </div>

        {/* Period Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="input-field"
            style={{ width: '130px', height: '36px', padding: '0 8px', fontSize: '0.85rem' }}
            disabled={isLoading}
            aria-label="Select Period Month"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="input-field"
            style={{ width: '90px', height: '36px', padding: '0 8px', fontSize: '0.85rem' }}
            disabled={isLoading}
            aria-label="Select Period Year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ padding: '36px 0', display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner message="Retrieving factory financial telemetry..." />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <ErrorState
          title="Financial Telemetry Error"
          message={error}
          onRetry={onRetry}
        />
      )}

      {/* Empty State: Check if revenue, expenditure, and profit are all 0 or empty */}
      {!isLoading && !error && (!financials || (Number(financials.revenue) === 0 && Number(financials.expenditure) === 0)) && (
        <EmptyState
          icon={<Layers size={40} />}
          title="No Financial Telemetry"
          message="No financial data available for this factory."
        />
      )}

      {/* Financial Metrics Row */}
      {!isLoading && !error && financials && (Number(financials.revenue) > 0 || Number(financials.expenditure) > 0) && (
        <div data-testid="financial-metrics-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            {/* Period Revenue */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px' }}>
                <TrendingUp size={14} color="#60a5fa" />
                <span>Period Revenue</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa' }}>
                {formatCurrency(financials.revenue)}
              </div>
            </div>

            {/* Period Expenditure */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px' }}>
                <TrendingDown size={14} color="#fbbf24" />
                <span>Period Expenditure</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24' }}>
                {formatCurrency(financials.expenditure)}
              </div>
            </div>

            {/* Net Operating Profit */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: Number(financials.profit) >= 0 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                border: Number(financials.profit) >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px' }}>
                <DollarSign size={14} color={Number(financials.profit) >= 0 ? '#34d399' : '#f87171'} />
                <span>Net Operating Profit</span>
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: Number(financials.profit) >= 0 ? '#34d399' : '#f87171',
                }}
              >
                {formatCurrency(financials.profit)}
              </div>
            </div>
          </div>

          {/* Period Description */}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
            Period: {MONTH_NAMES[selectedMonth - 1]} {selectedYear} • Factory: {financials.factory_name}
          </div>
        </div>
      )}
    </div>
  );
};
