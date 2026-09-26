import React, { useState } from 'react';
import {
  FileText,
  Play,
  RefreshCw,
  Search,
  Eye,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import type { FileUpload } from '../../types';
import { UploadStatusBadge } from './UploadStatusBadge';
import { formatFileSize } from './SelectedFileCard';

interface UploadHistoryProps {
  uploads: FileUpload[];
  onProcess: (uploadId: string) => void;
  onViewDetails: (upload: FileUpload) => void;
  processingUploadId: string | null;
  isAdmin?: boolean;
}

export const UploadHistory: React.FC<UploadHistoryProps> = ({
  uploads,
  onProcess,
  onViewDetails,
  processingUploadId,
  isAdmin = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredUploads = uploads.filter((u) => {
    const matchesSearch =
      u.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.file_type.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || u.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div
      style={{
        backgroundColor: '#0d1631',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '14px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Header & Filter Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
            Upload History & Ingestion Queue
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            Showing {filteredUploads.length} of {uploads.length} uploaded files
          </p>
        </div>

        {/* Search & Filter Inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', color: '#64748b' }}
            />
            <input
              type="text"
              placeholder="Search filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search uploaded files by filename"
              style={{
                backgroundColor: '#090f20',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                padding: '6px 12px 6px 32px',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none',
                width: '180px',
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter uploads by status"
            style={{
              backgroundColor: '#090f20',
              border: '1px solid #1e293b',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#cbd5e1',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="uploaded">Ready to Process</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Uploads Table / Empty State */}
      {filteredUploads.length === 0 ? (
        <div
          data-testid="uploads-empty-state"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(9, 15, 32, 0.5)',
            borderRadius: '10px',
            border: '1px dashed #1e293b',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              marginBottom: '12px',
            }}
          >
            <Inbox size={24} />
          </div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
            No Files Uploaded
          </h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', maxWidth: '340px' }}>
            {uploads.length === 0
              ? 'Upload your first operational data file above to begin ingestion.'
              : 'No upload records match your current search and filter criteria.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.82rem',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#090f20',
                  borderBottom: '1px solid #1e293b',
                  color: '#64748b',
                  fontSize: '0.74rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>File Details</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Size</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Uploaded</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUploads.map((upload) => {
                const isCurrentlyProcessing = processingUploadId === upload.id;
                const canProcess =
                  (upload.status === 'uploaded' || upload.status === 'failed') &&
                  isAdmin &&
                  !isCurrentlyProcessing;

                return (
                  <tr
                    key={upload.id}
                    data-testid={`upload-row-${upload.id}`}
                    style={{
                      borderBottom: '1px solid rgba(30, 41, 59, 0.7)',
                      backgroundColor: isCurrentlyProcessing
                        ? 'rgba(2, 132, 199, 0.05)'
                        : 'transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Filename & Type */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#38bdf8',
                            flexShrink: 0,
                          }}
                        >
                          <FileText size={16} />
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#f8fafc',
                              maxWidth: '260px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={upload.original_filename}
                          >
                            {upload.original_filename}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                            {upload.file_type.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Size */}
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      {formatFileSize(upload.file_size)}
                    </td>

                    {/* Uploaded Timestamp */}
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.76rem' }}>
                      {new Date(upload.created_at).toLocaleString()}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '12px 16px' }}>
                      <UploadStatusBadge status={isCurrentlyProcessing ? 'processing' : upload.status} size="sm" />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onViewDetails(upload)}
                          title="View upload details"
                          aria-label={`View details for ${upload.original_filename}`}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '5px',
                            backgroundColor: 'transparent',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>

                        {canProcess && (
                          <button
                            type="button"
                            onClick={() => onProcess(upload.id)}
                            disabled={isCurrentlyProcessing}
                            aria-label={`Process ${upload.original_filename}`}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '5px',
                              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Play size={12} />
                            <span>Process</span>
                          </button>
                        )}

                        {isCurrentlyProcessing && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: '#facc15',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 500,
                            }}
                          >
                            <RefreshCw size={12} className="animate-spin" />
                            <span>Processing...</span>
                          </span>
                        )}

                        {upload.status === 'completed' && !isCurrentlyProcessing && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: '#34d399',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 500,
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Processed</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
