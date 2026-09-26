export const isDemoMode = (): boolean => {
  return import.meta.env.VITE_DEMO_MODE === 'true';
};

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  appName: 'AtlasOps Cmd',
  version: '1.0.0',
  isDemoMode: isDemoMode(),
};
