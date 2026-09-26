import React, { useState } from 'react';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';
import { currencyService } from '../../services/currencyService';
import { formatCurrency } from '../../utils/currency';
import type { CurrencyConvertResponsePayload } from '../../types';

interface CurrencyConverterProps {
  baseCurrency?: string;
}

export const CurrencyConverter: React.FC<CurrencyConverterProps> = ({
  baseCurrency = 'USD',
}) => {
  const [amount, setAmount] = useState<string>('1000.00');
  const [fromCurrency, setFromCurrency] = useState<string>(baseCurrency);
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [targetDate, setTargetDate] = useState<string>('');

  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<CurrencyConvertResponsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive monetary amount.');
      return;
    }

    if (!fromCurrency || fromCurrency.length !== 3 || !toCurrency || toCurrency.length !== 3) {
      setError('Currency codes must be exactly 3 uppercase letters (ISO 4217).');
      return;
    }

    setIsConverting(true);

    try {
      const res = await currencyService.convertCurrency({
        amount: numAmount,
        from_currency: fromCurrency.toUpperCase(),
        to_currency: toCurrency.toUpperCase(),
        target_date: targetDate || null,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Currency conversion failed. Exchange rate unavailable.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setResult(null);
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ArrowRightLeft size={20} color="#06b6d4" />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
          Deterministic Currency Converter
        </h3>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
        Convert monetary transactions using company-specific and global exchange rate tables.
      </p>

      {/* Form */}
      <form onSubmit={handleConvert} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            alignItems: 'flex-end',
          }}
        >
          {/* Amount */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="1000.00"
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          {/* From Currency */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              From (Code)
            </label>
            <input
              type="text"
              maxLength={3}
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value.toUpperCase())}
              required
              placeholder="USD"
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: '0.9rem',
                outline: 'none',
                textTransform: 'uppercase',
              }}
            />
          </div>

          {/* Swap Button */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={handleSwap}
              title="Swap Currencies"
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              <ArrowRightLeft size={16} />
            </button>
          </div>

          {/* To Currency */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              To (Code)
            </label>
            <input
              type="text"
              maxLength={3}
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value.toUpperCase())}
              required
              placeholder="EUR"
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: '0.9rem',
                outline: 'none',
                textTransform: 'uppercase',
              }}
            />
          </div>

          {/* Target Date (Optional) */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Target Date (Optional)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Convert Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isConverting}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '9px 16px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: isConverting ? 'not-allowed' : 'pointer',
              }}
            >
              {isConverting ? 'Converting...' : 'Convert'}
            </button>
          </div>
        </div>
      </form>

      {/* Error Notice */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.85rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Conversion Result ({result.target_date})
            </span>
            <span style={{ fontSize: '0.8rem', color: '#06b6d4', fontWeight: 600 }}>
              Applied Rate: 1 {result.from_currency} = {result.exchange_rate} {result.to_currency}
            </span>
          </div>

          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>
            {formatCurrency(result.converted_amount, { currencyCode: result.to_currency })}
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
              (from {formatCurrency(result.original_amount, { currencyCode: result.from_currency })})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
