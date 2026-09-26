import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UploadsPage } from '../pages/UploadsPage';
import { AuthProvider } from '../context/AuthContext';
import { uploadService } from '../services/uploadService';
import { ApiError } from '../services/apiClient';

import { authService } from '../services/authService';

// Mock uploadService
vi.mock('../services/uploadService', () => ({
  uploadService: {
    listUploads: vi.fn(),
    getUpload: vi.fn(),
    uploadFile: vi.fn(),
    processUpload: vi.fn(),
  },
}));

vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

const mockUploads = [
  {
    id: 'up-1111-2222',
    original_filename: 'factory_production_q3.csv',
    stored_filename: 'uuid-1.csv',
    file_type: 'csv',
    content_type: 'text/csv',
    file_size: 1048576, // 1 MiB
    file_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'uploaded',
    error_message: null,
    created_at: '2026-09-08T10:00:00Z',
    updated_at: '2026-09-08T10:00:00Z',
  },
  {
    id: 'up-3333-4444',
    original_filename: 'financial_ledger_2026.json',
    stored_filename: 'uuid-2.json',
    file_type: 'json',
    content_type: 'application/json',
    file_size: 524288, // 512 KiB
    file_hash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    status: 'completed',
    error_message: null,
    created_at: '2026-09-07T14:30:00Z',
    updated_at: '2026-09-07T14:32:00Z',
  },
  {
    id: 'up-5555-6666',
    original_filename: 'inventory_corrupted.xml',
    stored_filename: 'uuid-3.xml',
    file_type: 'xml',
    content_type: 'application/xml',
    file_size: 204800,
    file_hash: '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03',
    status: 'failed',
    error_message: 'XML syntax error at line 42',
    created_at: '2026-09-06T09:15:00Z',
    updated_at: '2026-09-06T09:16:00Z',
  },
];

