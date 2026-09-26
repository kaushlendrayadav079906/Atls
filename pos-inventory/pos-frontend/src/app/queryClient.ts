import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const PRODUCT_CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
const persister = storage ? createSyncStoragePersister({ storage }) : null;

if (persister) {
  persistQueryClient({
    queryClient,
    persister,
    maxAge: PRODUCT_CACHE_MAX_AGE_MS,
    buster: 'v1',
  });
}

export const clearPersistedCache = () => {
  if (persister) {
    persister.removeClient();
  }
};
