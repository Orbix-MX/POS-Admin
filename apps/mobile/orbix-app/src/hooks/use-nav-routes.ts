import { useMemo } from 'react';
import { useDeviceSession } from '@/hooks/use-device-session';
import { buildCapabilities, type Capabilities } from '@/lib/capabilities';
import { buildNavigation, type TabRoute } from '@/constants/navigation';

/**
 * Resolves the current tenant + operator capabilities from the session. Single
 * entry point for screens/flows that need to branch on what's enabled — never
 * branch on the raw tenant.
 */
export function useCapabilities(): Capabilities {
  const { tenant, permissions } = useDeviceSession();
  return useMemo(() => buildCapabilities(tenant, permissions), [tenant, permissions]);
}

/**
 * Visible tab routes for the current tenant. Mesas is hidden entirely when the
 * tenant runs counter-only / has no tables module; Comandas becomes the primary
 * route. Table service / hybrid keep Mesas.
 */
export function useNavRoutes(): TabRoute[] {
  const capabilities = useCapabilities();
  return useMemo(() => buildNavigation(capabilities), [capabilities]);
}
