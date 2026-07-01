import { Injectable } from '@nestjs/common';
import { Prisma, InventoryMovementType, SupplyMovementType } from '@prisma/client';

/**
 * InventoryEngine — Fase 1 (preparación de infraestructura).
 *
 * Objetivo: ser, en fases posteriores, la ÚNICA puerta de entrada para modificar
 * existencias (productos e insumos). En esta fase solo ENCAPSULA los primitivos
 * de inventario que hoy están duplicados en varios servicios; todavía NO
 * reemplaza a ningún llamador (la adopción es Fase 2).
 *
 * Principios de diseño:
 *  - Ignorancia de dominio: el engine NO conoce Ventas, Compras, POS, Comanda,
 *    Órdenes, Servicios, CxP ni CxC. Solo habla de productos, insumos, sucursales
 *    y movimientos. La semántica ("por qué" se mueve el stock) la aporta el
 *    llamador vía `type`/`referenceType`/`notes`.
 *  - Transacción del llamador: igual que InventoryConsumptionEngine, cada método
 *    recibe un `Prisma.TransactionClient` y NUNCA abre su propia `$transaction`,
 *    de modo que la escritura de inventario queda en la misma unidad atómica que
 *    el resto de la operación de negocio.
 *  - Sin efectos observables nuevos: los primitivos reproducen exactamente el
 *    comportamiento existente (mismos campos de movimiento, mismo guard de stock,
 *    misma siembra de branchInventory), para que la migración de Fase 2 sea una
 *    sustitución 1:1.
 *
 * Mapa de operaciones futuras (Fase 2+) sobre estos primitivos — NO implementadas
 * aquí a propósito (evitar sobreingeniería / código muerto):
 *   ventas            → applyProductStockDelta(guard) + recordProductMovement(VENTA)
 *   compras           → applyProductStockDelta(+) + recordProductMovement(COMPRA)
 *   devoluciones      → applyProductStockDelta(+) + recordProductMovement(DEVOLUCION)
 *   ajustes           → applyProductStockDelta + recordProductMovement(AJUSTE)
 *   consumo de receta → applySupplyStockDelta(guard) + recordSupplyMovement(RECIPE_CONSUMPTION)
 *   producción        → // TODO Phase 2
 *   transferencias    → // TODO Phase 2 (par de deltas + movimiento TRANSFERENCIA)
 *   mermas            → // TODO Phase 2
 *   inventario inicial→ // TODO Phase 2
 *   conteos físicos   → // TODO Phase 2
 */

/** Entrada de un movimiento de producto (espeja el modelo InventoryMovement). */
export interface ProductMovementInput {
  tenantId: string;
  type: InventoryMovementType;
  productId: string;
  quantity: number;
  branchId?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  notes?: string | null;
  createdById?: string | null;
}

/** Entrada de un movimiento de insumo (espeja el modelo SupplyMovement). */
export interface SupplyMovementInput {
  tenantId: string;
  supplyId: string;
  type: SupplyMovementType;
  quantity: number;
  branchId?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdById?: string | null;
}

/** Delta a aplicar sobre existencia de producto. */
export interface ProductStockDelta {
  productId: string;
  /** Positivo suma, negativo resta. */
  delta: number;
  /**
   * Cuando es true y el delta es negativo, la resta solo se aplica si hay
   * existencia suficiente (guard contra stock negativo). Devuelve false si no
   * alcanzó. Cuando es false, la resta se aplica sin guard.
   */
  guardInsufficient?: boolean;
}

/** Delta a aplicar sobre existencia de insumo. */
export interface SupplyStockDelta {
  supplyId: string;
  delta: number;
  guardInsufficient?: boolean;
}

@Injectable()
export class InventoryEngine {
  // ── Movimientos (append-only) ─────────────────────────────────────────────

