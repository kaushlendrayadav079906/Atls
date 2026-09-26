import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, ApiError } from '../services/apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('manages auth tokens in localStorage', () => {
    expect(localStorage.getItem('atlasops_token')).toBeNull();
    apiClient.setToken('test-jwt-token');
    expect(localStorage.getItem('atlasops_token')).toBe('test-jwt-token');
    apiClient.clearToken();
    expect(localStorage.getItem('atlasops_token')).toBeNull();
  });

  it('attaches Authorization header when token is present', async () => {
    apiClient.setToken('mocked-token');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ status: 'ok' }),
    });
    global.fetch = mockFetch;

    const result = await apiClient.get('/test-endpoint');
    expect(result).toEqual({ status: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mocked-token',
        }),
      })
    );
  });

  it('throws ApiError on HTTP error status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Forbidden access' }),
    });
    global.fetch = mockFetch;

    await expect(apiClient.get('/forbidden')).rejects.toThrow(ApiError);
  });

  it('handles network failure gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(apiClient.get('/unreachable')).rejects.toThrow(ApiError);
  });
});
