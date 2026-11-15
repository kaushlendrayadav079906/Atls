import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryClient } from '../App';

describe('React Query Caching & Page Navigation Performance', () => {
  it('has global staleTime set to 5 minutes and gcTime set to 15 minutes', () => {
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000);
    expect(defaultOptions.queries?.gcTime).toBe(15 * 60 * 1000);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaultOptions.queries?.retry).toBe(1);
  });

  it('reuses cached data on page navigation without triggering duplicate fetches', async () => {
    const testClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 15 * 60 * 1000,
        },
      },
    });

    const mockFetcher = vi.fn().mockResolvedValue({ status: 'ok', items: [1, 2, 3] });

    // Step 1: Initial visit to Dashboard (fetches data)
    const result1 = await testClient.fetchQuery({
      queryKey: ['executiveCommand', 'all', 'monthly', '', ''],
      queryFn: mockFetcher,
    });
    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(result1).toEqual({ status: 'ok', items: [1, 2, 3] });

    // Step 2: Navigate to Sales & Finance (other queries)
    const salesFetcher = vi.fn().mockResolvedValue({ total: 10, items: [] });
    await testClient.fetchQuery({
      queryKey: ['sales', 'all_time', '', '', '', '', '', '', 0, 10],
      queryFn: salesFetcher,
    });
    expect(salesFetcher).toHaveBeenCalledTimes(1);

    // Step 3: Return to Dashboard within staleTime window (navigation back)
    const cachedState = testClient.getQueryState(['executiveCommand', 'all', 'monthly', '', '']);
    expect(cachedState?.fetchStatus).toBe('idle');
    expect(cachedState?.status).toBe('success');

    // Fetching again within stale window returns cached data without calling mockFetcher
    const result2 = await testClient.fetchQuery({
      queryKey: ['executiveCommand', 'all', 'monthly', '', ''],
      queryFn: mockFetcher,
    });
    expect(mockFetcher).toHaveBeenCalledTimes(1); // Still 1! No new network request issued!
    expect(result2).toBe(result1);
  });

  it('triggers manual refresh on demand when refetch is called', async () => {
    const testClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 15 * 60 * 1000,
        },
      },
    });

    const mockFetcher = vi.fn()
      .mockResolvedValueOnce({ version: 1 })
      .mockResolvedValueOnce({ version: 2 });

    await testClient.fetchQuery({
      queryKey: ['sales', 'all_time'],
      queryFn: mockFetcher,
    });
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    // Explicit manual refresh
    await testClient.refetchQueries({ queryKey: ['sales', 'all_time'] });
    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('isolates cache and clears all data on user logout/login', async () => {
    const testClient = new QueryClient();
    testClient.setQueryData(['sensitiveFinance', 'company-1'], { balance: 100000 });
    expect(testClient.getQueryData(['sensitiveFinance', 'company-1'])).toBeDefined();

    // User logout clears cache
    testClient.clear();
    expect(testClient.getQueryData(['sensitiveFinance', 'company-1'])).toBeUndefined();
  });

  it('mutation invalidates only affected queries, preserving unrelated cached pages', async () => {
    const testClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
        },
      },
    });

    testClient.setQueryData(['sales', 'all'], [{ id: 1 }]);
    testClient.setQueryData(['purchase-orders', 'all'], [{ id: 2 }]);

    // Invalidate sales after sale creation
    await testClient.invalidateQueries({ queryKey: ['sales'] });

    const salesState = testClient.getQueryState(['sales', 'all']);
    const poState = testClient.getQueryState(['purchase-orders', 'all']);

    expect(salesState?.isInvalidated).toBe(true);
    expect(poState?.isInvalidated).toBe(false); // Unrelated page remains valid!
  });
});
