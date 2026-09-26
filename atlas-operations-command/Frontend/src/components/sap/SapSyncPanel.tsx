import React, { useState } from 'react';
import { RefreshCw, Play, Info, ShieldAlert } from 'lucide-react';
import type { SapBusinessDataResponse } from '../../types';

interface SapSyncPanelProps {
  sapData: SapBusinessDataResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export const SapSyncPanel: React.FC<SapSyncPanelProps> = ({
  sapData,
  loading,
  onRefresh,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const isUnavailable = !sapData || sapData.status.toLowerCase() === 'unavailable';

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Synchronization & Gateway Actions
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Trigger manual synchronization passes and inspect live connector telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: showDetails ? 'var(--bg-primary)' : 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Info size={14} />
            <span>{showDetails ? 'Hide Details' : 'Integration Details'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Status</span>
          </button>

          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              disabled={true}
              title="SAP synchronization is disabled because the SAP integration is not connected."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'rgba(59, 130, 246, 0.3)',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'not-allowed',
              }}
            >
              <Play size={14} />
              <span>Start Sync</span>
            </button>
          </div>
        </div>
      </div>

      {isUnavailable && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            color: '#fbbf24',
            fontSize: '0.8rem',
          }}
        >
          <ShieldAlert size={16} style={{ flexShrink: 0 }} />
          <span>
            Synchronization controls are locked. Connect and configure an active SAP ERP gateway to enable real-time and scheduled sync jobs.
          </span>
        </div>
      )}

      {showDetails && (
        <div
          data-testid="sap-integration-details-panel"
          style={{
            marginTop: '8px',
            padding: '16px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Connector Telemetry & Contract Metadata
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            <span>Backend Endpoint:</span>
            <code style={{ color: '#38bdf8' }}>GET /api/v1/business-data/sap</code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            <span>Authoritative Response Status:</span>
            <span style={{ color: isUnavailable ? '#f87171' : '#34d399', fontWeight: 600 }}>
              {sapData?.status || 'unavailable'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            <span>Authoritative Message:</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {sapData?.message || 'SAP integration is not configured or connected.'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tenant Enforcement:</span>
            <span style={{ color: '#10b981' }}>Strict JWT Context Isolation</span>
          </div>
        </div>
      )}
    </div>
  );
};
