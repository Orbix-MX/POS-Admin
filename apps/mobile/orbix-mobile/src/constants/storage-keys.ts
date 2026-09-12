/**
 * Every persisted key in one place, so a stale key is a compile error rather
 * than a typo that silently loses data.
 *
 * `SecureKeys` land in the device keychain/keystore (expo-secure-store);
 * `StorageKeys` land in MMKV, which is fast but *not* encrypted — never put a
 * token there.
 */

export const SecureKeys = {
  accessToken: 'orbix.auth.accessToken',
  refreshToken: 'orbix.auth.refreshToken',
} as const;

export const StorageKeys = {
  /** Cached `GET /auth/me` payload, for instant cold start. */
  session: 'orbix.session',
  /** Active tenant slug + branch id, restored on relaunch. */
  activeContext: 'orbix.tenant.activeContext',
  /** Tenant branding (white-label theme) keyed by tenant id. */
  branding: 'orbix.theme.branding',
  /** User-chosen light/dark/system preference. */
  themeMode: 'orbix.theme.mode',
  /** Whether the onboarding carousel has been seen. */
  onboardingCompleted: 'orbix.onboarding.completed',
  /** Auto-saved company wizard draft, so a crash does not lose progress. */
  wizardDraft: 'orbix.onboarding.wizardDraft',
  /** Locale override; absent means "follow the device". */
  locale: 'orbix.i18n.locale',
  /** TanStack Query offline cache. */
  queryCache: 'orbix.query.cache',
  /** Business-type catalog synced from the backend. */
  businessTypes: 'orbix.catalog.businessTypes',
  /**
   * Which `(app)` screen to land on after auth — a per-device convenience,
   * unlike `decimalPlaces` (tenant-wide, lives in `Tenant.settings` instead).
   */
  homeScreen: 'orbix.prefs.homeScreen',
  /** Sort order for the product grid on the POS sell screen. */
  posSortBy: 'orbix.prefs.posSortBy',
  /**
   * Caja física que opera **este dispositivo**.
   *
   * Va por dispositivo y no por usuario porque la caja pertenece al puesto: un
   * relevo de turno entra en la misma terminal y continúa la misma sesión, sin
   * cerrar ni volver a abrir. Sin esto, `GET /cash-sessions/active` tiene que
   * adivinar cuál de las cajas vivas de la sucursal mirar, y con dos cajeros
   * los cobros de uno acaban en el cajón del otro.
   */
  cashRegisterId: 'orbix.cash.registerId',
} as const;

export type SecureKey = (typeof SecureKeys)[keyof typeof SecureKeys];
export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
