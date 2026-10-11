/**
 * i18n bootstrap.
 *
 * Initialised at module load (before the first render) so no screen ever paints
 * an untranslated key. The active locale is mirrored into the API client's
 * `Accept-Language` header, so backend validation messages come back localized.
 */
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { env } from '@/constants/env';
import { StorageKeys } from '@/constants/storage-keys';
import { setAcceptLanguage } from '@/services/api';
import { kvStorage } from '@/services/storage/kv-storage';

import { en } from './locales/en';
import { es } from './locales/es';
import { pt } from './locales/pt';

export const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const resources = {
  es: { translation: es },
  en: { translation: en },
  pt: { translation: pt },
} as const;

function isSupported(tag: string | undefined): tag is SupportedLocale {
  return SUPPORTED_LOCALES.includes(tag as SupportedLocale);
}

/** Stored override → device language → env default. */
function resolveInitialLocale(): SupportedLocale {
  const stored = kvStorage.getString(StorageKeys.locale);
  if (isSupported(stored)) return stored;

  const deviceTag = Localization.getLocales()[0]?.languageCode ?? undefined;
  if (isSupported(deviceTag)) return deviceTag;

  return env.defaultLocale;
}

const initialLocale = resolveInitialLocale();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: 'es',
  // React already escapes everything it renders.
  interpolation: { escapeValue: false },
  returnNull: false,
});

setAcceptLanguage(initialLocale);

export function changeLocale(locale: SupportedLocale): void {
  kvStorage.setString(StorageKeys.locale, locale);
  setAcceptLanguage(locale);
  void i18n.changeLanguage(locale);
}

export function getCurrentLocale(): SupportedLocale {
  return isSupported(i18n.language) ? i18n.language : 'es';
}

export default i18n;
