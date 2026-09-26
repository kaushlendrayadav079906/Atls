import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, X, LayoutDashboard } from 'lucide-react';
import type { FileUpload } from '../../types';
import { UploadStatusBadge } from './UploadStatusBadge';
import { formatFileSize } from './SelectedFileCard';

interface UploadProcessingResultProps {
  upload: FileUpload | null;
  onClose: () => void;
}

export const UploadProcessingResult: React.FC<UploadProcessingResultProps> = ({ upload, onClose }) => {
  const navigate = useNavigate();
  if (!upload) return null;

  const isSuccess = upload.status === 'completed';
  const isFailed = upload.status === 'failed';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="processing-result-title"
      data-testid="upload-processing-result-modal"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(580px, calc(100vw - 32px))',
          backgroundColor: '#0b1329',
          border: '1px solid #1e293b',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: isSuccess
                  ? 'rgba(16, 185, 129, 0.15)'
                  : isFailed
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(2, 132, 199, 0.15)',
                color: isSuccess ? '#34d399' : isFailed ? '#f87171' : '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSuccess ? <CheckCircle2 size={20} /> : isFailed ? <XCircle size={20} /> : <Clock size={20} />}
            </div>
            <div>
              <h3
                id="processing-result-title"
                style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}
              >
                {isSuccess
                  ? 'Ingestion Completed'
                  : isFailed
                  ? 'Processing Failed'
                  : 'Upload Status Details'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Authoritative backend processing record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Status & File Details Card */}
        <div
          style={{
            backgroundColor: '#0d1631',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Status</span>
            <UploadStatusBadge status={upload.status} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Original Filename</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#f1f5f9', fontFamily: 'monospace' }}>
              {upload.original_filename}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>File Type & Size</span>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              {upload.file_type.toUpperCase()} • {formatFileSize(upload.file_size)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>SHA-256 Digest Preview</span>
            <span
              style={{
                fontSize: '0.74rem',
                fontFamily: 'monospace',
                color: '#38bdf8',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {upload.file_hash.slice(0, 16)}...
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Uploaded At</span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {new Date(upload.created_at).toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Last Updated</span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {new Date(upload.updated_at).toLocaleString()}
            </span>
          </div>

          {upload.error_message && (
            <div
              style={{
                marginTop: '6px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>Backend Error Diagnostic:</div>
              <div>{upload.error_message}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          {isSuccess && (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/dashboard');
              }}
              data-testid="view-dashboard-btn"
              style={{
                padding: '7px 18px',
                borderRadius: '6px',
                backgroundColor: '#0284c7',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LayoutDashboard size={14} />
              <span>View Dashboard</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              backgroundColor: '#1e293b',
              border: 'none',
              color: '#f8fafc',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

