/**
 * Company-wizard schemas, one per step.
 *
 * Split by step so each screen validates only its own fields — a single schema
 * would mark step 3 invalid while the user is still on step 1.
 */
import type { TFunction } from 'i18next';
import { z } from 'zod';

import { COUNTRIES, CURRENCIES } from '@/constants/business-types';

const countryCodes = COUNTRIES.map((country) => country.code) as [string, ...string[]];

export function buildStep1Schema(t: TFunction) {
  return z.object({
    companyName: z.string().trim().min(1, t('validation.companyNameRequired')).max(100),
    ownerName: z.string().trim().min(1, t('validation.ownerNameRequired')).max(100),
    phone: z
      .string()
      .trim()
      .min(1, t('validation.phoneRequired'))
      // Digits only; the country dial code is prepended when sending to the API.
      .regex(/^\d{10}$/, t('validation.phoneInvalid')),
    countryCode: z.enum(countryCodes),
    currency: z.enum(CURRENCIES),
  });
}

export function buildStep2Schema(t: TFunction) {
  return z.object({
    businessTypeId: z.string().min(1, t('validation.businessTypeRequired')),
  });
}

export function buildOtpSchema(t: TFunction) {
  return z.object({
    code: z.string().regex(/^\d{6}$/, t('validation.otpIncomplete')),
  });
}

export type Step1Values = z.infer<ReturnType<typeof buildStep1Schema>>;
export type Step2Values = z.infer<ReturnType<typeof buildStep2Schema>>;
export type OtpValues = z.infer<ReturnType<typeof buildOtpSchema>>;

/** Everything the wizard collects, persisted as a draft between launches. */
export interface WizardDraft extends Step1Values, Step2Values {
  /** 1-based; restored so a crash resumes on the same step. */
  step: number;
  phoneVerified: boolean;
  /** Handle returned by `POST /auth/phone/send-code`. */
  verificationId?: string;
  updatedAt: string;
}

export const EMPTY_DRAFT: WizardDraft = {
  step: 1,
  companyName: '',
  ownerName: '',
  phone: '',
  countryCode: 'MX',
  currency: 'MXN',
  businessTypeId: '',
  phoneVerified: false,
  updatedAt: '',
};
