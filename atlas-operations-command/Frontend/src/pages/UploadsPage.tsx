import React, { useState, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  RefreshCw,
  Layers,
  FileCheck,
  AlertOctagon,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadService } from '../services/uploadService';
import type { FileUpload } from '../types';
import {
  FileUploadDropzone,
  SelectedFileCard,
  UploadHistory,
  UploadProcessingResult,
  UploadErrorState,
} from '../components/uploads';

export const UploadsPage: React.FC = () => {
  const { user } = useAuth();
  
  // Authoritative admin determination from AuthContext with fallback to stored user session
  const storedUser = (() => {
    try {
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const currentUser = user || storedUser;
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingUploadId, setProcessingUploadId] = useState<string | null>(null);
  const [activeResultUpload, setActiveResultUpload] = useState<FileUpload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const loadUploads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await uploadService.listUploads();
      setUploads(data || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load upload history.');
      setErrorStatus(err.status);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  const handleFileSelected = (file: File) => {
    setErrorMessage(null);
    setErrorStatus(undefined);
    setSuccessNotice(null);
    setSelectedFile(file);
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);
    setErrorStatus(undefined);
    setSuccessNotice(null);

    try {
      const uploadedRecord = await uploadService.uploadFile(selectedFile);
      setSuccessNotice(`"${uploadedRecord.original_filename}" uploaded successfully.`);
      setSelectedFile(null);
      await loadUploads();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload file.');
      setErrorStatus(err.status);
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcess = async (uploadId: string) => {
    setProcessingUploadId(uploadId);
    setErrorMessage(null);
    setErrorStatus(undefined);

    try {
      const result = await uploadService.processUpload(uploadId);
      setActiveResultUpload(result);
      await loadUploads();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to trigger file processing.');
      setErrorStatus(err.status);
    } finally {
      setProcessingUploadId(null);
    }
  };

  // Metrics summary
  const totalCount = uploads.length;
  const completedCount = uploads.filter((u) => u.status === 'completed').length;
  const pendingCount = uploads.filter((u) => u.status === 'uploaded' || u.status === 'processing').length;
  const failedCount = uploads.filter((u) => u.status === 'failed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 1. Command Center Page Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
                borderRadius: '8px',
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UploadCloud size={20} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              File Upload & Data Ingestion
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: '#94a3b8' }}>
            Upload and process operational, financial, sales, inventory, and business data securely.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: '#0d1631',
              border: '1px solid #1e293b',
              fontSize: '0.76rem',
              color: '#94a3b8',
            }}
          >
            <ShieldCheck size={14} color="#0284c7" />
            <span>Tenant-Isolated Ingestion</span>
          </div>

          <button
            type="button"
            onClick={loadUploads}
            disabled={loading}
            aria-label="Refresh upload history"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#0d1631',
              border: '1px solid #1e293b',
              color: '#cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Error State Banner */}
      <UploadErrorState
        error={errorMessage}
        status={errorStatus}
        onRetry={loadUploads}
        onDismiss={() => {
          setErrorMessage(null);
          setErrorStatus(undefined);
        }}
      />

      {/* Success Notification */}
      {successNotice && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.82rem',
            fontWeight: 500,
          }}
        >
          <span>{successNotice}</span>
          <button
            onClick={() => setSuccessNotice(null)}
            style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.76rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Upload Summary KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#0d1631',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Files
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
              {totalCount}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#0d1631',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ingested
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#34d399', lineHeight: 1.2 }}>
              {completedCount}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#0d1631',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              color: '#facc15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending / Staged
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#facc15', lineHeight: 1.2 }}>
              {pendingCount}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#0d1631',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertOctagon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Failed
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f87171', lineHeight: 1.2 }}>
              {failedCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. File Upload Dropzone */}
      <FileUploadDropzone
        onFileSelected={handleFileSelected}
        disabled={isUploading}
        isAdmin={isAdmin}
      />

      {/* 4. Selected File Stage Card */}
      {selectedFile && (
        <SelectedFileCard
          file={selectedFile}
          onClear={handleClearSelectedFile}
          onUpload={handleUpload}
          isUploading={isUploading}
          disabled={!isAdmin}
        />
      )}

      {/* 5. Upload History & Queue */}
      <UploadHistory
        uploads={uploads}
        onProcess={handleProcess}
        onViewDetails={(upload) => setActiveResultUpload(upload)}
        processingUploadId={processingUploadId}
        isAdmin={isAdmin}
      />

      {/* 6. Processing Result Details Modal */}
      {activeResultUpload && (
        <UploadProcessingResult
          upload={activeResultUpload}
          onClose={() => setActiveResultUpload(null)}
        />
      )}
    </div>
  );
};

export default UploadsPage;
