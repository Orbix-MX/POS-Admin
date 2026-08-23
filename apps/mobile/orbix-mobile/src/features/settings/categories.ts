/**
 * Single source of truth for the Configuración category list — read by the
 * phone list (pushes `route`), the tablet master-detail pane (renders the
 * matching panel inline instead), and nothing else, so adding a category
 * never means touching two files that can drift.
 *
 * No `labelKey` string here — same reasoning as `DrawerModule` in
 * `app-drawer.tsx`: `key` is a literal union, so callers build
 * `t(\`settings.categories.${key}.title\`)` and TypeScript still catches a
 * typo against the real translation schema, without a second string to keep
 * in sync with `key`.
 *
 * `status: 'soon'` is not a placeholder for "we'll wire it eventually with
 * fake data" — it means the row is honestly inert until the corresponding
 * Orbix module exists. No invented functionality ships, ever.
 */
import type { ComponentType } from 'react';

import {
  ChartIcon,
  InfoIcon,
  PackageIcon,
  PercentIcon,
  PlugIcon,
  PrinterIcon,
  SettingsIcon,
  StoreIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from '@/components/ui/icons';
import type { ThemeColors } from '@/theme/types';

export type SettingsCategoryKey =
  | 'general'
  | 'store'
  | 'products'
  | 'cash'
  | 'payments'
  | 'taxes'
  | 'printing'
  | 'users'
  | 'integrations'
  | 'about';

export interface SettingsCategory {
  key: SettingsCategoryKey;
  Icon: ComponentType<IconProps>;
  status: 'live' | 'soon';
  /**
   * Icon tile colours, as `ThemeColors` keys (resolved against the active
   * theme at render time, never a literal) — a different hue per category so
   * the list reads at a glance instead of ten identical blue squares. Pulled
   * only from tokens the app already defines for something else (status
   * pairs, the brand ramp): no new colour enters the system for this.
   */
  tintBg: keyof ThemeColors;
  tintFg: keyof ThemeColors;
  /** Phone push target; only categories with a built panel have one. */
  route?: '/(app)/settings/general' | '/(app)/settings/store';
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { key: 'general', Icon: SettingsIcon, status: 'live', route: '/(app)/settings/general', tintBg: 'brandBlue50', tintFg: 'brandBlue600' },
  { key: 'store', Icon: StoreIcon, status: 'live', route: '/(app)/settings/store', tintBg: 'successBg', tintFg: 'successFg' },
  { key: 'products', Icon: PackageIcon, status: 'soon', tintBg: 'warningBg', tintFg: 'warningFg' },
  { key: 'cash', Icon: ChartIcon, status: 'soon', tintBg: 'infoBg', tintFg: 'infoFg' },
  { key: 'payments', Icon: WalletIcon, status: 'soon', tintBg: 'muted', tintFg: 'accentPurple' },
  { key: 'taxes', Icon: PercentIcon, status: 'soon', tintBg: 'muted', tintFg: 'accentPink' },
  { key: 'printing', Icon: PrinterIcon, status: 'soon', tintBg: 'neutralBg', tintFg: 'neutralFg' },
  { key: 'users', Icon: UsersIcon, status: 'soon', tintBg: 'muted', tintFg: 'brandTeal400' },
  { key: 'integrations', Icon: PlugIcon, status: 'soon', tintBg: 'brandBlue50', tintFg: 'accentPurple' },
  { key: 'about', Icon: InfoIcon, status: 'soon', tintBg: 'neutralBg', tintFg: 'neutralFg' },
];
