import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/use-auth';
import {
  categoriesRepository,
  productsRepository,
  resolvePrimaryImage,
  type ImageAsset,
  type Product,
  type ProductImage,
} from '@/repositories/products-repository';
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

/**
 * Sube la foto del producto y refleja el resultado en la caché sin volver a
 * pedir el producto: el endpoint devuelve solo la imagen creada, y como
 * *reemplaza* la primaria anterior, el juego nuevo es exactamente esa imagen.
 * La lista se invalida para que su miniatura deje de ser la vieja (o el
 * marcador) sin esperar al `staleTime`.
 */
export function useUploadProductImage(productId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<ProductImage, unknown, ImageAsset>({
    mutationFn: (asset) => productsRepository.uploadImage(productId, asset),
    onSuccess: (image) => {
      queryClient.setQueryData(
        ['products', 'detail', session?.tenant?.id, productId],
        (current: Product | undefined) =>
          current ? { ...current, images: [image], primaryImage: image } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['products', 'list', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useDeleteProductImage(productId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, unknown, string>({
    mutationFn: (imageId) => productsRepository.removeImage(productId, imageId),
    onSuccess: (_result, imageId) => {
      queryClient.setQueryData(
        ['products', 'detail', session?.tenant?.id, productId],
        (current: Product | undefined) => {
          if (!current) return current;
          const images = current.images.filter((image) => image.id !== imageId);
          return { ...current, images, primaryImage: resolvePrimaryImage(images) };
        },
      );
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
