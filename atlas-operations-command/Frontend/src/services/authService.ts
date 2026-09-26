import { apiClient } from './apiClient';
import type { LoginResponse, RegisterRequestPayload, RegisterResponsePayload, User } from '../types';

export const authService = {
  register: async (payload: RegisterRequestPayload): Promise<RegisterResponsePayload> => {
    return apiClient.post<RegisterResponsePayload>(
      '/auth/register',
      payload,
      { requiresAuth: false }
    );
  },

  login: async (companyName: string, email: string, password: string): Promise<LoginResponse> => {
    const data = await apiClient.post<LoginResponse>(
      '/auth/login',
      {
        company_name: companyName,
        email,
        password,
      },
      { requiresAuth: false }
    );
    if (data.access_token) {
      apiClient.setToken(data.access_token);
    }
    return data;
  },

  getCurrentUser: async (): Promise<User> => {
    return apiClient.get<User>('/auth/me');
  },

  logout: () => {
    apiClient.clearToken();
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('atlasops_token');
  },
};

export { localizationService } from './localizationService';

