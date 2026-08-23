/**
 * Mirrors `TenantInfo` from `api/src/modules/core/tenants/tenants.service.ts`
 * exactly — a subset only, the fields this app actually reads or writes.
 * `address` is a single free-text field server-side (`Tenant.settings.address`,
 * untyped JSON): there is no street/city/state/zip breakdown to bind to, so
 * the store screen captures one field rather than inventing structure the
 * backend can't store.
 */
export interface TenantInfoDto {
  name: string;
  displayName?: string;
  logoUrl?: string;
  bannerUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  rfc?: string;
  timezone?: string;
  currency?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export type UpdateTenantInfoRequest = Partial<TenantInfoDto>;

/**
 * `GET/PATCH /tenants/current/settings` is a free-form JSON merge-patch on
 * the API side (`Record<string, unknown>`) — this app only claims and types
 * the one key it actually reads: `decimalPlaces`. Any other key already
 * living in that blob (or added by another client) passes through untouched
 * on every `PATCH`, because we only ever send the one field we're changing.
 */
export interface TenantSettingsDto {
  /** `false` → whole-currency amounts (`$150`), matching a cash-only retail habit. */
  decimalPlaces?: boolean;
  [key: string]: unknown;
}
