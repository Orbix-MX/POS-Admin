import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * VariantInventoryResolver — traduce las llaves "viejas" (productId, branchId
 * opcional) a la llave nueva del inventario: (branchId, variantId).
 *
 * Existe para que la migración a inventario por variante NO obligue a reescribir
 * a los llamadores. POS, comanda, caja, compras y la tienda siguen hablando de
 * productos; este resolver es el único punto que sabe que, por debajo, el stock
 * vive en `branch_inventory` apuntando a una variante.
 *
 * Dos reglas de resolución:
 *
 *  - Variante: si el llamador no especifica una, se usa la variante `isDefault`
 *    del producto — la línea implícita "el producto en sí". Un índice único
 *    parcial en la base garantiza que hay exactamente una por producto.
 *
 *  - Sucursal: la explícita del contexto; si no hay (hoy el 82% de las órdenes
 *    no trae `branchId`), la sucursal `isMain` del tenant. Si el tenant no tiene
 *    ninguna sucursal, devuelve null y el llamador cae al comportamiento legacy
 *    sobre `Product.stock`, que sigue vigente durante la fase expand.
 *
 * Todos los métodos reciben el `Prisma.TransactionClient` del llamador y nunca
 * abren su propia transacción, igual que los engines.
 */
@Injectable()
export class VariantInventoryResolver {
  /**
   * Variante contra la que se mueve el inventario de un producto. Devuelve null
   * si el producto no tiene variante default, lo que en la práctica solo puede
   * pasar con un producto creado por una ruta que no la sembró — el llamador
   * debe tratarlo como "sin inventario por variante" y no reventar.
   */
  async resolveVariantId(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<string | null> {
    const variant = await tx.productVariant.findFirst({
      where: { productId, isDefault: true },
      select: { id: true },
    });
    return variant?.id ?? null;
  }

  /**
   * Igual que `resolveVariantId`, pero crea la variante default si no existe.
   * Hace auto-reparable cualquier producto creado por una ruta que no la sembró
   * (importación, seeds antiguos), en vez de dejarlo silenciosamente sin
   * inventario. Devuelve null solo si el producto no existe.
   */
  async ensureDefaultVariantId(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<string | null> {
    const existing = await this.resolveVariantId(tx, productId);
    if (existing) return existing;

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { price: true, costPrice: true, trackInventory: true },
    });
    if (!product) return null;

    const created = await tx.productVariant.create({
      data: {
        productId,
        name: null,
        isDefault: true,
        trackInventory: product.trackInventory,
        cost: product.costPrice ?? 0,
        price: product.price,
      },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Sucursal contra la que se carga el inventario: la explícita, o la `isMain`
   * del tenant dueño del producto. Null cuando el tenant no tiene sucursales.
   */
  async resolveBranchId(
    tx: Prisma.TransactionClient,
    productId: string,
    branchId?: string | null,
  ): Promise<string | null> {
    if (branchId) return branchId;

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { tenantId: true },
    });
    if (!product) return null;

    const main = await tx.branch.findFirst({
      where: { tenantId: product.tenantId, isMain: true },
      select: { id: true },
    });
    return main?.id ?? null;
  }

  /**
   * Resuelve ambas llaves de una vez. `null` en cualquiera de las dos significa
   * que este producto no es direccionable en el inventario por variante todavía.
   */
  async resolve(
    tx: Prisma.TransactionClient,
    productId: string,
    branchId?: string | null,
  ): Promise<{ variantId: string; branchId: string } | null> {
    const [variantId, resolvedBranchId] = await Promise.all([
      this.resolveVariantId(tx, productId),
      this.resolveBranchId(tx, productId, branchId),
    ]);

    if (!variantId || !resolvedBranchId) return null;
    return { variantId, branchId: resolvedBranchId };
  }
}
