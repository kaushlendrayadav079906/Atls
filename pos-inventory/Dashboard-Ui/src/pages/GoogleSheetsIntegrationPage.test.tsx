import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  GoogleSheetsIntegrationPage,
  maskSpreadsheetId,
  extractSpreadsheetIdFromUrl,
} from './GoogleSheetsIntegrationPage';
import { googleSheetsApi } from '../api/googleSheets';
import * as AuthContextModule from '../contexts/AuthContext';

describe('GoogleSheetsIntegrationPage Component & Utilities', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'admin-1',
        username: 'Admin',
        email: 'admin@atlas.local',
        name: 'Administrator',
        role: 'admin',
        is_active: true,
        token_version: 1,
        permissions: ['*'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn(() => true),
      canAccess: vi.fn(() => true),
    });
  });

  // 1. Pure Helper Function Tests
  describe('maskSpreadsheetId & extractSpreadsheetIdFromUrl helpers', () => {
    it('correctly masks spreadsheet IDs for privacy', () => {
      expect(maskSpreadsheetId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms')).toBe('1BxiM...upms');
      expect(maskSpreadsheetId('short')).toBe('short');
      expect(maskSpreadsheetId('')).toBe('—');
      expect(maskSpreadsheetId(null)).toBe('—');
    });

    it('extracts spreadsheet ID from various valid Google Sheets URLs', () => {
      const id = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      expect(extractSpreadsheetIdFromUrl(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
      expect(extractSpreadsheetIdFromUrl(`https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`)).toBe(id);
      expect(extractSpreadsheetIdFromUrl(`https://docs.google.com/spreadsheets/d/${id}`)).toBe(id);
      expect(extractSpreadsheetIdFromUrl(`https://docs.google.com/spreadsheets/u/1/d/${id}/edit`)).toBe(id);
      expect(extractSpreadsheetIdFromUrl(id)).toBe(id);
    });

    it('returns empty string for invalid URLs', () => {
      expect(extractSpreadsheetIdFromUrl('https://example.com/not-a-sheet')).toBe('');
      expect(extractSpreadsheetIdFromUrl('')).toBe('');
      expect(extractSpreadsheetIdFromUrl('invalid_short')).toBe('');
    });
  });

  // 2. Component Rendering in Disconnected / Not Connected State
  it('renders Google Sheets integration card, form fields, and Not Connected state', () => {
    const mockStatus = {
      configured: false,
      connection_status: 'not_connected' as const,
      spreadsheet_id: null,
      spreadsheet_name: null,
      spreadsheet_url: null,
      worksheet_name: null,
      header_row: 1,
      data_start_row: 2,
      last_tested_at: null,
      last_successful_sync_at: null,
      service_account_configured: true,
      service_account_email: 'atlas-sa@project.iam.gserviceaccount.com',
      error_message: null,
      worksheets: [],
    };
    queryClient.setQueryData(['google-sheets-status'], mockStatus);
    vi.spyOn(googleSheetsApi, 'getStatus').mockResolvedValue(mockStatus);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GoogleSheetsIntegrationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Header & Brand
    expect(html).toContain('Google Sheets Integration');
    expect(html).toContain('Phase 1 Foundation');
    expect(html).toContain('Not Connected');

    // Step-by-step expandable guide contains instructions
    expect(html).toContain('How to Connect Google Sheets');

    // Form inputs and buttons
    expect(html).toContain('Spreadsheet URL');
    expect(html).toContain('Extracted Spreadsheet ID');
    expect(html).toContain('Worksheet Name');
    expect(html).toContain('Header Row (1-based)');
    expect(html).toContain('Data Start Row');

    // Buttons
    expect(html).toContain('Connect Google Sheet');
    expect(html).toContain('Test Connection');
    expect(html).toContain('Preview Headers');
    expect(html).toContain('Save Configuration');

    // Stock Configuration Preview section
    expect(html).toContain('Stock Configuration Sheet Data Preview');
    expect(html).toContain('Fetch Stock Records');

    // Security callout
    expect(html).toContain('Phase 1 Security:');
  });

  // 3. Component Rendering in Connected State
  it('renders Connected status, spreadsheet title, and masked ID when connected', () => {
    const mockStatus = {
      configured: true,
      connection_status: 'connected' as const,
      spreadsheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      spreadsheet_name: 'Company Stock Master 2026',
      spreadsheet_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
      worksheet_name: 'Stock Configuration',
      header_row: 1,
      data_start_row: 2,
      last_tested_at: '2026-11-07T10:30:00Z',
      last_successful_sync_at: null,
      service_account_configured: true,
      service_account_email: 'atlas-sa@project.iam.gserviceaccount.com',
      error_message: null,
      worksheets: ['Stock Configuration', 'Raw Materials', 'Vendors'],
    };
    queryClient.setQueryData(['google-sheets-status'], mockStatus);
    vi.spyOn(googleSheetsApi, 'getStatus').mockResolvedValue(mockStatus);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GoogleSheetsIntegrationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Connected');
    expect(html).toContain('Company Stock Master 2026');
    expect(html).toContain('1BxiM...upms');
    expect(html).toContain('Stock Configuration');
    expect(html).toContain('Disconnect');
  });

  // 4. Component Rendering in Error State
  it('renders Connection Error badge when status is error', () => {
    const mockStatus = {
      configured: true,
      connection_status: 'error' as const,
      spreadsheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      spreadsheet_name: 'Broken Sheet',
      spreadsheet_url: '',
      worksheet_name: 'Stock',
      header_row: 1,
      data_start_row: 2,
      last_tested_at: '2026-11-07T11:00:00Z',
      last_successful_sync_at: null,
      service_account_configured: true,
      service_account_email: 'sa@test.com',
      error_message: 'Permission denied. Please share with service account.',
      worksheets: [],
    };
    queryClient.setQueryData(['google-sheets-status'], mockStatus);
    vi.spyOn(googleSheetsApi, 'getStatus').mockResolvedValue(mockStatus);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GoogleSheetsIntegrationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Connection Error');
  });

  // 5. Navigation Tab Links
  it('renders Settings tab navigation for Users & Roles and Google Sheets', () => {
    vi.spyOn(googleSheetsApi, 'getStatus').mockResolvedValue({
      configured: false,
      connection_status: 'not_connected',
      header_row: 1,
      data_start_row: 2,
      service_account_configured: false,
      worksheets: [],
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GoogleSheetsIntegrationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Users &amp; Roles');
    expect(html).toContain('Google Sheets');
  });

  // 6. Component Rendering in API Not Enabled State
  it('renders API Not Enabled badge and external activation banner', () => {
    const mockStatus = {
      configured: true,
      connection_status: 'api_not_enabled' as const,
      spreadsheet_id: '1bJiBxnYxq1TCCgdwPDWGPBcpeKTLYEvP',
      spreadsheet_name: 'Company Stock Master',
      spreadsheet_url: 'https://docs.google.com/spreadsheets/d/1bJiBxnYxq1TCCgdwPDWGPBcpeKTLYEvP/edit',
      worksheet_name: 'Stock Configuration',
      header_row: 1,
      data_start_row: 2,
      last_tested_at: '2026-11-12T10:00:00Z',
      last_successful_sync_at: null,
      service_account_configured: true,
      service_account_email: 'atlas-google-sheets@gen-lang-client-0920050876.iam.gserviceaccount.com',
      error_message: 'Google Sheets API has not been used in project 767613266689 before or it is disabled.',
      activation_url: 'https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=767613266689',
      worksheets: [],
    };
    queryClient.setQueryData(['google-sheets-status'], mockStatus);
    vi.spyOn(googleSheetsApi, 'getStatus').mockResolvedValue(mockStatus);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GoogleSheetsIntegrationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('API Not Enabled');
    expect(html).toContain('Google Sheets API is Disabled in Google Cloud');
    expect(html).toContain('Project 767613266689');
    expect(html).toContain('Enable Google Sheets API');
    expect(html).toContain('https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=767613266689');
  });

  // 7. Component Rendering in Permission Denied State
  it('renders Permission Denied badge and copy email helper banner', () => {
    const mockStatus = {
      configured: true,
      connection_status: 'permission_denied' as const,
      spreadsheet_id: '1bJiBxnYxq1TCCgdwPDWGPBcpeKTLYEvP',
      spreadsheet_name: 'Company Stock Master',
      spreadsheet_url: '',
      worksheet_name: 'Stock Configuration',
      header_row: 1,
      data_start_row: 2,
      last_tested_at: '2026-11-12T10:00:00Z',
      last_successful_sync_at: null,
      service_account_configured: true,
      service_account_email: 'atlas-google-sheets@gen-lang-client-0920050876.iam.gserviceaccount.com',
      error_message: 'Permission denied (HTTP 403).',
      worksheets: [],
    };
    queryClient.setQueryData(['google-sheets-status'], mockStatus);
    vi.spyOn(googleSheetsApi, 'getStatus').mockResolvedValue(mockStatus);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GoogleSheetsIntegrationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Permission Denied');
    expect(html).toContain('Spreadsheet Permission Denied (HTTP 403)');
    expect(html).toContain('Copy Service Account Email');
  });

  // 8. User-Friendly Instructions & Helper Texts Verification
  it('renders all clear user-friendly descriptions and field instructions', () => {
    const mockStatus = {
      configured: false,
      connection_status: 'not_connected' as const,
      spreadsheet_id: null,
      spreadsheet_name: null,
      spreadsheet_url: null,
      worksheet_name: null,
      header_row: 1,
      data_start_row: 2,
      last_tested_at: null,
      last_successful_sync_at: null,
      service_account_configured: true,
      service_account_email: 'atlas-sa@project.iam.gserviceaccount.com',
      error_message: null,
      worksheets: [],
    };
    queryClient.setQueryData(['google-sheets-status'], mockStatus);
    vi.spyOn(googleSheetsApi, 'getStatus').mockResolvedValue(mockStatus);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GoogleSheetsIntegrationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Section descriptions
    expect(html).toContain('Connect your Google Spreadsheet to ATLAS to display and manage Stock Configuration records.');
    expect(html).toContain('Enter your Google Spreadsheet link and select the worksheet that contains your stock records.');
    expect(html).toContain('This section shows the spreadsheet information detected by ATLAS.');
    expect(html).toContain('ATLAS checks your spreadsheet column names and matches them with Stock Configuration fields.');
    expect(html).toContain('Preview the actual records ATLAS retrieves from your selected Google Spreadsheet before using them in the Stock Configuration page.');
    expect(html).toContain('These records are fetched from your connected Google Spreadsheet.');

    // Field instructions
    expect(html).toContain('Paste the full URL copied from your Google Spreadsheet.');
    expect(html).toContain('Automatically generated from your spreadsheet URL. No manual entry required.');
    expect(html).toContain('Select the worksheet tab containing your Stock Configuration data.');
    expect(html).toContain('Enter the row number containing your column names. Usually row 1.');
    expect(html).toContain('Enter the row number where your actual stock records begin. Usually row 2.');

    // Button titles & descriptions
    expect(html).toContain('Connect ATLAS to your selected spreadsheet.');
    expect(html).toContain('Check whether ATLAS can access your spreadsheet.');
    expect(html).toContain('Check whether ATLAS recognizes your spreadsheet columns.');
    expect(html).toContain('Save this spreadsheet as the active Stock Configuration source.');

    // Step-by-Step Guide title
    expect(html).toContain('How to Connect Google Sheets');

    // Permission Mode indicator
    expect(html).toContain('Spreadsheet Permission Mode');
    expect(html).toContain('Not Verified');
    expect(html).toContain('ATLAS has not successfully verified write permission.');
  });

  // 9. Permission Mode in Connected State (Read & Write vs Read Only)
  it('renders Read & Write permission mode when connected with write permissions', () => {
    const mockStatus = {
      configured: true,
      connection_status: 'connected' as const,
      spreadsheet_id: '1HN-jiygiOac0Ef5Tuw51mA8IWPIisz_OmUec2maicsE',
      spreadsheet_name: 'ATLAS_Stock_Configuration_Filled',
      spreadsheet_url: 'https://docs.google.com/spreadsheets/d/1HN-jiygiOac0Ef5Tuw51mA8IWPIisz_OmUec2maicsE/edit',
      worksheet_name: 'Stock Configuration',
      header_row: 1,
      data_start_row: 2,
      last_tested_at: '2026-11-12T12:00:00Z',
      last_successful_sync_at: null,
      service_account_configured: true,
      service_account_email: 'atlas-sa@project.iam.gserviceaccount.com',
      error_message: null,
      worksheets: ['Stock Configuration'],
      read_only: false,
    };
    queryClient.setQueryData(['google-sheets-status'], mockStatus);
    vi.spyOn(googleSheetsApi, 'getStatus').mockResolvedValue(mockStatus);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GoogleSheetsIntegrationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Read &amp; Write');
    expect(html).toContain('ATLAS can view, add, and update permitted spreadsheet records.');
    expect(html).toContain('SAP Write Protection Active:');
  });
});
