import React from 'react';
import { Users } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { TopCustomer } from '../../types';

interface TopCustomersTableProps {
  customers: TopCustomer[];
  currencySymbol?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const TopCustomersTable: React.FC<TopCustomersTableProps> = ({
  customers,
  currencySymbol = '$',
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading top customer rankings..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <ErrorState title="Top Customers Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Users size={20} color="#06b6d4" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Top Enterprise Customers</h3>
        </div>
        <EmptyState
          title="No Customer Records Found"
          message="No commercial customer revenue has been recorded in the current period."
        />
      </div>
    );
  }

  const totalCustomerRevenue = customers.reduce((acc, c) => acc + Number(c.total_revenue || 0), 0);
  const maxRevenue = Math.max(...customers.map((c) => Number(c.total_revenue || 0)), 1);

  const formatAmount = (val: number | string) => {
    const num = Number(val);
    if (isNaN(num)) return `${currencySymbol}0.00`;
    return `${currencySymbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="card" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} color="#06b6d4" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Top Enterprise Customers
          </h3>
        </div>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            background: 'rgba(6, 182, 212, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            border: '1px solid rgba(6, 182, 212, 0.2)',
          }}
        >
          {customers.length} Ranked Clients
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', width: '48px' }}>Rank</th>
              <th style={{ padding: '8px 12px' }}>Customer Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Revenue</th>
              <th style={{ padding: '8px 12px', width: '140px' }}>Contribution</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, index) => {
              const rev = Number(c.total_revenue || 0);
              const pct = totalCustomerRevenue > 0 ? ((rev / totalCustomerRevenue) * 100).toFixed(1) : '0.0';
              const barWidth = Math.max(Math.round((rev / maxRevenue) * 100), 5);

              return (
                <tr
                  key={c.customer_id || `cust-${index}`}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background:
                          index === 0
                            ? 'rgba(234, 179, 8, 0.2)'
                            : index === 1
                            ? 'rgba(148, 163, 184, 0.2)'
                            : index === 2
                            ? 'rgba(180, 83, 9, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)',
                        color:
                          index === 0
                            ? '#facc15'
                            : index === 1
                            ? '#cbd5e1'
                            : index === 2
                            ? '#d97706'
                            : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}
                    >
                      {index + 1}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {c.customer_name}
                    </div>
                    {c.customer_id && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ID: {c.customer_id}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#06b6d4' }}>
                    {formatAmount(rev)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {pct}%
                      </div>
                      <div
                        style={{
                          height: '4px',
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${barWidth}%`,
                            background: 'linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)',
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Total */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '6px',
          fontSize: '0.85rem',
        }}
      >
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
          Top Clients Aggregate Revenue:
        </span>
        <strong style={{ color: '#06b6d4', fontSize: '0.95rem' }}>
          {formatAmount(totalCustomerRevenue)}
        </strong>
      </div>
    </div>
  );
};
