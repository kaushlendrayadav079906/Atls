import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { SalesByProduct } from '../../types';

interface SalesByProductTableProps {
  products: SalesByProduct[];
  currencySymbol?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const SalesByProductTable: React.FC<SalesByProductTableProps> = ({
  products,
  currencySymbol = '$',
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading product sales analytics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <ErrorState title="Product Sales Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ShoppingBag size={20} color="#ec4899" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Sales by Product</h3>
        </div>
        <EmptyState
          title="No Product Sales Records"
          message="No commercial sales transactions recorded across manufactured product lines."
        />
      </div>
    );
  }

  const totalProductSales = products.reduce((acc, p) => acc + Number(p.total_sales || 0), 0);
  const maxSales = Math.max(...products.map((p) => Number(p.total_sales || 0)), 1);

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
          <ShoppingBag size={20} color="#ec4899" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Sales by Product
          </h3>
        </div>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            background: 'rgba(236, 72, 153, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            border: '1px solid rgba(236, 72, 153, 0.2)',
          }}
        >
          {products.length} Products Cataloged
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', width: '48px' }}>Rank</th>
              <th style={{ padding: '8px 12px' }}>Product Line</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Sales</th>
              <th style={{ padding: '8px 12px', width: '140px' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, index) => {
              const sales = Number(p.total_sales || 0);
              const pct = totalProductSales > 0 ? ((sales / totalProductSales) * 100).toFixed(1) : '0.0';
              const barWidth = Math.max(Math.round((sales / maxSales) * 100), 5);

              return (
                <tr
                  key={p.product_id || `prod-${index}`}
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
                            ? 'rgba(236, 72, 153, 0.2)'
                            : index === 1
                            ? 'rgba(168, 85, 247, 0.2)'
                            : index === 2
                            ? 'rgba(99, 102, 241, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)',
                        color:
                          index === 0
                            ? '#ec4899'
                            : index === 1
                            ? '#c084fc'
                            : index === 2
                            ? '#818cf8'
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
                      {p.product_name}
                    </div>
                    {p.product_id && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        SKU: {p.product_id}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#ec4899' }}>
                    {formatAmount(sales)}
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
                            background: 'linear-gradient(90deg, #ec4899 0%, #a855f7 100%)',
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
          Top Products Aggregate Sales:
        </span>
        <strong style={{ color: '#ec4899', fontSize: '0.95rem' }}>
          {formatAmount(totalProductSales)}
        </strong>
      </div>
    </div>
  );
};
