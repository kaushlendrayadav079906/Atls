import { apiClient } from './apiClient';
import { isDemoMode } from '../config';
import { demoAiActions } from './demoData';
import type { AiActionItem, RiskItem, ExecutiveBriefingEntity, AIAnalysisJob } from '../types';

export const aiRiskService = {
  getActions: async (status?: string, severity?: string): Promise<AiActionItem[]> => {
    if (isDemoMode()) {
      return Promise.resolve(demoAiActions);
    }
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<AiActionItem[]>(`/ai/actions${query}`);
  },

  resolveAction: async (actionId: string): Promise<AiActionItem> => {
    if (isDemoMode()) {
      const found = demoAiActions.find((a) => a.id === actionId);
      if (found) {
        found.status = 'completed';
        found.resolved_at = new Date().toISOString();
        return Promise.resolve(found);
      }
      throw new Error('Action not found');
    }
    return apiClient.post<AiActionItem>(`/ai/actions/${actionId}/resolve`);
  },

  getRisks: async (severity?: string, status?: string): Promise<RiskItem[]> => {
    if (isDemoMode()) {
      return Promise.resolve([]);
    }
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<RiskItem[]>(`/risks${query}`);
  },

  getLatestBriefing: async (): Promise<ExecutiveBriefingEntity | null> => {
    if (isDemoMode()) {
      return Promise.resolve({
        id: 'briefing-demo',
        company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
        generated_at: new Date().toISOString(),
        summary_text:
          'Operating performance across plants is stable. Profit margins remain resilient at 28.27% with minimal overdue exposure.',
        critical_issues: [],
        business_impact: ['Steady production yield across primary facilities.'],
        priority_actions: [
          { title: 'Ingot allocation', action: 'Transfer buffer raw materials' },
        ],
        created_at: new Date().toISOString(),
      });
    }
    try {
      return await apiClient.get<ExecutiveBriefingEntity>('/briefings/latest');
    } catch {
      return null;
    }
  },

  getBriefings: async (limit = 10, offset = 0): Promise<ExecutiveBriefingEntity[]> => {
    if (isDemoMode()) {
      const latest = await aiRiskService.getLatestBriefing();
      return latest ? [latest] : [];
    }
    return apiClient.get<ExecutiveBriefingEntity[]>(`/briefings?limit=${limit}&offset=${offset}`);
  },

  startAnalysisJob: async (factoryId?: string): Promise<AIAnalysisJob> => {
    if (isDemoMode()) {
      return Promise.resolve({
        job_id: 'job-demo-123',
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    }
    const query = factoryId ? `?factory_id=${factoryId}` : '';
    return apiClient.post<AIAnalysisJob>(`/ai/run-analysis${query}`);
  },

  getJobStatus: async (jobId: string): Promise<AIAnalysisJob> => {
    if (isDemoMode()) {
      return Promise.resolve({
        job_id: jobId,
        status: 'completed',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        result_summary: {
          overall_score: 18.5,
          overall_severity: 'LOW',
          persisted_risks: 3,
          persisted_actions: 3,
        },
      });
    }
    return apiClient.get<AIAnalysisJob>(`/ai/jobs/${jobId}`);
  },
};

