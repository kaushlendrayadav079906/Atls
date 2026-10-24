import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api/v1',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  (config as any)._startTime = performance.now();
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const startTime = (response.config as any)?._startTime;
    if (startTime) {
      (response as any).durationMs = Math.round(performance.now() - startTime);
    }
    return response;
  },
  (error) => {
    const startTime = (error.config as any)?._startTime;
    if (startTime) {
      (error as any).durationMs = Math.round(performance.now() - startTime);
    }
    const isAuthLogin = error.config?.url?.includes('/auth/login');
    const isOnLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (!isAuthLogin && !isOnLoginPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
