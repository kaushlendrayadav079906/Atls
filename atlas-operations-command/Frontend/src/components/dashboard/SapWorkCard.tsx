import React from 'react';
import { Server, Lock, AlertCircle } from 'lucide-react';

export const SapWorkCard: React.FC = () => {
  return (
    <div
      className="card"
      style={{
        border: '1px solid rgba(148, 163, 184, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '260px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={20} color="#94a3b8" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            SAP Enterprise Connector
          </h3>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '12px',
            background: 'rgba(148, 163, 184, 0.15)',
            color: '#94a3b8',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            fontWeight: 600,
          }}
        >
          PLANNED (PHASE 8)
        </span>
      </div>

      <div
        style={{
          padding: '24px 16px',
          borderRadius: '8px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px dashed var(--border-subtle)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            padding: '10px',
            borderRadius: '50%',
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lock size={24} />
        </div>
        <div>
          <h4 style={{ color: 'var(--text-secondary)', fontWeight: 600, margin: '0 0 4px 0' }}>
            Awaiting SAP integration
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto' }}>
            SAP ERP connectivity will be initialized during the Phase 8 integration rollout. Operations currently run on native normalized telemetry.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <AlertCircle size={14} />
        <span>No mock or simulated data is passed for SAP synchronization.</span>
      </div>
    </div>
  );
};
