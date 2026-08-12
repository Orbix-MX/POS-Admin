/**
 * Every query key in one place.
 *
 * Hierarchical arrays so a partial key invalidates a whole subtree, e.g.
 * `invalidateQueries({ queryKey: queryKeys.auth.all })`.
 */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    profile: () => [...queryKeys.auth.all, 'profile'] as const,
    capabilities: () => [...queryKeys.auth.all, 'capabilities'] as const,
  },
  catalogs: {
    all: ['catalogs'] as const,
    businessTypes: () => [...queryKeys.catalogs.all, 'business-types'] as const,
  },
  tenant: {
    all: ['tenant'] as const,
    branding: (tenantId: string) => [...queryKeys.tenant.all, 'branding', tenantId] as const,
  },
} as const;
