/**
 * Phase 9 — TanStack Query.
 *
 * Central QueryClient with conservative defaults for a mobile client:
 *   - Controlled retry: don't retry auth/client errors (4xx); back off on the rest.
 *   - Cache policy: short stale window + longer gc; refetch on reconnect.
 * Invalidation is left to feature hooks via `queryClient.invalidateQueries`.
 */
import { useState, type PropsWithChildren } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from '@tanstack/react-query';
import axios from 'axios';

const queryConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — treat data as fresh to avoid refetch storms
      gcTime: 5 * 60_000, // 5min cache retention
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry client errors (401/403/404/422…) — only transient ones.
        if (axios.isAxiosError(error)) {
          const status = error.response?.status ?? 0;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
    },
    mutations: {
      retry: 0,
    },
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient(queryConfig);
}

export function QueryProvider({ children }: PropsWithChildren) {
  // One client per mount, kept stable across re-renders.
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
