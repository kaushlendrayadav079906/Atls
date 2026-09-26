import React from 'react';
import { Inbox } from 'lucide-react';
import type { SapBusinessDataResponse } from '../../types';

interface SapWorkQueueProps {
  sapData: SapBusinessDataResponse | null;
}

export const SapWorkQueue: React.FC<SapWorkQueueProps> = ({ sapData }) => {
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
          gap: '10px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            SAP Work Queue & Sync Ledger
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Real-time batch ingestion queue and bidirectional staging tasks.
          </p>
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          0 Pending Tasks
        </span>
      </div>

      <div
        data-testid="sap-work-queue-empty-state"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-subtle)',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(148, 163, 184, 0.1)',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Inbox size={24} />
        </div>

        <div style={{ maxWidth: '420px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            No SAP work is currently available.
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {isUnavailable
              ? 'Connect/configure the SAP integration to begin synchronization and view enterprise ledger work items.'
              : 'All synchronization jobs and inbound enterprise work orders are up to date.'}
          </p>
        </div>
      </div>
    </div>
  );
};
