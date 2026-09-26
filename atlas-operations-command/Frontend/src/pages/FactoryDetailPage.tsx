import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Factory as FactoryIcon, ArrowLeft, RefreshCw } from 'lucide-react';
import { factoryService } from '../services/factoryService';
import { FactoryPerformance } from '../components/factories/FactoryPerformance';
import { FactoryFinancialsCard } from '../components/factories/FactoryFinancials';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorState } from '../components/common/ErrorState';
import type { Factory, FactoryFinancials } from '../types';

export const FactoryDetailPage: React.FC = () => {
  const { factoryId } = useParams<{ factoryId: string }>();

  const [factory, setFactory] = useState<Factory | null>(null);
  const [financials, setFinancials] = useState<FactoryFinancials | null>(null);
  const [isLoadingFactory, setIsLoadingFactory] = useState<boolean>(true);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState<boolean>(false);
  const [factoryError, setFactoryError] = useState<string | null>(null);
  const [financialsError, setFinancialsError] = useState<string | null>(null);

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);

  // Fetch Factory Identity Details
  const fetchFactoryDetails = useCallback(async () => {
    if (!factoryId) return;
    setIsLoadingFactory(true);
    setFactoryError(null);

    try {
      const data = await factoryService.getFactory(factoryId);
      setFactory(data);
    } catch (err: any) {
      if (err.status === 404) {
        setFactoryError('Factory not found. The requested facility does not exist or has been removed.');
      } else if (err.status === 403) {
        setFactoryError('Access forbidden. You do not have permission to view this factory.');
      } else {
        setFactoryError(err.message || 'Unable to load factory details. Please try again.');
      }
    } finally {
      setIsLoadingFactory(false);
    }
  }, [factoryId]);

  // Fetch Factory Financials for Period
  const fetchFinancials = useCallback(async () => {
    if (!factoryId) return;
    setIsLoadingFinancials(true);
    setFinancialsError(null);

    try {
      const data = await factoryService.getFactoryFinancials(factoryId, selectedYear, selectedMonth);
      setFinancials(data);
    } catch (err: any) {
      if (err.status === 404) {
        setFinancials(null);
      } else {
        setFinancialsError(err.message || 'Unable to load factory financial telemetry.');
      }
    } finally {
      setIsLoadingFinancials(false);
    }
  }, [factoryId, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchFactoryDetails();
  }, [fetchFactoryDetails]);

  useEffect(() => {
    if (factoryId) {
      fetchFinancials();
    }
  }, [factoryId, fetchFinancials]);

  if (isLoadingFactory) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading factory profile telemetry..." />
      </div>
    );
  }

  if (factoryError || !factory) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ marginBottom: '8px' }}>
          <Link
            to="/factories"
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              fontSize: '0.85rem',
            }}
          >
            <ArrowLeft size={14} /> Back to Factories
          </Link>
        </div>
        <div className="card">
          <ErrorState
            title={factoryError?.includes('not found') ? 'Factory Not Found' : 'Error Loading Factory'}
            message={factoryError || 'The requested factory profile could not be found.'}
            onRetry={fetchFactoryDetails}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/factories"
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            fontSize: '0.85rem',
          }}
        >
          <ArrowLeft size={14} /> Back to Factories
        </Link>
      </div>

      {/* Factory Profile Header */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <FactoryIcon size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
                {factory.name}
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background:
                    factory.status === 'active'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(245, 158, 11, 0.1)',
                  color: factory.status === 'active' ? '#10b981' : '#f59e0b',
                  border:
                    factory.status === 'active'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(245, 158, 11, 0.3)',
                  textTransform: 'uppercase',
                }}
              >
                {factory.status}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
              Plant Code: <strong>{factory.code || 'N/A'}</strong> • Location: <strong>{factory.location || 'N/A'}</strong>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              fetchFactoryDetails();
              fetchFinancials();
            }}
            className="btn-secondary"
            disabled={isLoadingFactory || isLoadingFinancials}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.85rem',
            }}
            aria-label="Refresh factory details"
          >
            <RefreshCw size={14} className={isLoadingFactory || isLoadingFinancials ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Operational Performance Component */}
      <FactoryPerformance factory={factory} />

      {/* Financial Drill-Down Component */}
      <FactoryFinancialsCard
        financials={financials}
        isLoading={isLoadingFinancials}
        error={financialsError}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
        onRetry={fetchFinancials}
      />
    </div>
  );
};
