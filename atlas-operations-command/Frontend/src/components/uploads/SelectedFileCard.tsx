import React from 'react';
import { FileText, X, UploadCloud, RefreshCw } from 'lucide-react';

interface SelectedFileCardProps {
  file: File;
  onClear: () => void;
  onUpload: () => void;
  isUploading: boolean;
  disabled?: boolean;
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const SelectedFileCard: React.FC<SelectedFileCardProps> = ({
  file,
  onClear,
  onUpload,
  isUploading,
  disabled = false,
}) => {
  const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <div
      data-testid="selected-file-card"
      style={{
        backgroundColor: '#0d1631',
        border: '1px solid rgba(2, 132, 199, 0.3)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* File Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '200px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            flexShrink: 0,
          }}
        >
          <FileText size={22} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#f8fafc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '360px',
            }}
            title={file.name}
          >
            {file.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
            >
              {fileExt}
            </span>
            <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{formatFileSize(file.size)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={onClear}
          disabled={isUploading || disabled}
          aria-label="Remove selected file"
          style={{
            padding: '7px 14px',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            border: '1px solid #334155',
            color: '#94a3b8',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: isUploading || disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <X size={14} />
          <span>Remove</span>
        </button>

        <button
          type="button"
          onClick={onUpload}
          disabled={isUploading || disabled}
          aria-label="Upload file to server"
          style={{
            padding: '7px 18px',
            borderRadius: '6px',
            background: isUploading
              ? 'rgba(2, 132, 199, 0.5)'
              : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            border: 'none',
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: isUploading || disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          {isUploading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <UploadCloud size={15} />
              <span>Upload File</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
