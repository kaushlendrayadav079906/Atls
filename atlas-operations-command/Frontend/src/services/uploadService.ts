import { apiClient } from './apiClient';
import type { FileUpload } from '../types';

export const uploadService = {
  /**
   * Fetch all uploaded files for the authenticated company
   * GET /api/v1/uploads
   */
  async listUploads(): Promise<FileUpload[]> {
    return apiClient.get<FileUpload[]>('/uploads');
  },

  /**
   * Fetch metadata of a single upload by ID
   * GET /api/v1/uploads/{upload_id}
   */
  async getUpload(uploadId: string): Promise<FileUpload> {
    return apiClient.get<FileUpload>(`/uploads/${uploadId}`);
  },

  /**
   * Upload an operational/business data file (CSV, JSON, XML, TXT, XLSX)
   * POST /api/v1/uploads
   * Max size: 10 MiB (enforced by backend)
   */
  async uploadFile(file: File): Promise<FileUpload> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postFormData<FileUpload>('/uploads', formData);
  },

  /**
   * Trigger processing and staging for an uploaded file
   * POST /api/v1/uploads/{upload_id}/process
   * Target entity optional form parameter (e.g., 'Factory', 'FinancialTransaction')
   */
  async processUpload(uploadId: string, targetEntity?: string | null): Promise<FileUpload> {
    const formData = new FormData();
    if (targetEntity) {
      formData.append('target_entity', targetEntity);
    }
    return apiClient.postFormData<FileUpload>(`/uploads/${uploadId}/process`, formData);
  },
};
