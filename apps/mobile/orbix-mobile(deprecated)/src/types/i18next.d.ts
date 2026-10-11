import type { TranslationSchema } from '@/i18n/locales/es';

/**
 * Makes `t('wizard.step1.title')` autocomplete and a typo a compile error.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: TranslationSchema };
    returnNull: false;
  }
}
