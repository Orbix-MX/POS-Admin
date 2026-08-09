/**
 * Product create/edit form schema.
 *
 * Money/quantity fields stay strings in the form (React Native text inputs are
 * string-valued) and are parsed to numbers only at submit time, in
 * `toCreateRequest`/`toUpdateRequest` — mirrors the phone-field pattern in
 * `wizard-schemas.ts`.
 */
import type { TFunction } from 'i18next';
import { z } from 'zod';

import type { CreateProductRequest, UpdateProductRequest } from '@/dto/products.dto';
import { ProductStatus, ProductType, TaxCode } from '@/types/api';

const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const INTEGER_RE = /^\d+$/;

export function buildProductSchema(t: TFunction) {
  const money = (required: boolean) => {
    const base = z.string().trim();
    return required
      ? base.min(1, t('validation.priceRequired')).regex(MONEY_RE, t('validation.priceInvalid'))
      : base.regex(MONEY_RE, t('validation.priceInvalid')).optional().or(z.literal(''));
  };
  const integer = () => z.string().trim().regex(INTEGER_RE, t('validation.integerInvalid')).optional().or(z.literal(''));

  return z.object({
    type: z.enum([ProductType.SIMPLE, ProductType.RECIPE, ProductType.COMBO, ProductType.SERVICE]),
    sku: z.string().trim().min(2, t('validation.skuTooShort')).max(100),
    name: z.string().trim().min(2, t('validation.nameTooShort')).max(200),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    price: money(true),
    comparePrice: money(false),
    costPrice: money(false),
    categoryId: z.string().optional(),
    status: z.enum([ProductStatus.DRAFT, ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.ARCHIVED]),
    stock: integer(),
    trackInventory: z.boolean(),
    lowStockAlert: integer(),
    taxRate: money(false),
    taxCode: z.enum([TaxCode.IVA_16, TaxCode.IVA_11, TaxCode.IVA_8, TaxCode.EXCENTO]),
    isEcommerce: z.boolean(),
  });
}

export type ProductFormValues = z.infer<ReturnType<typeof buildProductSchema>>;

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  type: ProductType.SIMPLE,
  sku: '',
  name: '',
  description: '',
  price: '',
  comparePrice: '',
  costPrice: '',
  categoryId: '',
  status: ProductStatus.DRAFT,
  stock: '0',
  trackInventory: true,
  lowStockAlert: '5',
  taxRate: '',
  taxCode: TaxCode.IVA_16,
  isEcommerce: false,
};

function num(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  return Number(value);
}

/** Every field but `sku`, shared by create and update. */
function toBaseRequest(values: ProductFormValues): Omit<CreateProductRequest, 'sku'> {
  return {
    type: values.type,
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    price: num(values.price) ?? 0,
    comparePrice: num(values.comparePrice),
    costPrice: num(values.costPrice),
    categoryId: values.categoryId || undefined,
    status: values.status,
    stock: num(values.stock) ?? 0,
    trackInventory: values.trackInventory,
    lowStockAlert: num(values.lowStockAlert) ?? 0,
    taxRate: num(values.taxRate),
    taxCode: values.taxCode,
    isEcommerce: values.isEcommerce,
  };
}

export function toCreateRequest(values: ProductFormValues): CreateProductRequest {
  return { ...toBaseRequest(values), sku: values.sku.trim() };
}

/** sku is immutable after creation — the API has no field to receive it on PATCH. */
export function toUpdateRequest(values: ProductFormValues): UpdateProductRequest {
  return toBaseRequest(values);
}
