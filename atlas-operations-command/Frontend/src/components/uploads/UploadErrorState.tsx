import React from 'react';
import { AlertCircle, AlertTriangle, ShieldAlert, RefreshCw, XCircle } from 'lucide-react';

interface UploadErrorStateProps {
  error: string | null;
  status?: number;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const UploadErrorState: React.FC<UploadErrorStateProps> = ({
  error,
  status,
  onRetry,
  onDismiss,
}) => {
  if (!error) return null;

  const getFriendlyMessage = (): { title: string; desc: string; icon: React.ReactNode } => {
    switch (status) {
      case 401:
        return {
          title: 'Session Expired',
          desc: 'Session expired. Please sign in again.',
          icon: <ShieldAlert size={20} className="text-red-400" />,
        };
      case 403:
        return {
          title: 'Access Restricted',
          desc: 'You do not have permission to perform this operation. Administrator role required.',
          icon: <ShieldAlert size={20} className="text-amber-400" />,
        };
      case 409:
        return {
          title: 'Duplicate File Detected',
          desc: 'This file has already been uploaded for this company. SHA-256 idempotency prevents duplicate ingestion.',
          icon: <AlertTriangle size={20} className="text-amber-400" />,
        };
      case 413:
        return {
          title: 'File Too Large',
          desc: 'The selected file is too large. Maximum supported file size is 10 MiB.',
          icon: <AlertCircle size={20} className="text-red-400" />,
        };
      case 415:
        return {
          title: 'Unsupported File Type',
          desc: 'This file type is not supported. Please provide a CSV, JSON, XML, TXT, or XLSX file.',
          icon: <AlertCircle size={20} className="text-red-400" />,
        };
      case 422:
        return {
          title: 'Validation Error',
          desc: error || 'The uploaded file could not be validated by the server.',
          icon: <AlertCircle size={20} className="text-red-400" />,
        };
      case 500:
        return {
          title: 'Server Error',
          desc: 'The server could not process the request. Please try again later.',
          icon: <XCircle size={20} className="text-red-400" />,
        };
      default:
        return {
          title: 'Operation Notice',
          desc: error,
          icon: <AlertCircle size={20} className="text-red-400" />,
        };
    }
  };

  const { title, desc, icon } = getFriendlyMessage();

  return (
    <div
      role="alert"
      data-testid="upload-error-state"
      style={{
        backgroundColor: 'rgba(30, 15, 25, 0.75)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '14px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ marginTop: '2px', flexShrink: 0 }}>{icon}</div>
        <div>
          <h4 style={{ margin: '0 0 2px 0', fontSize: '0.86rem', fontWeight: 600, color: '#fecaca' }}>
            {title}
          </h4>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#fda4af', lineHeight: 1.4 }}>
            {desc}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fee2e2',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error notification"
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fda4af',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
