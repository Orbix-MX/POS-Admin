/**
 * Ajuste de existencias.
 *
 * **El servidor recibe un delta, no un absoluto.** `PATCH /products/:id/stock`
 * con `{ quantity: 10 }` suma diez; con `-10` resta diez y rechaza la operación
 * si no hay suficiente. El guard de existencia lo aplica la base *dentro* de la
 * transacción, así que una venta concurrente no puede colar el stock en
 * negativo.
 *
 * Dos rutas distintas según el producto:
 *   - sin presentaciones  → `PATCH /products/:id/stock` (solo `SIMPLE` con
 *     `trackInventory`; el servidor resuelve la variante default);
 *   - con presentaciones  → `PATCH /products/:id/variants/:variantId/stock`,
 *     que es la única forma de mover una presentación concreta tras crearla.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/use-auth';
import { productsRepository, type Product } from '@/repositories/products-repository';
import { queryKeys } from '@/services/query/query-keys';
import { toUserMessage } from '@/utils/error-message';

export interface StockAdjustmentInput {
  /** Delta con signo: positivo entra, negativo sale. */
  quantity: number;
  /** Presentación concreta; ausente = el producto "sin variante". */
  variantId?: string;
}

export function useAdjustStock(productId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const tenantId = session?.tenant?.id;
  const branchId = session?.branchId;

  return useMutation<Product, unknown, StockAdjustmentInput>({
    mutationFn: ({ quantity, variantId }) =>
      variantId
        ? productsRepository.adjustVariantStock(productId, variantId, quantity)
        : productsRepository.adjustStock(productId, quantity),
    onSuccess: () => {
      // Se invalida en vez de escribir la respuesta en la caché: los dos
      // endpoints devuelven formas distintas —`/stock` da la fila pelada del
      // producto, sin imágenes ni variantes; `/variants/:id/stock` da el
      // `findOne` completo— y meter la primera en la caché del detalle borraría
      // la foto y las presentaciones de la pantalla.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(tenantId, branchId, productId),
      });
      // La rejilla del POS lee el mismo listado: sin esto seguiría ofreciendo
      // un producto agotado, o escondiendo uno que acaba de entrar.
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.lists(tenantId, branchId) });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

/**
 * ¿Puede este producto mover existencias?
 *
 * El servidor rechaza el ajuste de un `RECIPE`, `COMBO` o `SERVICE`, y el de
 * cualquier producto con `trackInventory: false`. El motivo no es obvio desde
 * la pantalla, así que la UI lo dice antes de dejar intentarlo.
 */
export function stockAdjustmentBlocker(product: Product): 'type' | 'untracked' | null {
  if (!product.trackInventory) return 'untracked';
  // Con presentaciones el ajuste va por variante, que sí acepta cualquier tipo
  // mientras siga inventariándose.
  if (product.variants.length === 0 && product.type !== 'SIMPLE') return 'type';
  return null;
}
