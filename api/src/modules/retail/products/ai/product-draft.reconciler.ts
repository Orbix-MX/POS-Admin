import { Injectable } from '@nestjs/common';
import { TaxCode } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { TenantContextService } from '../../../../common/context/tenant-context.service';
import { ProductDraftOutput } from './product-draft.schema';

export interface ReconciledProductDraft {
  name: string;
  description: string | null;
  price: number;
  comparePrice: number | null;
  costPrice: number | null;
  taxCode: TaxCode;
  trackInventory: boolean | null;
  lowStockAlert: number | null;
  confidence: number;
  category: { name: string; id: string | null };
  skuSuggestion: string;
  /** Campos que el modelo propuso pero Orbix no pudo resolver contra el catálogo del tenant — requieren decisión del usuario (§08). */
  unresolved: string[];
  /** Violaciones de reglas duras que Orbix detectó — nunca se corrigen solas (§08: "se marca conflicto y se pide decisión"). */
  conflicts: string[];
}

/**
 * "El reconciliador de dominio (Fase 3) existe precisamente porque no se
 * puede confiar en que el texto libre del modelo calce con el catálogo del
 * tenant" — informe de benchmark de Fase 2. Este componente es la validación
 * de Orbix de la tabla del §08: resuelve nombres a entidades reales,
 * aplica la regla dura `price >= costPrice`, y nunca asigna un id que el
 * modelo no pudo haber propuesto — todo id sale de una consulta real a la
 * base de datos del tenant.
 */
@Injectable()
export class ProductDraftReconciler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async reconcile(draft: ProductDraftOutput): Promise<ReconciledProductDraft> {
    const tenantId = this.tenantContext.requireTenantId();
    const unresolved: string[] = [];
    const conflicts: string[] = [];

    const category = await this.resolveCategory(tenantId, draft.categoryName);
    if (!category.id) unresolved.push('categoryName');

    if (draft.costPrice != null && draft.price < draft.costPrice) {
      conflicts.push('price_below_cost');
    }
    if (draft.comparePrice != null && draft.comparePrice <= draft.price) {
      conflicts.push('compare_price_not_higher');
    }

    const skuSuggestion = await this.suggestSku(tenantId, draft.skuSuggestion ?? draft.name);

    return {
      name: draft.name.trim(),
      description: draft.description,
      price: draft.price,
      comparePrice: draft.comparePrice,
      costPrice: draft.costPrice,
      taxCode: draft.taxCode,
      trackInventory: draft.trackInventory,
      lowStockAlert: draft.lowStockAlert,
      confidence: draft.confidence,
      category,
      skuSuggestion,
      unresolved,
      conflicts,
    };
  }

  /** Contexto de catálogo para el prompt (§06) — nombres, nunca ids. */
  async listActiveCategoryNames(tenantId: string): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    return categories.map((c) => c.name);
  }

  /**
   * Coincidencia exacta (insensible a mayúsculas) contra las categorías
   * activas del tenant. Sin coincidencia, `id: null` — Orbix no crea una
   * categoría nueva por su cuenta; eso requiere confirmación explícita del
   * usuario (§08), que ocurre en la UI, no aquí.
   */
  private async resolveCategory(
    tenantId: string,
    categoryName: string,
  ): Promise<{ name: string; id: string | null }> {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const normalized = categoryName.trim().toLowerCase();
    const match = categories.find((c) => c.name.trim().toLowerCase() === normalized);

    return { name: categoryName, id: match?.id ?? null };
  }

  /**
   * Sugerencia de SKU, no autoridad final (§08: "Orbix regenera si choca" —
   * esa verificación real vuelve a ocurrir en `ProductsService.create()`
   * cuando el usuario confirme; esto solo evita proponer algo obviamente
   * duplicado en la UI).
   */
  private async suggestSku(tenantId: string, seed: string): Promise<string> {
    const base = seed
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita diacríticos tras NFD (é → e)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'PRODUCTO';

    const existing = await this.prisma.product.findMany({
      where: { tenantId, sku: { startsWith: base } },
      select: { sku: true },
    });
    const taken = new Set(existing.map((p) => p.sku));

    if (!taken.has(base)) return base;

    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) suffix++;
    return `${base}-${suffix}`;
  }
}
