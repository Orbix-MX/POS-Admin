import { Injectable } from '@nestjs/common';
import { TaxCode } from '@prisma/client';
import { AiGatewayService } from '../../../../ai/gateway/ai-gateway.service';
import { AiDegradation } from '../../../../ai/contracts/ai-invocation.types';
import { TenantContextService } from '../../../../common/context/tenant-context.service';
import { ProductDraftReconciler } from './product-draft.reconciler';
import { ProductDraftOutput } from './product-draft.schema';

export interface ProductDraftResponse {
  aiRequestId: string;
  degradations: AiDegradation[];
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
  unresolved: string[];
  conflicts: string[];
}

const TAX_CODES_HINT = 'IVA_16, IVA_11, IVA_8, EXCENTO';

/**
 * Fachada de dominio del Product Assistant (§07). Depende únicamente de
 * `AiGatewayService` para invocar IA — nunca de un proveedor, de la
 * configuración de routing ni de un prompt directamente (regla 02,
 * ADR-0025). Tampoco inyecta `PrismaService`: ni siquiera para lectura. La
 * única escritura a la base de datos del sistema sigue siendo
 * `ProductsService.create()`, disparada por una petición HTTP posterior e
 * independiente que el usuario dispara explícitamente — este servicio no
 * tiene ningún camino hacia esa tabla.
 */
@Injectable()
export class ProductAIService {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly reconciler: ProductDraftReconciler,
    private readonly tenantContext: TenantContextService,
  ) {}

  async draft(message: string): Promise<ProductDraftResponse> {
    const tenantId = this.tenantContext.requireTenantId();
    const categoryNames = await this.reconciler.listActiveCategoryNames(tenantId);

    const result = await this.gateway.generate<ProductDraftOutput>(
      { featureKey: 'products.draft', input: { message } },
      {
        message,
        currency: 'MXN',
        categories: categoryNames.length > 0 ? categoryNames.join(', ') : '(sin categorías registradas todavía)',
        taxCodes: TAX_CODES_HINT,
      },
    );

    const reconciled = await this.reconciler.reconcile(result.data);

    return {
      aiRequestId: result.requestId,
      degradations: result.degradations,
      ...reconciled,
    };
  }
}
