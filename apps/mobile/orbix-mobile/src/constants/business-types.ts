/**
 * Temporary local catalog of business types.
 *
 * The list and its emoji come straight from the Claude Design prototype. Each
 * entry is mapped to the Prisma enums the API already understands, so the
 * moment `GET /catalogs/business-types` ships (see `src/dto/onboarding.dto.ts`)
 * the remote catalog transparently replaces this one — `BusinessTypeRepository`
 * prefers the server list and falls back here.
 *
 * `BusinessVertical` drives operational behaviour; `BusinessProfile` is the
 * structural shape fixed at provisioning time and is *not* editable later, so
 * these mappings are the conservative choice for each type.
 */
import type { BusinessType } from '@/models/business-type';
import { BusinessProfile, BusinessVertical } from '@/types/api';

export const LOCAL_BUSINESS_TYPES: readonly BusinessType[] = [
  {
    id: 'tienda',
    icon: '🛍',
    labelKey: 'businessTypes.tienda',
    businessVertical: BusinessVertical.RETAIL,
    businessProfile: BusinessProfile.RETAIL,
    sortOrder: 0,
  },
  {
    id: 'restaurante',
    icon: '🍽',
    labelKey: 'businessTypes.restaurante',
    businessVertical: BusinessVertical.RESTAURANT,
    businessProfile: BusinessProfile.RESTAURANT,
    sortOrder: 1,
  },
  {
    id: 'cafeteria',
    icon: '☕',
    labelKey: 'businessTypes.cafeteria',
    businessVertical: BusinessVertical.RESTAURANT,
    businessProfile: BusinessProfile.RESTAURANT,
    sortOrder: 2,
  },
  {
    id: 'belleza',
    icon: '💄',
    labelKey: 'businessTypes.belleza',
    businessVertical: BusinessVertical.SERVICES,
    businessProfile: BusinessProfile.SERVICES,
    sortOrder: 3,
  },
  {
    id: 'salud',
    icon: '🏥',
    labelKey: 'businessTypes.salud',
    businessVertical: BusinessVertical.SERVICES,
    businessProfile: BusinessProfile.SERVICES,
    sortOrder: 4,
  },
  {
    id: 'gimnasio',
    icon: '🏋️',
    labelKey: 'businessTypes.gimnasio',
    businessVertical: BusinessVertical.GYM,
    businessProfile: BusinessProfile.SERVICES,
    sortOrder: 5,
  },
  {
    id: 'servicios',
    icon: '🏢',
    labelKey: 'businessTypes.servicios',
    businessVertical: BusinessVertical.SERVICES,
    businessProfile: BusinessProfile.SERVICES,
    sortOrder: 6,
  },
  {
    id: 'distribuidora',
    icon: '📦',
    labelKey: 'businessTypes.distribuidora',
    businessVertical: BusinessVertical.RETAIL,
    businessProfile: BusinessProfile.RETAIL,
    sortOrder: 7,
  },
  {
    id: 'educacion',
    icon: '🎓',
    labelKey: 'businessTypes.educacion',
    businessVertical: BusinessVertical.SERVICES,
    businessProfile: BusinessProfile.SERVICES,
    sortOrder: 8,
  },
  {
    id: 'otro',
    icon: '📋',
    labelKey: 'businessTypes.otro',
    businessVertical: BusinessVertical.RETAIL,
    businessProfile: BusinessProfile.RETAIL,
    sortOrder: 9,
  },
] as const;

/** Countries offered in the wizard, with their default currency and timezone. */
export const COUNTRIES = [
  { code: 'MX', labelKey: 'countries.MX', currency: 'MXN', timezone: 'America/Mexico_City' },
  { code: 'CO', labelKey: 'countries.CO', currency: 'COP', timezone: 'America/Bogota' },
  { code: 'AR', labelKey: 'countries.AR', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' },
  { code: 'CL', labelKey: 'countries.CL', currency: 'CLP', timezone: 'America/Santiago' },
  { code: 'PE', labelKey: 'countries.PE', currency: 'PEN', timezone: 'America/Lima' },
  { code: 'US', labelKey: 'countries.US', currency: 'USD', timezone: 'America/New_York' },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]['code'];

export const CURRENCIES = ['MXN', 'COP', 'ARS', 'CLP', 'PEN', 'USD'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** Dial codes used to build the E.164 number sent to the OTP endpoint. */
export const COUNTRY_DIAL_CODES: Record<CountryCode, string> = {
  MX: '+52',
  CO: '+57',
  AR: '+54',
  CL: '+56',
  PE: '+51',
  US: '+1',
};