  /**
   * Registra un InventoryMovement de producto. No toca existencias: solo escribe
   * el asiento en el ledger. `referenceType` por defecto 'ORDER' se deja a cargo
   * del llamador para no imponer semántica de dominio aquí.
   */
  async recordProductMovement(
    tx: Prisma.TransactionClient,
    input: ProductMovementInput,
  ): Promise<void> {
    await tx.inventoryMovement.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        productId: input.productId,
        branchId: input.branchId ?? null,
        quantity: input.quantity,
        referenceId: input.referenceId ?? null,
        referenceType: input.referenceType ?? null,
        notes: input.notes ?? null,
        createdById: input.createdById ?? null,
      },
    });
  }

  /** Registra un SupplyMovement de insumo. No toca existencias. */
  async recordSupplyMovement(
    tx: Prisma.TransactionClient,
    input: SupplyMovementInput,
  ): Promise<void> {
    await tx.supplyMovement.create({
      data: {
        tenantId: input.tenantId,
        supplyId: input.supplyId,
        type: input.type,
        quantity: input.quantity,
        branchId: input.branchId ?? null,
        referenceId: input.referenceId ?? null,
        notes: input.notes ?? null,
        createdById: input.createdById ?? null,
      },
    });
  }

  // ── Existencias globales ──────────────────────────────────────────────────

  /**
   * Aplica un delta sobre `Product.stock`. Reproduce los dos patrones existentes:
   *  - Resta con guard (venta): `updateMany` con `stock >= |delta|`; si ninguna
   *    fila calificó devuelve false (stock insuficiente) sin mutar.
   *  - Suma o resta sin guard (reversa / ajuste): `increment` directo.
   * Devuelve true si el delta se aplicó.
   */
  async applyProductStockDelta(
    tx: Prisma.TransactionClient,
    { productId, delta, guardInsufficient }: ProductStockDelta,
  ): Promise<boolean> {
    if (delta === 0) return true;

    if (delta < 0 && guardInsufficient) {
      const res = await tx.product.updateMany({
        where: { id: productId, stock: { gte: -delta } },
        data: { stock: { increment: delta } },
      });
      return res.count > 0;
    }

    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: delta } },
    });
    return true;
  }

  /** Aplica un delta sobre `Supply.stock` (Decimal). Mismos patrones que producto. */
  async applySupplyStockDelta(
    tx: Prisma.TransactionClient,
    { supplyId, delta, guardInsufficient }: SupplyStockDelta,
  ): Promise<boolean> {
    if (delta === 0) return true;

    if (delta < 0 && guardInsufficient) {
      const res = await tx.supply.updateMany({
        where: { id: supplyId, stock: { gte: -delta } },
        data: { stock: { increment: delta } },
      });
      return res.count > 0;
    }

    await tx.supply.update({
      where: { id: supplyId },
      data: { stock: { increment: delta } },
    });
    return true;
  }

  // ── Existencias por sucursal ──────────────────────────────────────────────

  /**
   * Aplica un delta sobre `BranchInventory.stock`. Extraído verbatim del
   * comportamiento actual de InventoryConsumptionEngine para que la Fase 2 pueda
   * eliminar la copia privada de ese motor con una sustitución exacta:
   *  - Sin `branchId`: no-op.
   *  - Resta: `updateMany` guardado; si la fila existe pero no alcanza, se fija a
   *    0 (nunca negativa, el guard global ya evitó la sobreventa); si no hay fila,
   *    se siembra desde el stock global del producto.
   *  - Suma: `increment`; si no hay fila, se siembra desde el stock global.
   */
  async applyBranchInventoryDelta(
    tx: Prisma.TransactionClient,
    branchId: string | null | undefined,
    productId: string,
    delta: number,
  ): Promise<void> {
    if (!branchId) return;

    if (delta < 0) {
      const decremented = await tx.branchInventory.updateMany({
        where: { branchId, productId, stock: { gte: -delta } },
        data: { stock: { increment: delta } },
      });
      if (decremented.count > 0) return;

      const clamped = await tx.branchInventory.updateMany({
        where: { branchId, productId },
        data: { stock: 0 },
      });
      if (clamped.count > 0) return;
      // Sin fila → sembrar abajo.
    } else {
      const incremented = await tx.branchInventory.updateMany({
        where: { branchId, productId },
        data: { stock: { increment: delta } },
      });
      if (incremented.count > 0) return;
    }

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    await tx.branchInventory.create({
      data: { branchId, productId, stock: product?.stock ?? 0 },
    });
  }

  // ── Consultas de existencia ───────────────────────────────────────────────

  /** Existencia global actual de un producto (o null si no existe). */
  async getProductStock(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<number | null> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    return product ? product.stock : null;
  }

  /** Existencia global actual de un insumo, como número (o null si no existe). */
  async getSupplyStock(
    tx: Prisma.TransactionClient,
    supplyId: string,
  ): Promise<number | null> {
    const supply = await tx.supply.findUnique({
      where: { id: supplyId },
      select: { stock: true },
    });
    return supply ? Number(supply.stock) : null;
  }
}
