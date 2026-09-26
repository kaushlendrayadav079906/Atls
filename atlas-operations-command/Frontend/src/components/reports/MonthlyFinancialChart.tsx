import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { MonthlyRevenueExpenditure } from '../../types';

interface MonthlyFinancialChartProps {
  data: MonthlyRevenueExpenditure[];
  selectedYear: number;
  selectedMonth: number;
  currencySymbol?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MonthlyFinancialChart: React.FC<MonthlyFinancialChartProps> = ({
  data,
  selectedYear,
  selectedMonth,
  currencySymbol = '$',
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading financial telemetry..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '380px' }}>
        <ErrorState title="Financial Reporting Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  const hasData = data && data.length > 0 && data.some((d) => Number(d.revenue) > 0 || Number(d.expenditure) > 0);

  if (!hasData) {
    return (
      <div className="card" style={{ minHeight: '380px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BarChart3 size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Monthly Revenue vs Expenditure</h3>
        </div>
        <EmptyState
          title="No Financial Records Found"
          message={`No revenue or expenditure transactions recorded for ${selectedMonth === 0 ? `year ${selectedYear}` : `${FULL_MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}.`}
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
    if (isNaN(num)) return `${currencySymbol}0.00`;
    return `${currencySymbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalRevenue = data.reduce((acc, d) => acc + Number(d.revenue || 0), 0);
  const totalExpenditure = data.reduce((acc, d) => acc + Number(d.expenditure || 0), 0);
  const totalProfit = data.reduce((acc, d) => acc + Number(d.profit || 0), 0);
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            Monthly Revenue vs Expenditure
          </h3>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            {selectedMonth === 0 ? `Annual ${selectedYear}` : `${FULL_MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
          </span>
        </div>

        {/* Legend */}
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
            <span style={{ color: 'var(--text-secondary)' }}>Net Profit</span>
          </div>
        </div>
      </div>

      {/* Visual Bar Chart */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          paddingTop: '24px',
          paddingBottom: '12px',
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
                    maxWidth: '28px',
                    height: `${revHeight}px`,
                    background: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
                {/* Expenditure Bar */}
                <div
                  style={{
                    width: '40%',
                    maxWidth: '28px',
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

      {/* Summary KPI Highlights */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa', marginBottom: '4px' }}>
            <DollarSign size={15} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Period Revenue</span>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatAmount(totalRevenue)}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', marginBottom: '4px' }}>
            <DollarSign size={15} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Period Expenditure</span>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatAmount(totalExpenditure)}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: totalProfit >= 0 ? '#34d399' : '#f87171', marginBottom: '4px' }}>
            {totalProfit >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Net Operating Profit</span>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: totalProfit >= 0 ? '#34d399' : '#f87171' }}>
            {formatAmount(totalProfit)}
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}>
              ({profitMargin}%)
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown Tabular View */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Period</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Revenue</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Expenditure</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Net Profit</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const rRev = Number(row.revenue || 0);
              const rExp = Number(row.expenditure || 0);
              const rProf = Number(row.profit || 0);
              const margin = rRev > 0 ? ((rProf / rRev) * 100).toFixed(1) : '0.0';
              const monthLabel = FULL_MONTH_NAMES[(row.month - 1) % 12] || `Month ${row.month}`;

              return (
                <tr
                  key={`${row.year}-${row.month}-${idx}`}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {monthLabel} {row.year}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#60a5fa' }}>
                    {formatAmount(rRev)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fbbf24' }}>
                    {formatAmount(rExp)}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: rProf >= 0 ? '#34d399' : '#f87171',
                    }}
                  >
                    {formatAmount(rProf)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {margin}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
