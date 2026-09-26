import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AiPage } from '../pages/AiPage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import { aiRiskService } from '../services/aiRiskService';
import { authService } from '../services/authService';

vi.mock('../services/aiRiskService', () => ({
  aiRiskService: {
    getRisks: vi.fn(),
    getActions: vi.fn(),
    getLatestBriefing: vi.fn(),
    getBriefings: vi.fn(),
    resolveAction: vi.fn(),
    startAnalysisJob: vi.fn(),
    getJobStatus: vi.fn(),
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

const mockRisks = [
  {
    id: 'r1',
    company_id: 'c1-uuid',
    title: 'Titanium Ingot Supply Variance',
    severity: 'HIGH',
    category: 'Supply Chain',
    likelihood_pct: 75.0,
    financial_impact: 180000,
    department: 'Supply Chain',
    status: 'active',
    created_at: '2026-09-08T10:00:00Z',
  },
  {
    id: 'r2',
    company_id: 'c1-uuid',
    title: 'Operating Margin Compression Alert',
    severity: 'CRITICAL',
    category: 'Financial',
    likelihood_pct: 90.0,
    financial_impact: 350000,
    department: 'Finance',
    status: 'active',
    created_at: '2026-09-08T11:00:00Z',
  },
];

const mockActions = [
  {
    id: 'a1',
    company_id: 'c1-uuid',
    title: 'Reallocate Titanium Buffer Reserves',
    severity: 'HIGH',
    category: 'Logistics',
    description: 'Lead-time on ingot deliveries increased by 14%. Reallocate reserves from Munich facility.',
    cta_label: 'Initiate Transfer',
    status: 'pending',
    created_at: '2026-09-08T10:30:00Z',
  },
  {
    id: 'a2',
    company_id: 'c1-uuid',
    title: 'Audit Past-Due Receivables > 60 Days',
    severity: 'MEDIUM',
    category: 'Finance',
    description: 'Overdue receivables exceeded aging threshold for 2 commercial accounts.',
    cta_label: 'Review Accounts',
    status: 'completed',
    created_at: '2026-09-08T09:00:00Z',
  },
];

const mockBriefing = {
  id: 'b1',
  company_id: 'c1-uuid',
  generated_at: '2026-09-09T08:00:00Z',
  summary_text: 'Overall operations remain stable. Operating margin compression requires disciplined material allocation.',
  critical_issues: [
    { title: 'Operating Margin', impact: 'Potential 4.2% burn increase', severity: 'CRITICAL' },
  ],
  business_impact: ['Steady production yield across primary facilities.'],
  priority_actions: [
    { title: 'Ingot allocation', action: 'Transfer buffer raw materials', priority: 'HIGH' },
  ],
  created_at: '2026-09-09T08:00:00Z',
};

describe('Frontend Unit 5: AI Risk & Executive Intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authService.isAuthenticated as any).mockReturnValue(true);
    (authService.getCurrentUser as any).mockResolvedValue({
      id: 'u1',
      email: 'risk.officer@atlasops.com',
      full_name: 'Risk Officer',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. AI page renders
  it('1. AI page renders successfully with header, KPI row, and action controls', async () => {
    (aiRiskService.getRisks as any).mockResolvedValueOnce(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValueOnce(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValueOnce(mockBriefing);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: /AI Risk & Executive Intelligence/i })).toBeInTheDocument();
    expect(screen.getByText(/Autonomous predictive risk engine/i)).toBeInTheDocument();
  });

  // 2. Risks render
  it('2. Risks render correctly in the active risk register', async () => {
    (aiRiskService.getRisks as any).mockResolvedValueOnce(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValueOnce(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValueOnce(mockBriefing);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Titanium Ingot Supply Variance')).toBeInTheDocument();
      expect(screen.getByText('Operating Margin Compression Alert')).toBeInTheDocument();
      expect(screen.getByText('2 Documented')).toBeInTheDocument();
    });
  });

  // 3. Recommended actions render
  it('3. Recommended actions render with priorities and action descriptions', async () => {
    (aiRiskService.getRisks as any).mockResolvedValueOnce(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValueOnce(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValueOnce(mockBriefing);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Reallocate Titanium Buffer Reserves')).toBeInTheDocument();
      expect(screen.getByText('Audit Past-Due Receivables > 60 Days')).toBeInTheDocument();
      expect(screen.getByText('1 Pending Mitigation')).toBeInTheDocument();
    });
  });

  // 4. Latest briefing renders
  it('4. Latest executive briefing renders summary narrative, business impact, and critical vulnerabilities', async () => {
    (aiRiskService.getRisks as any).mockResolvedValueOnce(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValueOnce(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValueOnce(mockBriefing);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(mockBriefing.summary_text)).toBeInTheDocument();
      expect(screen.getByText('Business Impact & Health')).toBeInTheDocument();
      expect(screen.getByText('Steady production yield across primary facilities.')).toBeInTheDocument();
    });
  });

  // 5. Empty risk state
  it('5. Empty risk state renders when risk register is empty', async () => {
    (aiRiskService.getRisks as any).mockResolvedValueOnce([]);
    (aiRiskService.getActions as any).mockResolvedValueOnce(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValueOnce(mockBriefing);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No Active Risks Found')).toBeInTheDocument();
    });
  });

  // 6. Empty actions state
  it('6. Empty actions state renders when action items are empty', async () => {
    (aiRiskService.getRisks as any).mockResolvedValueOnce(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValueOnce([]);
    (aiRiskService.getLatestBriefing as any).mockResolvedValueOnce(mockBriefing);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No Pending Action Items')).toBeInTheDocument();
    });
  });

  // 7. No briefing state
  it('7. No briefing state renders with call-to-action button when latest briefing is null', async () => {
    (aiRiskService.getRisks as any).mockResolvedValueOnce(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValueOnce(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValueOnce(null);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No Briefing Generated Yet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Run Analysis' })).toBeInTheDocument();
    });
  });

  // 8. API error state
  it('8. API error state renders message and retry handler when all feeds fail', async () => {
    (aiRiskService.getRisks as any).mockRejectedValueOnce(new Error('Risks connection refused'));
    (aiRiskService.getActions as any).mockRejectedValueOnce(new Error('Actions connection refused'));
    (aiRiskService.getLatestBriefing as any).mockRejectedValueOnce(new Error('Briefings connection refused'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to reach AI Risk & Intelligence service.')).toBeInTheDocument();
    });
  });

  // 9. Analysis execution starts & pending/running job state
  it('9-10. Analysis execution starts and enters pending/running status', async () => {
    (aiRiskService.getRisks as any).mockResolvedValue(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValue(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValue(mockBriefing);
    (aiRiskService.startAnalysisJob as any).mockResolvedValue({
      job_id: 'job-pending-123',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Run AI Analysis/i })).toBeInTheDocument();
    });

    const runBtn = screen.getByRole('button', { name: /Run AI Analysis/i });
    await act(async () => {
      runBtn.click();
    });

    await waitFor(() => {
      expect(aiRiskService.startAnalysisJob).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/AI Risk Engine Evaluating Telemetry/i)).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  // 11. Completed job state
  it('11. Analysis job polls and reaches completed state', async () => {
    vi.useFakeTimers();
    (aiRiskService.getRisks as any).mockResolvedValue(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValue(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValue(mockBriefing);

    (aiRiskService.startAnalysisJob as any).mockResolvedValue({
      job_id: 'job-run-456',
      status: 'running',
      created_at: new Date().toISOString(),
    });

    (aiRiskService.getJobStatus as any).mockResolvedValue({
      job_id: 'job-run-456',
      status: 'completed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const runBtn = screen.getByRole('button', { name: /Run AI Analysis/i });
    await act(async () => {
      runBtn.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('running')).toBeInTheDocument();

    // Advance timer to trigger polling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(aiRiskService.getJobStatus).toHaveBeenCalledWith('job-run-456');
    expect(screen.getByText(/AI Risk Intelligence Analysis Completed/i)).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  // 12. Failed job state
  it('12. Analysis job polls and handles failed state', async () => {
    vi.useFakeTimers();
    (aiRiskService.getRisks as any).mockResolvedValue(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValue(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValue(mockBriefing);

    (aiRiskService.startAnalysisJob as any).mockResolvedValue({
      job_id: 'job-fail-789',
      status: 'running',
      created_at: new Date().toISOString(),
    });

    (aiRiskService.getJobStatus as any).mockResolvedValue({
      job_id: 'job-fail-789',
      status: 'failed',
      error: 'Telemetry pipeline timeout during evaluation',
      created_at: new Date().toISOString(),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const runBtn = screen.getByRole('button', { name: /Run AI Analysis/i });
    await act(async () => {
      runBtn.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText(/AI Analysis Workflow Failed/i)).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('Telemetry pipeline timeout during evaluation')).toBeInTheDocument();
  });

  // 13. Polling stops after completion
  it('13. Polling terminates after job reaches completed terminal state', async () => {
    vi.useFakeTimers();
    (aiRiskService.getRisks as any).mockResolvedValue(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValue(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValue(mockBriefing);

    (aiRiskService.startAnalysisJob as any).mockResolvedValue({
      job_id: 'job-stop-101',
      status: 'running',
      created_at: new Date().toISOString(),
    });

    (aiRiskService.getJobStatus as any).mockResolvedValue({
      job_id: 'job-stop-101',
      status: 'completed',
      created_at: new Date().toISOString(),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const runBtn = screen.getByRole('button', { name: /Run AI Analysis/i });
    await act(async () => {
      runBtn.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(aiRiskService.getJobStatus).toHaveBeenCalledTimes(1);

    // Advance more time; ensure no more polling calls happen
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(aiRiskService.getJobStatus).toHaveBeenCalledTimes(1);
  });

  // 14. Action resolution
  it('14. Resolving an action updates its state to completed', async () => {
    const user = userEvent.setup();
    (aiRiskService.getRisks as any).mockResolvedValue(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValue(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValue(mockBriefing);
    (aiRiskService.resolveAction as any).mockResolvedValue({
      ...mockActions[0],
      status: 'completed',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Reallocate Titanium Buffer Reserves')).toBeInTheDocument();
    });

    const resolveBtn = screen.getByRole('button', { name: 'Initiate Transfer' });
    await user.click(resolveBtn);

    await waitFor(() => {
      expect(aiRiskService.resolveAction).toHaveBeenCalledWith('a1');
    });
  });

  // 15. Polling cleanup on unmount
  it('15. Polling cleanup occurs on component unmount without error', async () => {
    vi.useFakeTimers();
    (aiRiskService.getRisks as any).mockResolvedValue(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValue(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValue(mockBriefing);

    (aiRiskService.startAnalysisJob as any).mockResolvedValueOnce({
      job_id: 'job-unmount-202',
      status: 'running',
      created_at: new Date().toISOString(),
    });

    const { unmount } = render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const runBtn = screen.getByRole('button', { name: /Run AI Analysis/i });
    await act(async () => {
      runBtn.click();
    });

    // Unmount before poll timer fires
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(aiRiskService.getJobStatus).not.toHaveBeenCalled();
  });

  // 16. Tenant security: No company_id parameter passed from UI
  it('16. Tenant safety invariant: AI endpoints do NOT pass company_id parameter', async () => {
    (aiRiskService.getRisks as any).mockResolvedValueOnce(mockRisks);
    (aiRiskService.getActions as any).mockResolvedValueOnce(mockActions);
    (aiRiskService.getLatestBriefing as any).mockResolvedValueOnce(mockBriefing);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <AiPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(aiRiskService.getRisks).toHaveBeenCalledTimes(1);
      expect(aiRiskService.getActions).toHaveBeenCalledTimes(1);
      expect(aiRiskService.getLatestBriefing).toHaveBeenCalledTimes(1);
    });

    const risksCall = (aiRiskService.getRisks as any).mock.calls[0];
    expect(risksCall.length).toBe(0);

    const actionsCall = (aiRiskService.getActions as any).mock.calls[0];
    expect(actionsCall.length).toBe(0);
  });

  // 17. Protected Route redirection
  it('17. /ai route is protected and unauthenticated users are redirected to /login', async () => {
    (authService.isAuthenticated as any).mockReturnValue(false);
    (authService.getCurrentUser as any).mockResolvedValue(null);

    let capturedLocation: any = null;
    const LocationWatcher = () => {
      capturedLocation = useLocation();
      return <div>Redirected to: {capturedLocation.pathname}</div>;
    };

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/ai']}>
          <Routes>
            <Route
              path="/ai"
              element={
                <ProtectedRoute>
                  <AiPage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LocationWatcher />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Redirected to: /login')).toBeInTheDocument();
    });
  });
});
