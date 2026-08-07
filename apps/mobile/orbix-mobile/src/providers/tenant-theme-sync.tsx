/**
 * Applies the active tenant's branding to the theme.
 *
 * Runs as a headless component rather than inside `ThemeProvider` so the theme
 * layer stays free of any dependency on auth or the network.
 *
 * Reads the cached branding synchronously on tenant change (instant re-skin),
 * then refetches in the background.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useThemeContext } from '@/hooks/use-theme';
import { themeRepository } from '@/repositories/theme-repository';
import { queryKeys } from '@/services/query/query-keys';
import { themeService } from '@/services/theme/theme-service';

export function TenantThemeSync() {
  const { session } = useAuth();
  const { setBranding } = useThemeContext();
  const tenantId = session?.tenant?.id;

  // Instant: whatever we already have on disk for this tenant.
  useEffect(() => {
    setBranding(themeService.getBranding(tenantId));
  }, [tenantId, setBranding]);

  const { data } = useQuery({
    queryKey: queryKeys.tenant.branding(tenantId ?? 'none'),
    queryFn: () => themeRepository.fetchCurrent(tenantId as string),
    enabled: Boolean(tenantId),
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (data) setBranding(data);
  }, [data, setBranding]);

  return null;
}
