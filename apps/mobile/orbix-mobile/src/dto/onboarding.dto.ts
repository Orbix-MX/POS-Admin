/**
 * Contracts for the self-service onboarding flow.
 *
 * ⚠️  NONE of these endpoints exist in the Orbix API yet (verified against
 * `pos-admin/api/src` on 2026-08-06). The types below are the *expected*
 * contract, written so the mobile side is ready the day the backend ships them.
 * The repositories that consume them throw `NotImplementedError` rather than
 * faking a response — see `src/repositories/onboarding-repository.ts`.
 *
 * Gap summary:
 *   • `POST /auth/google`            — no OAuth provider wired in NestJS.
 *   • `POST /auth/phone/send-code`   — no SMS provider configured.
 *   • `POST /auth/phone/verify-code` — idem.
 *   • `POST /tenants/onboarding`     — `POST /tenants` exists but is guarded by
 *                                      `@Roles('SUPER_ADMIN')`, so a freshly
 *                                      registered user cannot call it.
 *   • `GET  /catalogs/business-types`— the `BusinessVertical` / `BusinessProfile`
 *                                      enums exist in Prisma but are not exposed.
 */
import type { BusinessProfile, BusinessVertical } from '@/types/api';

import type { AuthResponseDto, TenantSummaryDto } from './auth.dto';

/* ── Google OAuth ────────────────────────────────────────────────────────── */

/**
 * TODO(backend): `POST /api/auth/google` — public, throttled like `/auth/login`.
 *
 * The app performs the PKCE dance with Google via `expo-auth-session` and sends
 * the resulting authorization code (preferred) or id_token to the API. The API
 * must verify it against the Google client IDs, then create-or-link the `User`
 * and return the same `AuthResponseDto` as `/auth/login` so the client keeps a
 * single session path.
 */
export interface GoogleSignInRequestDto {
  /** Authorization code from the PKCE flow. Preferred over `idToken`. */
  code?: string;
  /** PKCE verifier matching `code`. Required when `code` is sent. */
  codeVerifier?: string;
  /** Redirect URI the code was issued for; must match the client registration. */
  redirectUri?: string;
  /** Fallback for platforms where only an id_token is available. */
  idToken?: string;
  platform: 'ios' | 'android' | 'web';
}

/** Response is identical to `/auth/login` — reuse the same session handling. */
export type GoogleSignInResponseDto = AuthResponseDto;

/* ── Phone verification (OTP) ────────────────────────────────────────────── */

/**
 * TODO(backend): `POST /api/auth/phone/send-code` — authenticated (Bearer).
 * Rate-limit per user *and* per phone number; the client shows a 60 s cooldown
 * but must not be trusted for it.
 */
export interface SendPhoneCodeRequestDto {
  /** E.164, e.g. `+525512345678`. */
  phone: string;
}

export interface SendPhoneCodeResponseDto {
  /** Opaque handle echoed back on verification; ties the code to this attempt. */
  verificationId: string;
  /** Seconds the client must wait before another send is accepted. */
  resendAfterSeconds: number;
  /** Last two digits, for the "code sent to ••42" copy. */
  maskedPhone: string;
}

/** TODO(backend): `POST /api/auth/phone/verify-code` — authenticated (Bearer). */
export interface VerifyPhoneCodeRequestDto {
  verificationId: string;
  /** Exactly 6 digits. */
  code: string;
}

export interface VerifyPhoneCodeResponseDto {
  verified: boolean;
  /** ISO timestamp; absent when `verified` is false. */
  verifiedAt?: string;
}

/* ── Self-service tenant creation ────────────────────────────────────────── */

/**
 * TODO(backend): `POST /api/tenants/onboarding` — authenticated (Bearer), *not*
 * `@Roles('SUPER_ADMIN')`. Must, in one transaction:
 *   1. create the `Tenant` (slug derived from `name`, uniqueness enforced),
 *   2. create the owner `TenantMembership` with `TenantRole.OWNER`,
 *   3. set `Tenant.ownerUserId` to the caller,
 *   4. create the default `Branch`,
 *   5. seed the default `Role` set for the vertical,
 *   6. return a fresh access token already scoped to the new tenant, so the app
 *      does not need a second `select-tenant` round trip.
 *
 * Rejects when the caller already owns a tenant on the FREE plan.
 */
export interface CreateTenantOnboardingRequestDto {
  /** Company name; the API derives the slug. */
  name: string;
  /** Full name of the owner, used to backfill `User.firstName/lastName`. */
  ownerName: string;
  /** E.164. Should be rejected unless previously verified via the OTP endpoints. */
  phone: string;
  /** ISO 3166-1 alpha-2, e.g. `MX`. */
  countryCode: string;
  /** ISO 4217, e.g. `MXN`. */
  currency: string;
  /** IANA timezone, e.g. `America/Mexico_City`. */
  timezone: string;
  businessVertical: BusinessVertical;
  businessProfile: BusinessProfile;
  /** Catalog id the user picked, for analytics; the enums above drive behaviour. */
  businessTypeId: string;
}

export interface CreateTenantOnboardingResponseDto {
  tenant: TenantSummaryDto;
  /** Access token already carrying `tenantId` — skips `select-tenant`. */
  accessToken: string;
  /** Default branch created alongside the tenant. */
  branchId: string;
}

/* ── Business-type catalog ───────────────────────────────────────────────── */

/**
 * TODO(backend): `GET /api/catalogs/business-types` — public, cacheable.
 * Until it exists the app falls back to the bundled catalog in
 * `src/constants/business-types.ts` and syncs transparently once available.
 */
export interface BusinessTypeDto {
  id: string;
  /** Already localized by the API using `Accept-Language`. */
  label: string;
  /** Emoji or icon key rendered on the selection card. */
  icon: string;
  businessVertical: BusinessVertical;
  businessProfile: BusinessProfile;
  /** Display order; lower comes first. */
  sortOrder: number;
}

export interface BusinessTypeCatalogDto {
  items: BusinessTypeDto[];
  /** Catalog revision, so the client can skip a no-op update. */
  version: string;
}

/* ── Tenant branding (white-label theme) ─────────────────────────────────── */

/**
 * TODO(backend): `GET /api/tenants/current/branding` — authenticated.
 * `GET /tenants/current/info` already returns logo/banner URLs; branding extends
 * it with the palette. The payload must match `TenantBranding` in
 * `src/theme/types.ts`; unknown keys are ignored by the client, so the backend
 * can add tokens without a client release.
 */
export interface TenantBrandingResponseDto {
  tenantId: string;
  logoUrl?: string;
  defaultMode?: 'light' | 'dark' | 'system';
  light?: Record<string, unknown>;
  dark?: Record<string, unknown>;
  updatedAt?: string;
}
