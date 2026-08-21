import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { customersRepository, type CustomerListParams } from '@/repositories/customers-repository';

export function useCustomers(params: CustomerListParams) {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: ['customers', 'list', session?.tenant?.id, params],
    queryFn: () => customersRepository.list(params),
    enabled: Boolean(session?.tenant) && can('customers:view'),
    staleTime: 30 * 1000,
  });
}

export function useCustomer(id: string | undefined) {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: ['customers', 'detail', session?.tenant?.id, id],
    queryFn: () => customersRepository.getById(id as string),
    enabled: Boolean(session?.tenant) && Boolean(id) && can('customers:view'),
  });
}
