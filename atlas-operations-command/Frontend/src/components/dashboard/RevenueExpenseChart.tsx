import React from 'react';
import { BarChart3 } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { MonthlyRevenueExpenditure } from '../../types';

interface RevenueExpenseChartProps {
  data: MonthlyRevenueExpenditure[];
  currencySymbol?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const RevenueExpenseChart: React.FC<RevenueExpenseChartProps> = ({
  data,
  currencySymbol = '$',
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading financial trajectory..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <ErrorState title="Revenue & Expense Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  const validData = data.filter((d) => Number(d.revenue) > 0 || Number(d.expenditure) > 0);

  if (!data || data.length === 0 || validData.length === 0) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BarChart3 size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Monthly Revenue vs Expenditure</h3>
        </div>
        <EmptyState
          title="No Monthly Financials"
          message="No transaction telemetry available for the current fiscal periods."
        />
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(Number(d.revenue || 0), Number(d.expenditure || 0))),
    1
  );

  const formatAmount = (val: number | string) => {
    const num = Number(val);
    if (num >= 1000000) return `${currencySymbol}${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${currencySymbol}${(num / 1000).toFixed(0)}k`;
    return `${currencySymbol}${num.toFixed(0)}`;
  };

  return (
    <div className="card" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Monthly Revenue vs Expenditure
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Revenue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Expenditure</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Net Margin</span>
          </div>
        </div>
      </div>

      {/* Chart Bars */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          paddingTop: '20px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border-subtle)',
          minHeight: '200px',
        }}
      >
        {data.map((item, idx) => {
          const rev = Number(item.revenue || 0);
          const exp = Number(item.expenditure || 0);
          const profit = Number(item.profit || 0);
          const revHeight = Math.max(Math.round((rev / maxVal) * 160), 4);
          const expHeight = Math.max(Math.round((exp / maxVal) * 160), 4);

          const monthLabel = MONTH_NAMES[(item.month - 1) % 12] || `M${item.month}`;

          return (
            <div
              key={`${item.year}-${item.month}-${idx}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
              title={`${monthLabel} ${item.year}: Revenue ${formatAmount(rev)}, Expenditure ${formatAmount(exp)}, Profit ${formatAmount(profit)}`}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '4px',
                  width: '100%',
                  height: '160px',
                }}
              >
                {/* Revenue Bar */}
                <div
                  style={{
                    width: '40%',
                    maxWidth: '24px',
                    height: `${revHeight}px`,
                    background: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
                {/* Expense Bar */}
                <div
                  style={{
                    width: '40%',
                    maxWidth: '24px',
                    height: `${expHeight}px`,
                    background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {monthLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginTop: '16px',
          textAlign: 'center',
          fontSize: '0.85rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Total Period Revenue</span>
          <strong style={{ color: '#60a5fa' }}>
            {formatAmount(data.reduce((acc, d) => acc + Number(d.revenue || 0), 0))}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Total Period Expenditure</span>
          <strong style={{ color: '#fbbf24' }}>
            {formatAmount(data.reduce((acc, d) => acc + Number(d.expenditure || 0), 0))}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Net Operating Profit</span>
          <strong style={{ color: '#34d399' }}>
            {formatAmount(data.reduce((acc, d) => acc + Number(d.profit || 0), 0))}
          </strong>
        </div>
      </div>
    </div>
  );
};
