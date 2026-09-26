import React, { useRef, useState } from 'react';
import { UploadCloud, AlertCircle, ShieldAlert } from 'lucide-react';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

export const SUPPORTED_EXTENSIONS = ['.csv', '.json', '.xml', '.txt', '.xlsx'];

export const SUPPORTED_MIME_TYPES = [
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

interface FileUploadDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  isAdmin?: boolean;
}

export const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({
  onFileSelected,
  disabled = false,
  isAdmin = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    setValidationError(null);

    if (!file) {
      setValidationError('No file selected.');
      return false;
    }

    if (file.size === 0) {
      setValidationError('Empty files are not allowed.');
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError('File size exceeds the 10 MiB limit.');
      return false;
    }

    const filename = file.name.toLowerCase();
    const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => filename.endsWith(ext));

    if (!hasValidExt) {
      setValidationError(
        `Unsupported file type. Supported formats: ${SUPPORTED_EXTENSIONS.map((e) => e.toUpperCase().replace('.', '')).join(', ')}`
      );
      return false;
    }

    return true;
  };

  const handleFiles = (files: FileList | null) => {
    if (disabled || !isAdmin) return;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (validateFile(file)) {
      onFileSelected(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && isAdmin) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled && isAdmin) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    if (!disabled && isAdmin && fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && isAdmin) {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        data-testid="file-upload-input"
        accept=".csv,.json,.xml,.txt,.xlsx,text/csv,application/json,application/xml,text/xml,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
        disabled={disabled || !isAdmin}
        aria-label="Upload operational data file"
      />

      {/* Dropzone Container */}
      <div
        role="button"
        tabIndex={disabled || !isAdmin ? -1 : 0}
        aria-label="File upload dropzone. Press Enter or Space to browse files"
        aria-disabled={disabled || !isAdmin}
        data-testid="file-upload-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          minHeight: '220px',
          borderRadius: '14px',
          border: isDragging
            ? '2px dashed #38bdf8'
            : !isAdmin
              ? '2px dashed rgba(148, 163, 184, 0.2)'
              : '2px dashed rgba(2, 132, 199, 0.35)',
          backgroundColor: isDragging
            ? 'rgba(2, 132, 199, 0.08)'
            : !isAdmin
              ? 'rgba(15, 23, 42, 0.4)'
              : 'rgba(9, 15, 32, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          cursor: disabled || !isAdmin ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxSizing: 'border-box',
          position: 'relative',
        }}
        onFocus={(e) => {
          if (!disabled && isAdmin) {
            e.currentTarget.style.borderColor = '#38bdf8';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.25)';
          }
        }}
        onBlur={(e) => {
          if (!disabled && isAdmin) {
            e.currentTarget.style.borderColor = 'rgba(2, 132, 199, 0.35)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      >
        {/* Upload Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            backgroundColor: !isAdmin ? 'rgba(100, 116, 139, 0.15)' : 'rgba(2, 132, 199, 0.15)',
            border: !isAdmin ? '1px solid rgba(100, 116, 139, 0.3)' : '1px solid rgba(2, 132, 199, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: !isAdmin ? '#94a3b8' : '#38bdf8',
            marginBottom: '16px',
            transition: 'transform 0.2s ease',
            transform: isDragging ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {!isAdmin ? <ShieldAlert size={28} /> : <UploadCloud size={28} />}
        </div>

        {/* Text Guidelines */}
        {!isAdmin ? (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
              Standard User — Read Only
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
              Administrator permissions are required to upload or process operational data files.
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
              Drag & drop your file here
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: '#94a3b8' }}>
              or <span style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'underline' }}>Browse Files</span> from your computer
            </p>

            {/* Supported Formats Pill Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {['CSV', 'JSON', 'XML', 'TXT', 'XLSX'].map((fmt) => (
                <span
                  key={fmt}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#cbd5e1',
                  }}
                >
                  {fmt}
                </span>
              ))}
            </div>

            <p style={{ margin: '12px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
              Maximum file size: <span style={{ color: '#94a3b8', fontWeight: 500 }}>10 MiB</span>
            </p>
          </div>
        )}
      </div>

      {/* Validation Error Message */}
      {validationError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
