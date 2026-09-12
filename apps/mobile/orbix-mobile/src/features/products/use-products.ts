import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { categoriesRepository, productsRepository, type ProductListParams } from '@/repositories/products-repository';
import { queryKeys } from '@/services/query/query-keys';

export function useProducts(params: ProductListParams) {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: queryKeys.products.list(session?.tenant?.id, session?.branchId, params),
    queryFn: () => productsRepository.list(params),
    enabled: Boolean(session?.tenant) && can('products:view'),
    staleTime: 30 * 1000,
  });
}

export function useProduct(id: string | undefined) {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: queryKeys.products.detail(session?.tenant?.id, session?.branchId, id),
    queryFn: () => productsRepository.getById(id as string),
    enabled: Boolean(session?.tenant) && Boolean(id) && can('products:view'),
  });
}

/**
 * Only ever used as the category picker inside the product form — gated on
 * inventory access (`products:view`) rather than its own `categories:view`,
 * so a role that can manage products but wasn't separately granted
 * `categories:view` (e.g. seed.ts' Vendedor) doesn't see an empty picker.
 */
export function useCategories() {
  const { session } = useAuth();
  const { canAny } = usePermissions();

  return useQuery({
    queryKey: queryKeys.categories.list(session?.tenant?.id),
    queryFn: () => categoriesRepository.list(),
    enabled: Boolean(session?.tenant) && canAny('products:view', 'categories:view'),
    staleTime: 5 * 60 * 1000,
  });
}
