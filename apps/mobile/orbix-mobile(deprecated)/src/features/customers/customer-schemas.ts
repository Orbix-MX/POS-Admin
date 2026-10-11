/**
 * Customer create/edit form schema.
 *
 * `creditLimit`/`creditDays` stay strings in the form (React Native text
 * inputs are string-valued) and are parsed to numbers only at submit time —
 * mirrors the money-field pattern in `product-schemas.ts`.
 */
import type { TFunction } from 'i18next';
import { z } from 'zod';

import type { CreateCustomerRequest, UpdateCustomerRequest } from '@/dto/customers.dto';
import { CustomerStatus, CustomerType } from '@/types/api';

const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const INTEGER_RE = /^\d+$/;

export function buildCustomerSchema(t: TFunction) {
  const optionalMoney = z.string().trim().regex(MONEY_RE, t('validation.priceInvalid')).optional().or(z.literal(''));
  const optionalInteger = z.string().trim().regex(INTEGER_RE, t('validation.integerInvalid')).optional().or(z.literal(''));

  return z.object({
    firstName: z.string().trim().min(2, t('validation.nameTooShort')).max(50),
    lastName: z.string().trim().min(2, t('validation.nameTooShort')).max(50),
    email: z.string().trim().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')),
    phone: z.string().trim().max(20).optional().or(z.literal('')),
    company: z.string().trim().max(100).optional().or(z.literal('')),
    city: z.string().trim().max(100).optional().or(z.literal('')),
    type: z.enum([CustomerType.NEW, CustomerType.REGULAR, CustomerType.VIP, CustomerType.WHOLESALE]),
    status: z.enum([CustomerStatus.ACTIVE, CustomerStatus.INACTIVE, CustomerStatus.BLOCKED]),
    hasCredit: z.boolean(),
    creditLimit: optionalMoney,
    creditDays: optionalInteger,
  });
}

export type CustomerFormValues = z.infer<ReturnType<typeof buildCustomerSchema>>;

export const EMPTY_CUSTOMER_FORM: CustomerFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  city: '',
  type: CustomerType.NEW,
  status: CustomerStatus.ACTIVE,
  hasCredit: false,
  creditLimit: '',
  creditDays: '',
};

function num(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  return Number(value);
}

/** Shared by create and update. */
function toBaseRequest(values: CustomerFormValues): CreateCustomerRequest {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: values.phone?.trim() || undefined,
    company: values.company?.trim() || undefined,
    city: values.city?.trim() || undefined,
    type: values.type,
    status: values.status,
    hasCredit: values.hasCredit,
    creditLimit: values.hasCredit ? num(values.creditLimit) : undefined,
    creditDays: values.hasCredit ? num(values.creditDays) : undefined,
  };
}

export function toCreateRequest(values: CustomerFormValues): CreateCustomerRequest {
  return toBaseRequest(values);
}

export function toUpdateRequest(values: CustomerFormValues): UpdateCustomerRequest {
  return toBaseRequest(values);
}
