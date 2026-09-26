import { useQuery } from '@tanstack/react-query';
import { getAlerts } from '../services/api';

export interface DashboardAlert {
  id: string;
  request_type: string;
  status: string;
  amount: number;
  reason: string;
  branch_id: string;
  created_at: string;
}

export const useAlerts = (enabled: boolean = false) => {
  return useQuery<DashboardAlert[]>({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    refetchInterval: 60000, // Poll every 60 seconds
    enabled,
  });
};
