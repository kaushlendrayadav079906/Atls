import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';
import type { GstValuesResponse } from '../types';

export const GST_VALUES_KEY = ['gst-values'] as const;

export function useGstValues() {
  return useQuery<GstValuesResponse>({
    queryKey: GST_VALUES_KEY,
    queryFn: api.getAllowedGstValues,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
