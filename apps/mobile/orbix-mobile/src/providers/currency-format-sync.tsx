/**
 * Mirrors the tenant's real currency (`TenantInfo.currency`) and decimal
 * preference (`TenantSettings.decimalPlaces`) into `currencyFormatStore`,
 * so every `formatCurrency()` call in the app — home KPIs, product prices,
 * the POS cart — reflects what's actually configured instead of the
 * hardcoded `MXN` / 2-decimals every price in the app used before this.
 *
 * Headless, same shape as `TenantThemeSync`: reacts to query results, renders
 * nothing.
 */
import { useEffect } from 'react';

import { useTenantInfo, useTenantSettings } from '@/features/tenant/use-tenant-settings';
import { currencyFormatStore } from '@/services/currency/currency-format-store';

export function CurrencyFormatSync() {
  const { data: info } = useTenantInfo();
  const { data: settings } = useTenantSettings();

  useEffect(() => {
    if (info?.currency) currencyFormatStore.set({ currency: info.currency });
  }, [info?.currency]);

  useEffect(() => {
    if (settings?.decimalPlaces !== undefined) {
      currencyFormatStore.set({ decimalPlaces: settings.decimalPlaces });
    }
  }, [settings?.decimalPlaces]);

  return null;
}
