/**
 * "Datos de la tienda" form. Phone and address stay optional server-side
 * (`TenantInfo.phone?`, `.address?`) — only the commerce name is required.
 *
 * `TenantInfo.phone` is a single string with no separate dial-code column —
 * same trick as the wizard's step 1 (`wizard-schemas.ts`): `dialCode` is
 * captured for the picker UI only, and prepended into that one string right
 * before the request goes out (see `composePhone` in `store-panel.tsx`).
 */
import type { TFunction } from 'i18next';
import { z } from 'zod';

import { COUNTRIES, type CountryCode } from '@/constants/business-types';

// Cast to the literal union (not `string`) so `z.enum` — and everything that
// reads `StoreInfoFormValues['dialCode']` — keeps `CountryCode`, not a bare
// `string` that can't index `COUNTRY_DIAL_CODES`.
const countryCodes = COUNTRIES.map((country) => country.code) as [CountryCode, ...CountryCode[]];

export function buildStoreInfoSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(1, t('validation.companyNameRequired')).max(100),
    dialCode: z.enum(countryCodes),
    phoneDigits: z
      .string()
      .trim()
      .regex(/^\d{10}$/, t('validation.phoneInvalid'))
      .optional()
      .or(z.literal('')),
    address: z.string().trim().max(240).optional().or(z.literal('')),
  });
}

export type StoreInfoFormValues = z.infer<ReturnType<typeof buildStoreInfoSchema>>;
