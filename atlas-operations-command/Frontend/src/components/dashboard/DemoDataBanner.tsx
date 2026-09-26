import React from 'react';
import { AlertCircle } from 'lucide-react';
import { isDemoMode } from '../../config';

interface DemoDataBannerProps {
  isDemoOverride?: boolean;
}

export const DemoDataBanner: React.FC<DemoDataBannerProps> = ({ isDemoOverride }) => {
  const active = isDemoOverride !== undefined ? isDemoOverride : isDemoMode();
  if (!active) {
    return null;
  }


  return (
    <aside
      aria-label="Demo mode active notice"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px',
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 'var(--radius-md)',
        color: '#fbbf24',
        fontSize: '0.85rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertCircle size={18} />
        <span>DEMO DATA — LOCAL TESTING</span>
      </div>
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 400,
          color: 'var(--text-secondary)',
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '2px 8px',
          borderRadius: '4px',
        }}
      >
        VITE_DEMO_MODE=true
      </span>
    </aside>
  );
};
