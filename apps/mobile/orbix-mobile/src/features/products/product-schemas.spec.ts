/**
 * El formulario de producto, donde vive el fallo más caro que tuvo la app.
 *
 * Un producto nacía en `DRAFT` y el POS filtra `status: 'ACTIVE'`, así que el
 * primer producto de todo usuario nuevo era invendible: lo creaba, iba a
 * cobrar, y no estaba. Estas pruebas fijan el valor por defecto para que no
 * vuelva a cambiarse sin que salte algo.
 */
import type { TFunction } from 'i18next';

import { ProductStatus, ProductType, TaxCode } from '@/types/api';

import {
  EMPTY_PRODUCT_FORM,
  buildProductSchema,
  toCreateRequest,
  toUpdateRequest,
  type ProductFormValues,
} from './product-schemas';

const t = ((key: string) => key) as unknown as TFunction;

/** Lo mínimo que el usuario teclea encima del formulario vacío. */
function minimal(): ProductFormValues {
  return { ...EMPTY_PRODUCT_FORM, sku: 'SKU-1', name: 'Refresco', price: '25' };
}

describe('EMPTY_PRODUCT_FORM', () => {
  it('nace A LA VENTA, no en borrador', () => {
    // Si esto cambia a DRAFT, el primer producto de cada usuario nuevo vuelve a
    // ser invendible y nadie se entera hasta que alguien intenta cobrarlo.
    expect(EMPTY_PRODUCT_FORM.status).toBe(ProductStatus.ACTIVE);
  });

  it('NO se publica en internet por defecto', () => {
    // «A la venta» es el mostrador, no el catálogo público. Son cosas distintas
    // y confundirlas publicaría precios sin que nadie lo pidiera.
    expect(EMPTY_PRODUCT_FORM.isEcommerce).toBe(false);
  });

  it('rastrea inventario por defecto', () => {
    expect(EMPTY_PRODUCT_FORM.trackInventory).toBe(true);
  });
});

describe('toCreateRequest', () => {
  it('el producto mínimo sale vendible', () => {
    const request = toCreateRequest(minimal());

    expect(request.status).toBe(ProductStatus.ACTIVE);
    expect(request.isEcommerce).toBe(false);
    expect(request.sku).toBe('SKU-1');
    expect(request.price).toBe(25);
  });

  it('respeta el borrador cuando se elige a propósito', () => {
    const request = toCreateRequest({ ...minimal(), status: ProductStatus.DRAFT });
    expect(request.status).toBe(ProductStatus.DRAFT);
  });

  it('limpia los opcionales vacíos en vez de mandar cadenas', () => {
    const request = toCreateRequest(minimal());

    // `''` chocaría con cualquier otro producto igual de vacío.
    expect(request.description).toBeUndefined();
    expect(request.barcode).toBeUndefined();
    expect(request.categoryId).toBeUndefined();
    expect(request.comparePrice).toBeUndefined();
  });

  it('manda variantes solo en productos SIMPLE', () => {
    const conVariantes = {
      ...minimal(),
      variants: [{ name: 'Talla M', sku: '', barcode: '', cost: '', price: '', stock: '3' }],
    };

    expect(toCreateRequest(conVariantes).variants).toHaveLength(1);
    // Mandar un arreglo vacío desde un COMBO borraría sus variantes y su
    // existencia en cascada, sin que nadie lo haya pedido.
    expect(
      toCreateRequest({ ...conVariantes, type: ProductType.COMBO }).variants,
    ).toBeUndefined();
  });
});

describe('toUpdateRequest', () => {
  it('no manda stock: la API lo rechaza y no dejaría movimiento', () => {
    const request = toUpdateRequest({ ...minimal(), stock: '99' });
    expect('stock' in request).toBe(false);
  });

  it('no manda sku: es inmutable tras el alta', () => {
    expect('sku' in toUpdateRequest(minimal())).toBe(false);
  });

  it('sí manda el estado — es como se publica un borrador', () => {
    const request = toUpdateRequest({ ...minimal(), status: ProductStatus.ACTIVE });
    expect(request.status).toBe(ProductStatus.ACTIVE);
  });
});

describe('buildProductSchema', () => {
  const schema = buildProductSchema(t);

  it('acepta el producto mínimo', () => {
    expect(schema.safeParse(minimal()).success).toBe(true);
  });

  it('el formulario vacío no valida — falta lo esencial', () => {
    expect(schema.safeParse(EMPTY_PRODUCT_FORM).success).toBe(false);
  });

  it('exige precio', () => {
    const result = schema.safeParse({ ...minimal(), price: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe('validation.priceRequired');
  });

  it('rechaza más de dos decimales en el precio', () => {
    expect(schema.safeParse({ ...minimal(), price: '25.999' }).success).toBe(false);
  });

  it('exige un SKU de al menos dos caracteres', () => {
    expect(schema.safeParse({ ...minimal(), sku: 'A' }).success).toBe(false);
  });

  it('acepta los cuatro códigos de impuesto', () => {
    for (const taxCode of Object.values(TaxCode)) {
      expect(schema.safeParse({ ...minimal(), taxCode }).success).toBe(true);
    }
  });
});
