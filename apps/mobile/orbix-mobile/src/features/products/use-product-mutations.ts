import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/use-auth';
import { categoriesRepository, productsRepository, type Product } from '@/repositories/products-repository';
import { toUserMessage } from '@/utils/error-message';

import type { CategoryDto, CreateCategoryRequest, CreateProductRequest, UpdateProductRequest } from '@/dto/products.dto';

export function useCreateProduct() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Product, unknown, CreateProductRequest>({
    mutationFn: (request) => productsRepository.create(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products', 'list', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useUpdateProduct(id: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Product, unknown, UpdateProductRequest>({
    mutationFn: (request) => productsRepository.update(id, request),
    onSuccess: (product) => {
      queryClient.setQueryData(['products', 'detail', session?.tenant?.id, id], product);
      void queryClient.invalidateQueries({ queryKey: ['products', 'list', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useCreateCategory() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CategoryDto, unknown, CreateCategoryRequest>({
    mutationFn: (request) => categoriesRepository.create(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories', 'list', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useDeleteProduct() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, unknown, string>({
    mutationFn: (id) => productsRepository.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products', 'list', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}
