import { NotFoundException } from '@nestjs/common';

import { ProductsService } from './products.service';

/**
 * Resolver un escaneo.
 *
 * Lo que estas pruebas sostienen es la **prioridad** —barcode de presentación
 * antes que su SKU, y el SKU del producto padre al final— y que un código de
 * otra empresa sea un 404 y no una fuga. Ninguna de las dos cosas la impone la
 * base: la primera se decide en memoria y la segunda depende de que cada
 * consulta lleve su `tenantId`, así que si alguien lo quita, esto es lo único
 * que se entera.
 */
describe('ProductsService — resolver un código escaneado', () => {
  const TENANT = 't1';

  interface Row {
    id: string;
    tenantId: string;
    name: string;
    sku: string | null;
    variants: { id: string; name: string | null; sku: string | null; barcode: string | null; isDefault: boolean }[];
  }

  function build(rows: Row[], branchId: string | null = null) {
    const eq = (a: string | null, b: string) => a !== null && a.toLowerCase() === b.toLowerCase();

    /** El valor que la consulta compara, en la forma `{ equals, mode }`. */
    const wanted = (f: unknown) => (f as { equals: string }).equals;

    const variantFindMany = jest.fn(
      ({ where }: { where: { product: { tenantId: string }; OR: { barcode?: unknown; sku?: unknown }[] } }) => {
        // El filtro por empresa es el punto de la prueba: si la consulta deja
        // de acotarlo, aquí se cuela un producto ajeno y el caso falla.
        const scoped = rows.filter((r) => r.tenantId === where.product.tenantId);
        const codes = where.OR.flatMap((o) => [o.barcode, o.sku].filter(Boolean).map(wanted));
        return Promise.resolve(
          scoped.flatMap((r) =>
            r.variants
              .filter((v) => codes.some((c) => eq(v.barcode, c) || eq(v.sku, c)))
              .map((v) => ({ id: v.id, productId: r.id, name: v.name, sku: v.sku, barcode: v.barcode })),
          ),
        );
      },
    );

    const productFindMany = jest.fn(
      ({ where }: { where: { tenantId: string; sku?: unknown; id?: { in: string[] } } }) => {
        const scoped = rows.filter((r) => r.tenantId === where.tenantId);
        // Dos usos distintos: buscar por SKU, y traer los nombres de las
        // alternativas por id.
        if (where.id) {
          const ids = where.id.in;
          return Promise.resolve(
            scoped.filter((r) => ids.includes(r.id)).map((r) => ({ id: r.id, name: r.name })),
          );
        }
        return Promise.resolve(scoped.filter((r) => eq(r.sku, wanted(where.sku))).map((r) => ({ id: r.id })));
      },
    );

    const productFindFirst = jest.fn(({ where }: { where: { id: string; tenantId: string } }) => {
      const hit = rows.find((r) => r.id === where.id && r.tenantId === where.tenantId);
      if (!hit) return Promise.resolve(null);
      return Promise.resolve({
        id: hit.id,
        name: hit.name,
        sku: hit.sku,
        variants: hit.variants.map((v) => ({ ...v, price: 10, cost: 5 })),
        branchInventory: [],
        images: [],
      });
    });

    const service = new ProductsService(
      {
        productVariant: { findMany: variantFindMany },
        product: { findMany: productFindMany, findFirst: productFindFirst },
      } as never,
      { requireTenantId: () => TENANT, getBranchId: () => branchId } as never,
      { log: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { recordOutcome: jest.fn() } as never,
    );

    return { service, variantFindMany, productFindMany };
  }

  const CATALOG: Row[] = [
    {
      id: 'p1',
      tenantId: TENANT,
      name: 'Refresco',
      sku: 'REF',
      variants: [
        { id: 'v1', name: '600 ml', sku: 'REF-600', barcode: '7501', isDefault: true },
        { id: 'v2', name: '2 L', sku: 'REF-2L', barcode: '7502', isDefault: false },
      ],
    },
    {
      id: 'p2',
      tenantId: 'otro-tenant',
      name: 'Producto ajeno',
      sku: 'AJENO',
      variants: [{ id: 'v9', name: null, sku: 'AJENO-1', barcode: '9999', isDefault: true }],
    },
  ];

  it('resuelve el código de barras de una presentación, no el de su hermana', async () => {
    const { service } = build(CATALOG);
    const hit = await service.resolveByCode('7502');

    expect(hit.matchedBy).toBe('variant.barcode');
    expect(hit.variantId).toBe('v2');
    expect(hit.product.id).toBe('p1');
    expect(hit.alternatives).toEqual([]);
  });

  it('resuelve el SKU de una presentación', async () => {
    const { service } = build(CATALOG);
    const hit = await service.resolveByCode('REF-600');

    expect(hit.matchedBy).toBe('variant.sku');
    expect(hit.variantId).toBe('v1');
  });

  it('resuelve el SKU del producto padre a su presentación por defecto', async () => {
    const { service } = build(CATALOG);
    const hit = await service.resolveByCode('REF');

    expect(hit.matchedBy).toBe('product.sku');
    // No casó ninguna presentación, así que se cobra la default.
    expect(hit.variantId).toBe('v1');
  });

  it('ignora mayúsculas: quien teclea un SKU no respeta la caja', async () => {
    const { service } = build(CATALOG);
    await expect(service.resolveByCode('ref-600')).resolves.toMatchObject({ variantId: 'v1' });
  });

  it('recorta los espacios que mete un lector mal configurado', async () => {
    const { service } = build(CATALOG);
    await expect(service.resolveByCode('  7501  ')).resolves.toMatchObject({ variantId: 'v1' });
  });

  it('un código inexistente es 404, no una lista vacía', async () => {
    const { service } = build(CATALOG);
    await expect(service.resolveByCode('0000')).rejects.toThrow(NotFoundException);
  });

  it('el código de otra empresa es 404: no se filtra ni el nombre', async () => {
    const { service } = build(CATALOG);
    await expect(service.resolveByCode('9999')).rejects.toThrow(NotFoundException);
    await expect(service.resolveByCode('AJENO')).rejects.toThrow(NotFoundException);
  });

  it('acota todas las consultas a la empresa en contexto', async () => {
    const { service, variantFindMany, productFindMany } = build(CATALOG);
    await service.resolveByCode('7501');

    expect(variantFindMany.mock.calls[0][0].where.product.tenantId).toBe(TENANT);
    expect(productFindMany.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });

  describe('cuando dos artículos comparten código', () => {
    // La unicidad la impone el servicio, no un índice, y no cruza
    // `Product.sku` con `variant.barcode`: los datos importados de otro sistema
    // nunca pasaron por esa validación.
    const DUPLICADOS: Row[] = [
      {
        id: 'viejo',
        tenantId: TENANT,
        name: 'El de siempre',
        sku: null,
        variants: [{ id: 'va', name: null, sku: null, barcode: '111', isDefault: true }],
      },
      {
        id: 'nuevo',
        tenantId: TENANT,
        name: 'El importado',
        sku: null,
        variants: [{ id: 'vb', name: 'Caja', sku: null, barcode: '111', isDefault: true }],
      },
    ];

    it('devuelve el más antiguo y denuncia al otro en vez de elegir en silencio', async () => {
      const { service } = build(DUPLICADOS);
      const hit = await service.resolveByCode('111');

      expect(hit.variantId).toBe('va');
      expect(hit.alternatives).toEqual([
        {
          productId: 'nuevo',
          productName: 'El importado',
          variantId: 'vb',
          variantName: 'Caja',
          matchedBy: 'variant.barcode',
        },
      ]);
    });
  });

  it('el barcode gana al SKU de otro artículo con el mismo valor', async () => {
    const rows: Row[] = [
      {
        id: 'p-sku',
        tenantId: TENANT,
        name: 'Casa por SKU',
        sku: null,
        variants: [{ id: 'v-sku', name: null, sku: '5050', barcode: null, isDefault: true }],
      },
      {
        id: 'p-bar',
        tenantId: TENANT,
        name: 'Casa por barcode',
        sku: null,
        variants: [{ id: 'v-bar', name: null, sku: null, barcode: '5050', isDefault: true }],
      },
    ];
    const { service } = build(rows);
    const hit = await service.resolveByCode('5050');

    // La etiqueta que se acaba de leer es un código de barras: manda ese.
    expect(hit.matchedBy).toBe('variant.barcode');
    expect(hit.variantId).toBe('v-bar');
    expect(hit.alternatives).toHaveLength(1);
    expect(hit.alternatives[0].matchedBy).toBe('variant.sku');
  });

  it('no cuenta dos veces la presentación cuyo sku y barcode son iguales', async () => {
    const rows: Row[] = [
      {
        id: 'p1',
        tenantId: TENANT,
        name: 'Código repetido en sí mismo',
        sku: null,
        variants: [{ id: 'v1', name: null, sku: '333', barcode: '333', isDefault: true }],
      },
    ];
    const { service } = build(rows);
    const hit = await service.resolveByCode('333');

    expect(hit.matchedBy).toBe('variant.barcode');
    expect(hit.alternatives).toEqual([]);
  });

  it('un código vacío no llega a la base', async () => {
    const { service, variantFindMany } = build(CATALOG);
    await expect(service.resolveByCode('   ')).rejects.toThrow(NotFoundException);
    expect(variantFindMany).not.toHaveBeenCalled();
  });
});
