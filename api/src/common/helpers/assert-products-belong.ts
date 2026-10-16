import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Todos los productos de una lista de ids que llega en el body deben ser de ESTA empresa.
 *
 * Se rechaza el lote completo si alguno no lo es, en vez de saltárselo en silencio. Un id ajeno que se guardara
 * permitía leer los datos del producto (costos incluidos) y, en compras, mover su stock y su costo.
 * Misma regla y mismo mensaje que ya usaban restaurante y sucursales, reunidos aquí.
 *
 * @odd aislamiento-de-cupones T-003 (A-3)
 */
export async function assertProductsBelong(
  db: Pick<Prisma.TransactionClient, 'product'>,
  tenantId: string,
  productIds: Array<string | null | undefined>,
): Promise<void> {
  const ids = [...new Set(productIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;

  const owned = await db.product.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true },
  });
  if (owned.length !== ids.length) {
    throw new NotFoundException('Alguno de los productos no existe en esta empresa');
  }
}
