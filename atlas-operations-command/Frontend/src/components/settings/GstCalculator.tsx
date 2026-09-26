import React, { useState } from 'react';
import {
  Calculator,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  MapPin,
  Percent,
  Receipt,
  Info,
} from 'lucide-react';
import type { TaxCalculationRequestPayload, TaxCalculationResponsePayload } from '../../types';
import { taxService } from '../../services/taxService';
import { formatCurrency } from '../../utils/currency';

interface GstCalculatorProps {
  companyCountry: string;
  companyState: string;
  companyCurrency: string;
  defaultTaxRate?: number | string;
}

export const GstCalculator: React.FC<GstCalculatorProps> = ({
  companyCountry,
  companyState,
  companyCurrency,
  defaultTaxRate = 18,
}) => {
  const isIndia = (companyCountry || 'IN').toUpperCase() === 'IN';

  const [amount, setAmount] = useState<number>(10000);
  const [supplierState, setSupplierState] = useState<string>(companyState || 'MH');
  const [customerState, setCustomerState] = useState<string>('DL');
  const [taxRate, setTaxRate] = useState<number>(Number(defaultTaxRate) || 18);
  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(false);
  const [hsnSacCode, setHsnSacCode] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TaxCalculationResponsePayload | null>(null);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(amount) || amount <= 0) {
      setError('Transaction amount must be a positive number.');
      return;
    }
    if (!supplierState || !customerState) {
      setError('Both Supplier State Code and Customer / Destination State Code are required.');
      return;
    }
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      setError('Applicable tax rate must be between 0% and 100%.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: TaxCalculationRequestPayload = {
        amount,
        supplier_state: supplierState.toUpperCase().trim(),
        customer_state: customerState.toUpperCase().trim(),
        tax_rate: Number(taxRate),
        is_tax_inclusive: isTaxInclusive,
        is_gst: true,
        hsn_sac_code: hsnSacCode.trim() || null,
      };
      const res = await taxService.calculateTax(payload);
      setResult(res);
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('401')) {
        setError('Your session has expired. Please sign in again.');
      } else if (err.status === 403 || err.message?.includes('403')) {
        setError('You do not have permission to perform this operation.');
      } else if (err.status === 422 || err.message?.includes('422')) {
        setError(err.message || 'Validation error: Please verify transaction amount and state codes.');
      } else {
        setError(err.message || 'Unable to calculate GST.');
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const isIntraState = supplierState.trim().toUpperCase() === customerState.trim().toUpperCase();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '34px',
    backgroundColor: '#070d1e',
    border: '1px solid #1a2846',
    borderRadius: '5px',
    color: '#f8fafc',
    padding: '0 10px',
    fontSize: '0.8rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.72rem',
    color: '#94a3b8',
    marginBottom: '4px',
    fontWeight: 500,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Calculator size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
              GST / Tax Calculation
            </h3>
            <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Calculate GST using the backend-authoritative tax engine.
            </p>
          </div>
        </div>

        {/* Country Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '16px',
            backgroundColor: isIndia ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            color: isIndia ? '#34d399' : '#fbbf24',
            border: `1px solid ${isIndia ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            fontSize: '0.72rem',
            fontWeight: 600,
          }}
        >
          <ShieldCheck size={13} />
          <span>Country: {companyCountry || 'IN'}</span>
        </div>
      </div>

      {!isIndia && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontSize: '0.75rem',
          }}
        >
          <Info size={14} />
          <span>Note: Indian GST simulation is designed for India-based operations (Country: IN).</span>
        </div>
      )}

      {/* 2. Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: result ? 'repeat(2, minmax(0, 1fr))' : '1fr',
          gap: '14px',
        }}
      >
        {/* Left: GST Input Card */}
        <div
          style={{
            backgroundColor: '#0c152b',
            border: '1px solid #1a2744',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={14} color="#38bdf8" /> GST Calculation Details
            </h4>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: '#131e3a',
                color: '#94a3b8',
                border: '1px solid #223354',
              }}
            >
              {isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
            </span>
          </div>

          <form onSubmit={handleCalculate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '10px 14px',
              }}
            >
              {/* Transaction Amount */}
              <div>
                <label style={labelStyle}>
                  Transaction Amount ({companyCurrency || 'INR'}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAmount(isNaN(val) ? 0 : val);
                    setError(null);
                  }}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Tax Rate */}
              <div>
                <label style={labelStyle}>
                  Applicable Tax Rate (%) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTaxRate(isNaN(val) ? 0 : val);
                      setError(null);
                    }}
                    style={inputStyle}
                    required
                  />
                  <Percent
                    size={12}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                    }}
                  />
                </div>
              </div>

              {/* Supplier State */}
              <div>
                <label style={labelStyle}>
                  Supplier State Code *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    maxLength={4}
                    value={supplierState}
                    onChange={(e) => {
                      setSupplierState(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    placeholder="MH"
                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                    required
                  />
                  <MapPin
                    size={12}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#38bdf8',
                    }}
                  />
                </div>
              </div>

              {/* Destination State */}
              <div>
                <label style={labelStyle}>
                  Customer / Destination State Code *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    maxLength={4}
                    value={customerState}
                    onChange={(e) => {
                      setCustomerState(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    placeholder="DL"
                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                    required
                  />
                  <MapPin
                    size={12}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#34d399',
                    }}
                  />
                </div>
              </div>

              {/* HSN / SAC Code */}
              <div>
                <label style={labelStyle}>HSN / SAC Code (Optional)</label>
                <input
                  type="text"
                  value={hsnSacCode}
                  onChange={(e) => {
                    setHsnSacCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. 998311"
                  style={inputStyle}
                />
              </div>

              {/* Tax Inclusive Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: '18px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.74rem', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={isTaxInclusive}
                    onChange={(e) => {
                      setIsTaxInclusive(e.target.checked);
                      setError(null);
                    }}
                    style={{ accentColor: '#0284c7', width: '14px', height: '14px' }}
                  />
                  <span>Amount is Tax-Inclusive</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
              <button
                type="submit"
                disabled={loading}
                id="btn-calculate-gst"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '5px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                }}
              >
                {loading ? <RefreshCw size={13} className="animate-spin" /> : <Calculator size={13} />}
                <span>Calculate GST</span>
              </button>
            </div>
          </form>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                fontSize: '0.74rem',
              }}
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right: GST Result Card */}
        {result && (
          <div
            style={{
              backgroundColor: '#0c152b',
              border: '1px solid #059669',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="#34d399" />
                <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                  GST Calculation Result
                </h4>
              </div>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(52, 211, 153, 0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}
              >
                {result.jurisdiction_type || (isIntraState ? 'INTRA_STATE' : 'INTER_STATE')}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '8px',
              }}
            >
              {/* Taxable Amount */}
              <div style={{ backgroundColor: '#070d1e', border: '1px solid #1a2846', borderRadius: '6px', padding: '8px 10px' }}>
                <span style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase' }}>Taxable Amount</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace', marginTop: '2px' }}>
                  {formatCurrency(result.taxable_amount, companyCurrency)}
                </div>
              </div>

              {/* Tax Rate */}
              <div style={{ backgroundColor: '#070d1e', border: '1px solid #1a2846', borderRadius: '6px', padding: '8px 10px' }}>
                <span style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase' }}>Tax Rate</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', marginTop: '2px' }}>
                  {result.tax_rate}%
                </div>
              </div>

              {/* Same-State: CGST & SGST */}
              {Number(result.cgst_amount) > 0 && (
                <div style={{ backgroundColor: '#070d1e', border: '1px solid #1a2846', borderRadius: '6px', padding: '8px 10px' }}>
                  <span style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase' }}>
                    CGST ({result.cgst_rate ?? (Number(result.tax_rate) / 2)}%)
                  </span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', marginTop: '2px' }}>
                    {formatCurrency(result.cgst_amount, companyCurrency)}
                  </div>
                </div>
              )}

              {Number(result.sgst_amount) > 0 && (
                <div style={{ backgroundColor: '#070d1e', border: '1px solid #1a2846', borderRadius: '6px', padding: '8px 10px' }}>
                  <span style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase' }}>
                    SGST ({result.sgst_rate ?? (Number(result.tax_rate) / 2)}%)
                  </span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', marginTop: '2px' }}>
                    {formatCurrency(result.sgst_amount, companyCurrency)}
                  </div>
                </div>
              )}

              {/* Inter-State: IGST */}
              {Number(result.igst_amount) > 0 && (
                <div style={{ backgroundColor: '#070d1e', border: '1px solid #1a2846', borderRadius: '6px', padding: '8px 10px' }}>
                  <span style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase' }}>
                    IGST ({result.igst_rate ?? result.tax_rate}%)
                  </span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#34d399', fontFamily: 'monospace', marginTop: '2px' }}>
                    {formatCurrency(result.igst_amount, companyCurrency)}
                  </div>
                </div>
              )}

              {/* Total Tax */}
              <div style={{ backgroundColor: '#070d1e', border: '1px solid #1a2846', borderRadius: '6px', padding: '8px 10px' }}>
                <span style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase' }}>Total Tax</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace', marginTop: '2px' }}>
                  {formatCurrency(result.total_tax, companyCurrency)}
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div
              style={{
                backgroundColor: 'rgba(5, 150, 105, 0.12)',
                border: '1px solid rgba(5, 150, 105, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 600 }}>Grand Total Payable</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  {result.is_tax_inclusive ? 'Tax Inclusive Calculation' : 'Base + Calculated Tax'}
                </div>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
                {formatCurrency(result.total_amount, companyCurrency)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
