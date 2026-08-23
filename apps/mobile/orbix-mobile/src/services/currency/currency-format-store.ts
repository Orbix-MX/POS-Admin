/**
 * Synchronous singleton for "what currency and how many decimals right now"
 * — same shape as `authTokenStore`/`networkStatus`: state that many leaf
 * components (`product-card.tsx`, `checkout-sheet.tsx`, list rows) need to
 * read on every render, so it can't be a React Query result threaded through
 * props without turning every price cell into a hook consumer.
 *
 * `CurrencyFormatSync` (`providers/currency-format-sync.tsx`) is the only
 * writer — it mirrors `TenantInfo.currency` and `TenantSettings.decimalPlaces`
 * in here whenever those queries resolve. Until the first sync, everything
 * reads through `DEFAULT_FORMAT` (MXN, 2 decimals) — the same fallback the
 * old hardcoded `formatCurrency` implementations used, so nothing regresses
 * before the tenant's real settings arrive.
 *
 * Subscribable via `useSyncExternalStore` (`use-currency-format-version.ts`):
 * a plain module variable updates instantly, but React has no way to know a
 * component that already rendered with the old value needs to render again.
 * Toggling "Casas decimales" then navigating back to Home without an
 * unrelated re-render in between reproduced exactly that — the KPI kept
 * showing the stale format. The subscription list exists so the handful of
 * screens that render money (not every leaf — see the hook's own comment)
 * can opt into being told when to re-render.
 */
export interface CurrencyFormat {
  currency: string;
  /** `false` collapses to whole-currency amounts (`$150`, not `$150.00`). */
  decimalPlaces: boolean;
}

const DEFAULT_FORMAT: CurrencyFormat = { currency: 'MXN', decimalPlaces: true };

let current: CurrencyFormat = DEFAULT_FORMAT;
let version = 0;
const listeners = new Set<() => void>();

export const currencyFormatStore = {
  get(): CurrencyFormat {
    return current;
  },

  getVersion(): number {
    return version;
  },

  set(format: Partial<CurrencyFormat>): void {
    current = { ...current, ...format };
    version += 1;
    for (const listener of listeners) listener();
  },

  reset(): void {
    current = DEFAULT_FORMAT;
    version += 1;
    for (const listener of listeners) listener();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  format(value: number): string {
    const digits = current.decimalPlaces ? 2 : 0;
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: current.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  },
} as const;
