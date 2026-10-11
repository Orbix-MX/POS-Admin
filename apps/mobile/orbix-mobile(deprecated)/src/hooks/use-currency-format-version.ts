/**
 * Forces a re-render whenever `currencyFormatStore` changes.
 *
 * Call this once per *screen* that renders money (`(app)/index.tsx`,
 * `products/index.tsx`, `pos/index.tsx`) — not in every leaf that calls
 * `formatCurrency()` (`product-card.tsx`, `checkout-sheet.tsx` rows). A
 * screen re-rendering re-renders its whole subtree, so those leaves pick up
 * the fresh value for free; subscribing at every leaf would just multiply
 * listeners for no benefit.
 *
 * The returned number is intentionally unused by callers — `useSyncExternalStore`
 * needs a return value to know when to bail out of re-rendering, but the
 * point here is the re-render itself, not the value.
 */
import { useSyncExternalStore } from 'react';

import { currencyFormatStore } from '@/services/currency/currency-format-store';

export function useCurrencyFormatVersion(): number {
  return useSyncExternalStore(currencyFormatStore.subscribe, currencyFormatStore.getVersion);
}
