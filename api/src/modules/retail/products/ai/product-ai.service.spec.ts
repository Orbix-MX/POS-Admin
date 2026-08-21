import { ProductAIService } from './product-ai.service';
import { ProductDraftOutput } from './product-draft.schema';
import { AiException } from '../../../../ai/contracts/ai-error';

describe('ProductAIService', () => {
  const mockGateway = { generate: jest.fn() };
  const mockReconciler = {
    listActiveCategoryNames: jest.fn().mockResolvedValue(['Bebidas', 'Botanas']),
    reconcile: jest.fn(),
  };
  const mockTenantContext = { requireTenantId: jest.fn().mockReturnValue('tenant-1') };

  let service: ProductAIService;

  const draftOutput: ProductDraftOutput = {
    name: 'Coca-Cola 600ml',
    categoryName: 'Bebidas',
    price: 22,
    comparePrice: null,
    costPrice: 15,
    taxCode: 'IVA_16',
    description: null,
    skuSuggestion: null,
    trackInventory: null,
    lowStockAlert: null,
    confidence: 0.9,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductAIService(mockGateway as any, mockReconciler as any, mockTenantContext as any);
  });

  it('no inyecta PrismaService — no puede escribir en la base de datos por su cuenta', () => {
    // La firma del constructor es la garantía estructural: si alguna vez se
    // agrega un cuarto parámetro con acceso a Prisma, este test documenta
    // que eso rompe la invariante, no que la impide por sí solo.
    expect(ProductAIService.length).toBe(3);
  });

  it('pasa el contexto del tenant (categorías) al gateway y reconcilia el resultado', async () => {
    mockGateway.generate.mockResolvedValue({
      requestId: 'req-1',
      featureKey: 'products.draft',
      data: draftOutput,
      degradations: [],
      usage: {} as any,
    });
    mockReconciler.reconcile.mockResolvedValue({
      name: 'Coca-Cola 600ml',
      description: null,
      price: 22,
      costPrice: 15,
      taxCode: 'IVA_16',
      confidence: 0.9,
      category: { name: 'Bebidas', id: 'cat-1' },
      skuSuggestion: 'COCA-COLA-600ML',
      unresolved: [],
      conflicts: [],
    });

    const result = await service.draft('Coca-Cola de 600ml, cuesta 15 y la vendo en 22');

    expect(mockGateway.generate).toHaveBeenCalledWith(
      { featureKey: 'products.draft', input: { message: expect.any(String) } },
      expect.objectContaining({ categories: 'Bebidas, Botanas', currency: 'MXN' }),
    );
    expect(mockReconciler.reconcile).toHaveBeenCalledWith(draftOutput);
    expect(result.aiRequestId).toBe('req-1');
    expect(result.category).toEqual({ name: 'Bebidas', id: 'cat-1' });
  });

  it('sin categorías en el tenant, se lo dice al modelo en vez de mandar una lista vacía', async () => {
    mockReconciler.listActiveCategoryNames.mockResolvedValueOnce([]);
    mockGateway.generate.mockResolvedValue({
      requestId: 'req-2',
      featureKey: 'products.draft',
      data: draftOutput,
      degradations: [],
      usage: {} as any,
    });
    mockReconciler.reconcile.mockResolvedValue({
      name: 'x', description: null, price: 1, costPrice: null, taxCode: 'IVA_16',
      confidence: 0.5, category: { name: 'x', id: null }, skuSuggestion: 'X', unresolved: [], conflicts: [],
    });

    await service.draft('algo');

    expect(mockGateway.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ categories: '(sin categorías registradas todavía)' }),
    );
  });

  it('con el proveedor de IA caído, propaga el error tal cual — no lo atrapa ni lo convierte en un draft vacío (§12, D-18)', async () => {
    const providerDown = new AiException('AI_PROVIDER_UNAVAILABLE', 'El asistente no está disponible en este momento.');
    mockGateway.generate.mockRejectedValue(providerDown);

    await expect(service.draft('coca de 600')).rejects.toBe(providerDown);
    // El reconciliador nunca se invoca: no hay nada que reconciliar de una invocación que nunca respondió.
    expect(mockReconciler.reconcile).not.toHaveBeenCalled();
  });
});

/**
 * "El alta manual funciona igual con el gateway apagado" (criterio de
 * aceptación de la Fase 3) no es un comportamiento de ProductAIService —
 * es la AUSENCIA de una dependencia. ProductsService (products.service.ts)
 * no importa AiGatewayService en ningún punto de su constructor; su único
 * acoplamiento con la plataforma de IA es AiUsageRecorder.recordOutcome(),
 * envuelto en try/catch y no-bloqueante (ver products.service.ts, tras el
 * $transaction de create()). products.service.spec.ts ya prueba que
 * create() tiene éxito con ese mock — esta nota documenta por qué no hace
 * falta un segundo test de "gateway caído": no hay una ruta de código que
 * pueda acoplarlos.
 */