describe('Frontend Unit 8: File Upload & Data Ingestion Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authService.isAuthenticated as any).mockReturnValue(true);
    (authService.getCurrentUser as any).mockResolvedValue({
      id: 'user-admin-1',
      email: 'admin@acme.corp',
      full_name: 'Operations Commander',
      status: 'active',
      company_id: 'tenant-ind-12345',
      role: 'admin',
    });

    (uploadService.listUploads as any).mockResolvedValue(mockUploads);
  });

  const renderComponent = () =>
    render(
      <AuthProvider>
        <MemoryRouter>
          <UploadsPage />
        </MemoryRouter>
      </AuthProvider>
    );


  it('1. Page renders command center header, stats row, and dropzone', async () => {
    renderComponent();

    expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    expect(
      screen.getByText(/Upload and process operational, financial, sales, inventory, and business data securely/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total Files')).toBeInTheDocument();
    });

    expect(screen.getByText('Ingested')).toBeInTheDocument();
    expect(screen.getByText('Pending / Staged')).toBeInTheDocument();
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
  });

  it('2. Dropzone displays supported formats and 10 MiB limit', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('file-upload-dropzone')).toBeInTheDocument();
    });

    expect(screen.getAllByText('CSV').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('JSON').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('XML').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('TXT')).toBeInTheDocument();
    expect(screen.getByText('XLSX')).toBeInTheDocument();
    expect(screen.getByText(/Maximum file size:/i)).toBeInTheDocument();
    expect(screen.getByText('10 MiB')).toBeInTheDocument();
  });

  it('3. Upload history renders uploaded files, file sizes, and status badges', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('factory_production_q3.csv')).toBeInTheDocument();
      expect(screen.getByText('financial_ledger_2026.json')).toBeInTheDocument();
      expect(screen.getByText('inventory_corrupted.xml')).toBeInTheDocument();
    });

    expect(screen.getByTestId('status-badge-uploaded')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge-completed')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge-failed')).toBeInTheDocument();
  });


  it('4. Selecting a valid file shows SelectedFileCard with filename, size, and clear action', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-upload-input');
    const validFile = new File(['col1,col2\nval1,val2'], 'monthly_sales.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('selected-file-card')).toBeInTheDocument();
      expect(screen.getByText('monthly_sales.csv')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /Remove selected file/i });
    await userEvent.click(removeBtn);

    expect(screen.queryByTestId('selected-file-card')).not.toBeInTheDocument();
  });

  it('5. Empty file is rejected by local validation', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-upload-input');
    const emptyFile = new File([], 'empty.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [emptyFile] } });

    await waitFor(() => {
      expect(screen.getByText('Empty files are not allowed.')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('selected-file-card')).not.toBeInTheDocument();
  });

  it('6. Unsupported file extension is rejected by local validation', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-upload-input');
    const invalidFile = new File(['pdf content'], 'manual.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Unsupported file type/i)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('selected-file-card')).not.toBeInTheDocument();
  });

  it('7. File exceeding 10 MiB is rejected by local validation', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-upload-input');
    const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'giant_dataset.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('File size exceeds the 10 MiB limit.')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('selected-file-card')).not.toBeInTheDocument();
  });

  it('8. Uploading file calls uploadService.uploadFile and refreshes list on success', async () => {
    const newUploadRecord = {
      id: 'up-7777-8888',
      original_filename: 'operations_batch.csv',
      stored_filename: 'uuid-7777.csv',
      file_type: 'csv',
      content_type: 'text/csv',
      file_size: 2048,
      file_hash: 'hash7777',
      status: 'uploaded',
      created_at: '2026-09-09T12:00:00Z',
      updated_at: '2026-09-09T12:00:00Z',
    };

    (uploadService.uploadFile as any).mockResolvedValueOnce(newUploadRecord);
    (uploadService.listUploads as any).mockResolvedValueOnce([...mockUploads, newUploadRecord]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-upload-input');
    const validFile = new File(['data'], 'operations_batch.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const uploadBtn = await screen.findByRole('button', { name: /Upload file to server/i });
    await userEvent.click(uploadBtn);

    await waitFor(() => {
      expect(uploadService.uploadFile).toHaveBeenCalledWith(validFile);
    });

    await waitFor(() => {
      expect(screen.getByText(/"operations_batch.csv" uploaded successfully/i)).toBeInTheDocument();
    });
  });

  it('9. 409 duplicate file conflict displays user-friendly message', async () => {
    (uploadService.uploadFile as any).mockRejectedValueOnce(
      new ApiError('File already uploaded.', 409, { detail: 'File already uploaded.' })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-upload-input');
    const duplicateFile = new File(['data'], 'duplicate.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [duplicateFile] } });

    const uploadBtn = await screen.findByRole('button', { name: /Upload file to server/i });
    await userEvent.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByText('Duplicate File Detected')).toBeInTheDocument();
      expect(screen.getByText(/This file has already been uploaded for this company/i)).toBeInTheDocument();
    });
  });

  it('10. 403 forbidden error displays access restricted message', async () => {
    (uploadService.uploadFile as any).mockRejectedValueOnce(
      new ApiError('Forbidden', 403, { detail: 'Forbidden' })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-upload-input');
    const validFile = new File(['data'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const uploadBtn = await screen.findByRole('button', { name: /Upload file to server/i });
    await userEvent.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(screen.getByText(/You do not have permission to perform this operation/i)).toBeInTheDocument();
    });
  });

  it('11. Triggering processing calls uploadService.processUpload and opens result modal', async () => {
    (uploadService.processUpload as any).mockResolvedValueOnce({
      ...mockUploads[0],
      status: 'completed',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('factory_production_q3.csv')).toBeInTheDocument();
    });

    const processBtn = screen.getByRole('button', { name: /Process factory_production_q3.csv/i });
    await userEvent.click(processBtn);

    await waitFor(() => {
      expect(uploadService.processUpload).toHaveBeenCalledWith('up-1111-2222');
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-processing-result-modal')).toBeInTheDocument();
      expect(screen.getByText('Ingestion Completed')).toBeInTheDocument();
      expect(screen.getByTestId('view-dashboard-btn')).toBeInTheDocument();
      expect(screen.getByText('View Dashboard')).toBeInTheDocument();
    });
  });

  it('12. Viewing details of a failed upload displays diagnostic error message', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('inventory_corrupted.xml')).toBeInTheDocument();
    });

    const detailsBtn = screen.getByRole('button', { name: /View details for inventory_corrupted.xml/i });
    await userEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('upload-processing-result-modal')).toBeInTheDocument();
      expect(screen.getByText('Processing Failed')).toBeInTheDocument();
      expect(screen.getByText(/XML syntax error at line 42/i)).toBeInTheDocument();
    });
  });

  it('13. Empty upload state displays clean guidance', async () => {
    (uploadService.listUploads as any).mockResolvedValueOnce([]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('uploads-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Files Uploaded')).toBeInTheDocument();
    });
  });

  it('14. Non-admin user sees Standard User — Read Only and cannot click upload or process', async () => {
    const { authService } = await import('../services/authService');
    (authService.getCurrentUser as any).mockResolvedValueOnce({
      id: 'user-viewer-1',
      email: 'viewer@acme.corp',
      role: 'viewer',
      company_id: 'tenant-ind-12345',
      full_name: 'Standard Viewer',
      status: 'active',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Standard User — Read Only')).toBeInTheDocument();
      expect(screen.getByText(/Administrator permissions are required to upload/i)).toBeInTheDocument();
    });

    // In read-only mode, process buttons should NOT be present in history table
    expect(screen.queryByRole('button', { name: /Process factory_production_q3.csv/i })).not.toBeInTheDocument();
  });

  it('15. Tenant isolation invariant — no company_id selector or input exists in the UI', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('File Upload & Data Ingestion')).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText(/Enter Tenant ID/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Select Company/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Company ID override/i)).not.toBeInTheDocument();
  });
});
