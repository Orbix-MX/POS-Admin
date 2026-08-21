import { ProductDraftReconciler } from './product-draft.reconciler';
import { ProductDraftOutput } from './product-draft.schema';

describe('ProductDraftReconciler', () => {
  const mockPrisma = {
    category: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
  };
  const mockTenantContext = { requireTenantId: jest.fn().mockReturnValue('tenant-1') };

  let reconciler: ProductDraftReconciler;

  const baseDraft: ProductDraftOutput = {
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
    mockPrisma.product.findMany.mockResolvedValue([]);
    reconciler = new ProductDraftReconciler(mockPrisma as any, mockTenantContext as any);
  });

  it('resuelve categoryId cuando el nombre coincide (insensible a mayúsculas)', async () => {
    mockPrisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'bebidas' }]);

    const result = await reconciler.reconcile(baseDraft);

    expect(result.category).toEqual({ name: 'Bebidas', id: 'cat-1' });
    expect(result.unresolved).not.toContain('categoryName');
  });

  it('marca categoryName como unresolved cuando no hay coincidencia', async () => {
    mockPrisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Abarrotes' }]);

    const result = await reconciler.reconcile(baseDraft);

    expect(result.category).toEqual({ name: 'Bebidas', id: null });
    expect(result.unresolved).toContain('categoryName');
  });

  it('marca conflicto price_below_cost sin corregir nada — Orbix no autocorrige (§08)', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await reconciler.reconcile({ ...baseDraft, price: 10, costPrice: 15 });

    expect(result.conflicts).toContain('price_below_cost');
    expect(result.price).toBe(10);
    expect(result.costPrice).toBe(15);
  });

  it('sin costPrice en la entrada, no hay conflicto (costo ausente es válido)', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await reconciler.reconcile({ ...baseDraft, costPrice: null });

    expect(result.conflicts).not.toContain('price_below_cost');
    expect(result.costPrice).toBeNull();
  });

  it('marca conflicto compare_price_not_higher cuando el precio antes no es mayor al actual', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await reconciler.reconcile({ ...baseDraft, comparePrice: 20, price: 22 });

    expect(result.conflicts).toContain('compare_price_not_higher');
  });

  it('comparePrice mayor al precio actual no genera conflicto', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await reconciler.reconcile({ ...baseDraft, comparePrice: 30, price: 22 });

    expect(result.conflicts).not.toContain('compare_price_not_higher');
    expect(result.comparePrice).toBe(30);
  });

  it('pasa trackInventory y lowStockAlert tal cual, sin interpretarlos', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await reconciler.reconcile({ ...baseDraft, trackInventory: false, lowStockAlert: 10 });

    expect(result.trackInventory).toBe(false);
    expect(result.lowStockAlert).toBe(10);
  });

  it('genera un SKU a partir del nombre cuando no hay skuSuggestion', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await reconciler.reconcile(baseDraft);

    expect(result.skuSuggestion).toBe('COCA-COLA-600ML');
  });

  it('usa la skuSuggestion del modelo como semilla cuando existe', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await reconciler.reconcile({ ...baseDraft, skuSuggestion: 'COCA600' });

    expect(result.skuSuggestion).toBe('COCA600');
  });

  it('si el SKU base ya existe, agrega un sufijo numérico', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([{ sku: 'COCA-COLA-600ML' }]);

    const result = await reconciler.reconcile(baseDraft);

    expect(result.skuSuggestion).toBe('COCA-COLA-600ML-2');
  });

  it('listActiveCategoryNames devuelve solo nombres, en orden', async () => {
    mockPrisma.category.findMany.mockResolvedValue([{ name: 'Bebidas' }, { name: 'Botanas' }]);

    const names = await reconciler.listActiveCategoryNames('tenant-1');

    expect(names).toEqual(['Bebidas', 'Botanas']);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', status: 'ACTIVE' } }),
    );
  });
});
