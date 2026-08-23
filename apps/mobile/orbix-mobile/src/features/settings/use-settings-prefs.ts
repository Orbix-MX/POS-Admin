/**
 * Per-device preferences — home screen and POS sort order. Both live in
 * `kvStorage` (MMKV), same tier as `themeMode`/`locale`: a personal display
 * convenience, not a business rule, so it's this phone's alone and never
 * round-trips to the API. `decimalPlaces` is the opposite case (tenant-wide)
 * and lives in `use-tenant-settings.ts` instead.
 *
 * No React Context: each of the two consumers (`(app)/index.tsx` on mount,
 * `pos/index.tsx` on mount) only ever needs "the value as of when I mounted",
 * not live cross-screen sync — a plain hook per call site is enough.
 */
import { useCallback, useState } from 'react';

import { StorageKeys } from '@/constants/storage-keys';
import { kvStorage } from '@/services/storage/kv-storage';

export type HomeScreenPref = 'inicio' | 'ventas' | 'inventario' | 'clientes';
export type PosSortByPref = 'createdAt' | 'name';

const HOME_SCREEN_DEFAULT: HomeScreenPref = 'inicio';
const POS_SORT_DEFAULT: PosSortByPref = 'createdAt';

function isHomeScreenPref(value: string | undefined): value is HomeScreenPref {
  return value === 'inicio' || value === 'ventas' || value === 'inventario' || value === 'clientes';
}

function isPosSortByPref(value: string | undefined): value is PosSortByPref {
  return value === 'createdAt' || value === 'name';
}

export function getHomeScreenPref(): HomeScreenPref {
  const stored = kvStorage.getString(StorageKeys.homeScreen);
  return isHomeScreenPref(stored) ? stored : HOME_SCREEN_DEFAULT;
}

export function useHomeScreenPref() {
  const [value, setValue] = useState<HomeScreenPref>(getHomeScreenPref);

  const setPref = useCallback((next: HomeScreenPref) => {
    kvStorage.setString(StorageKeys.homeScreen, next);
    setValue(next);
  }, []);

  return { value, setPref };
}

export function getPosSortByPref(): PosSortByPref {
  const stored = kvStorage.getString(StorageKeys.posSortBy);
  return isPosSortByPref(stored) ? stored : POS_SORT_DEFAULT;
}

export function usePosSortByPref() {
  const [value, setValue] = useState<PosSortByPref>(getPosSortByPref);

  const setPref = useCallback((next: PosSortByPref) => {
    kvStorage.setString(StorageKeys.posSortBy, next);
    setValue(next);
  }, []);

  return { value, setPref };
}
