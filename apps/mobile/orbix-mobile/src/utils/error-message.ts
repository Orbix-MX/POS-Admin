/**
 * Turns any thrown value into a sentence a user can act on.
 *
 * The API's own message wins whenever it is specific (validation, conflicts);
 * transport failures get a localized generic instead, because "Network Error"
 * means nothing to a shop owner.
 */
import type { TFunction } from 'i18next';

import { ApiError, NotImplementedError } from '@/services/api';

export function toUserMessage(error: unknown, t: TFunction): string {
  if (error instanceof NotImplementedError) {
    return t('errors.notImplemented');
  }

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return t('errors.network');
      case 'timeout':
        return t('errors.timeout');
      case 'server':
        return t('errors.server');
      case 'forbidden':
        return t('errors.forbidden');
      case 'unauthorized':
        return t('auth.errors.invalidCredentials');
      case 'rateLimited':
        return t('auth.errors.tooManyAttempts');
      case 'conflict':
        return error.message || t('auth.errors.emailTaken');
      case 'validation':
        return error.message || t('common.genericError');
      default:
        return error.message || t('common.genericError');
    }
  }

  return t('common.genericError');
}
