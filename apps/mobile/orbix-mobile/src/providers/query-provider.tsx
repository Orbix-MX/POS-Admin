/**
 * TanStack Query with an MMKV-backed cache, so previously loaded data is on
 * screen instantly at cold start and still readable with no connection.
 */
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, type ReactNode } from 'react';

import { networkStatus } from '@/services/api';
import { persistOptions, queryClient } from '@/services/query/query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  // Bridges NetInfo into `onlineManager`, so queries pause offline and refetch
  // automatically when connectivity returns.
  useEffect(() => networkStatus.start(), []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
