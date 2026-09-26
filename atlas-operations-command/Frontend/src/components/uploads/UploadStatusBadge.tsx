import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import type { FileUploadStatus } from '../../types';

interface UploadStatusBadgeProps {
  status: FileUploadStatus;
  size?: 'sm' | 'md';
}

export const UploadStatusBadge: React.FC<UploadStatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalizedStatus = (status || '').toLowerCase();

  switch (normalizedStatus) {
    case 'uploaded':
      return (
        <span
          data-testid="status-badge-uploaded"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: size === 'sm' ? '2px 8px' : '4px 10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            color: '#38bdf8',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.01em',
          }}
        >
          <Clock size={size === 'sm' ? 12 : 13} />
          <span>Ready to Process</span>
        </span>
      );

    case 'processing':
      return (
        <span
          data-testid="status-badge-processing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: size === 'sm' ? '2px 8px' : '4px 10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(234, 179, 8, 0.12)',
            color: '#facc15',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={size === 'sm' ? 12 : 13} className="animate-spin" />
          <span>Processing...</span>
        </span>
      );

    case 'completed':
      return (
        <span
          data-testid="status-badge-completed"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: size === 'sm' ? '2px 8px' : '4px 10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={size === 'sm' ? 12 : 13} />
          <span>Completed</span>
        </span>
      );

    case 'failed':
      return (
        <span
          data-testid="status-badge-failed"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: size === 'sm' ? '2px 8px' : '4px 10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
            fontWeight: 600,
          }}
        >
          <XCircle size={size === 'sm' ? 12 : 13} />
          <span>Failed</span>
        </span>
      );

    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: size === 'sm' ? '2px 8px' : '4px 10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(148, 163, 184, 0.12)',
            color: '#94a3b8',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={size === 'sm' ? 12 : 13} />
          <span>{status}</span>
        </span>
      );
  }
};
