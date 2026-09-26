import React, { useState } from 'react';
import { Calendar, Search, ShieldCheck } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { localizationService } from '../../services/localizationService';
import type { FiscalYearInfo } from '../../types';

interface FiscalYearCardProps {
  fiscalYear: FiscalYearInfo | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const FiscalYearCard: React.FC<FiscalYearCardProps> = ({
  fiscalYear,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [lookupDate, setLookupDate] = useState<string>('');
  const [lookupResult, setLookupResult] = useState<FiscalYearInfo | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Calculating fiscal year calendar information..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '260px' }}>
        <ErrorState title="Fiscal Year Calendar Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!fiscalYear) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupDate) return;

    setIsLookingUp(true);
    setLookupError(null);

    try {
      const res = await localizationService.getFiscalYearForDate(lookupDate);
      setLookupResult(res);
    } catch (err: any) {
      setLookupError(err.message || 'Failed to lookup fiscal period for target date.');
      setLookupResult(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const activeFy = lookupResult || fiscalYear;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            Fiscal Calendar & Accounting Period
          </h3>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <ShieldCheck size={14} color="#3b82f6" />
          <span>
            Active: <strong style={{ color: 'var(--text-primary)' }}>{fiscalYear.fiscal_year_label}</strong> ({fiscalYear.fiscal_quarter_label})
          </span>
        </div>
      </div>

      {/* Date Ranges Highlights */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
            Fiscal Year Range
          </span>
          <strong style={{ fontSize: '0.95rem', color: '#60a5fa' }}>
            {activeFy.fiscal_year_start_date} → {activeFy.fiscal_year_end_date}
          </strong>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
            Quarter Range ({activeFy.fiscal_quarter_label})
          </span>
          <strong style={{ fontSize: '0.95rem', color: '#fbbf24' }}>
            {activeFy.quarter_start_date} → {activeFy.quarter_end_date}
          </strong>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
            Fiscal Period / Month
          </span>
          <strong style={{ fontSize: '0.95rem', color: '#34d399' }}>
            Period {activeFy.fiscal_period} (Starts Month {activeFy.fiscal_year_start_month})
          </strong>
        </div>
      </div>

      {/* Target Date Lookup */}
      <form
        onSubmit={handleLookup}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Lookup Date Period:
        </span>
        <input
          type="date"
          aria-label="Lookup Date"
          value={lookupDate}
          onChange={(e) => setLookupDate(e.target.value)}
          required
          style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            padding: '6px 10px',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={isLookingUp || !lookupDate}
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
            cursor: isLookingUp ? 'not-allowed' : 'pointer',
          }}
        >
          <Search size={14} />
          <span>{isLookingUp ? 'Checking...' : 'Check Period'}</span>
        </button>

        {lookupResult && (
          <button
            type="button"
            onClick={() => {
              setLookupResult(null);
              setLookupDate('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset to Current
          </button>
        )}
      </form>

      {lookupError && (
        <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{lookupError}</span>
      )}
    </div>
  );
};
