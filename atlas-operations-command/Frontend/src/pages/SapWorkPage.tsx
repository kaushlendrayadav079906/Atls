import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Boxes,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { sapService } from '../services/sapService';
import type { SapBusinessDataResponse } from '../types';
import {
  SapStatusCard,
  SapIntegrationOverview,
  SapSyncPanel,
  SapWorkQueue,
  SapUnavailableState,
} from '../components/sap';
import { DemoDataBanner } from '../components/dashboard/DemoDataBanner';

export const SapWorkPage: React.FC = () => {
  const [sapData, setSapData] = useState<SapBusinessDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);

  // Prevent overlapping/duplicate requests during rapid clicks
  const isFetchingRef = useRef(false);

  const fetchSapStatus = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    setErrorStatus(undefined);

    try {
      const data = await sapService.getSapStatus();
      setSapData(data);
    } catch (err: any) {
      setErrorStatus(err.status);
      if (err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err.status === 403) {
        setError('You do not have permission to view SAP integration data.');
      } else {
        setError(err.message || 'Unable to load SAP integration status.');
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchSapStatus();
  }, [fetchSapStatus]);

  const handleManualRefresh = () => {
    fetchSapStatus();
  };

  return (
    <div
      data-testid="sap-work-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Demo mode banner if active */}
      <DemoDataBanner />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Boxes size={20} />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                SAP Work
              </h1>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
                SAP integration, synchronization and enterprise data status
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            aria-label="Refresh SAP Data"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && !sapData && (
        <div
          data-testid="sap-loading-state"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            gap: '12px',
          }}
        >
          <RefreshCw size={28} className="animate-spin" style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Loading SAP integration status...
          </span>
        </div>
      )}

      {error && !loading && (
        <div
          data-testid="sap-error-state"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.875rem' }}>
                  {errorStatus === 401
                    ? 'Session Expired'
                    : errorStatus === 403
                    ? 'Access Restricted'
                    : 'Integration Request Failed'}
                </strong>
                <span style={{ fontSize: '0.82rem', opacity: 0.9 }}>{error}</span>
              </div>
            </div>

            <button
              onClick={handleManualRefresh}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>

          <SapUnavailableState
            message="SAP integration is currently unavailable."
            onRetry={handleManualRefresh}
            loading={loading}
          />
        </div>
      )}

      {(!loading || sapData) && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status Card */}
          <SapStatusCard
            sapData={sapData}
            loading={loading}
            onRefresh={handleManualRefresh}
          />

          {/* Contextual unavailable notice if not connected */}
          {(!sapData || sapData.status.toLowerCase() === 'unavailable') && (
            <SapUnavailableState
              message={sapData?.message || 'SAP integration is not configured for this company.'}
              onRetry={handleManualRefresh}
              loading={loading}
            />
          )}

          {/* Integration Overview Grid */}
          <SapIntegrationOverview sapData={sapData} />

          {/* Sync & Gateway Controls Panel */}
          <SapSyncPanel
            sapData={sapData}
            loading={loading}
            onRefresh={handleManualRefresh}
          />

          {/* Work Queue & Ledger */}
          <SapWorkQueue sapData={sapData} />
        </div>
      )}
    </div>
  );
};

export default SapWorkPage;
