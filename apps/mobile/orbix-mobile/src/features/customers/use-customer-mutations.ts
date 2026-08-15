import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/use-auth';
import { customersRepository, type Customer } from '@/repositories/customers-repository';
import { toUserMessage } from '@/utils/error-message';

import type { CreateCustomerRequest, UpdateCustomerRequest } from '@/dto/customers.dto';

export function useCreateCustomer() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Customer, unknown, CreateCustomerRequest>({
    mutationFn: (request) => customersRepository.create(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers', 'list', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useUpdateCustomer(id: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Customer, unknown, UpdateCustomerRequest>({
    mutationFn: (request) => customersRepository.update(id, request),
    onSuccess: (customer) => {
      queryClient.setQueryData(['customers', 'detail', session?.tenant?.id, id], customer);
      void queryClient.invalidateQueries({ queryKey: ['customers', 'list', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useDeleteCustomer() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, unknown, string>({
    mutationFn: (id) => customersRepository.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers', 'list', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}
