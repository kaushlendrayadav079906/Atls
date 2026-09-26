import React from 'react';
import { ShoppingBag, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { TopCustomer, SalesByProduct } from '../../types';

interface SalesProductCardProps {
  topCustomers: TopCustomer[];
  salesByProduct: SalesByProduct[];
  currencySymbol?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const SalesProductCard: React.FC<SalesProductCardProps> = ({
  topCustomers,
  salesByProduct,
  currencySymbol = '$',
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading sales & customer telemetry..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <ErrorState title="Sales Performance Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  const hasData = topCustomers.length > 0 || salesByProduct.length > 0;

  if (!hasData) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ShoppingBag size={20} color="#ec4899" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Sales & Product Performance</h3>
        </div>
        <EmptyState
          title="No Sales Data"
          message="Customer and product order transactions have not been ingested."
          actionLabel="View Reports"
          onAction={() => navigate('/reports')}
        />
      </div>
    );
  }

  const formatAmount = (val: number | string) => {
    const num = Number(val);
    if (num >= 1000000) return `${currencySymbol}${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${currencySymbol}${(num / 1000).toFixed(0)}k`;
    return `${currencySymbol}${num.toFixed(0)}`;
  };

  return (
    <div className="card" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingBag size={20} color="#ec4899" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Commercial & Product Sales
          </h3>
        </div>
        <button
          onClick={() => navigate('/reports')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reports →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        {/* Top Customers */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <Users size={16} color="#06b6d4" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Top Enterprise Clients
            </span>
          </div>
          {topCustomers.length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No customer records</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topCustomers.slice(0, 4).map((c, i) => (
                <div
                  key={c.customer_id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.customer_name}</span>
                  <strong style={{ color: '#06b6d4' }}>{formatAmount(c.total_revenue)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <ShoppingBag size={16} color="#ec4899" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Top Revenue Products
            </span>
          </div>
          {salesByProduct.length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No product records</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {salesByProduct.slice(0, 4).map((p, i) => (
                <div
                  key={p.product_id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.product_name}</span>
                  <strong style={{ color: '#ec4899' }}>{formatAmount(p.total_sales)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
