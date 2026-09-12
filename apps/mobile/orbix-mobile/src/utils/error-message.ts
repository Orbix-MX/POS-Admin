/**
 * Turns any thrown value into a sentence a user can act on.
 *
 * The API's own message wins whenever it is specific (validation, conflicts);
 * transport failures get a localized generic instead, because "Network Error"
 * means nothing to a shop owner.
 */
import type { TFunction } from 'i18next';

import { ApiError, NotImplementedError } from '@/services/api';

/**
 * El servidor pide el PIN de un supervisor para completar la operación.
 *
 * No es un fallo: es el camino previsto para un cajero sin el permiso. Quien
 * llama lo distingue para abrir la hoja del PIN en vez de pintar un error.
 *
 * Se mira `code` y no el mensaje: `resolveCashAuthorizer` lanza
 * `ForbiddenException({ code, message, permission })`, y el mensaje viene
 * traducido — sobre él no se puede ramificar.
 */
export function isAuthorizationRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'AUTHORIZATION_REQUIRED';
}

/**
 * El PIN no sirve. El servidor devuelve lo mismo para un PIN inexistente y para
 * uno sin permiso — distinguirlos dejaría sondear qué PINes existen desde la
 * terminal—, así que el mensaje también es uno solo.
 */
export function isAuthorizationInvalid(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'AUTHORIZATION_INVALID';
}

/**
 * La operación necesita una caja abierta y no la hay — o la sesión dejó de
 * estar `ABIERTA` (un arqueo la congela) entre que se pintó la pantalla y se
 * pulsó el botón.
 */
export function isNoOpenCashSession(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    /no hay sesión de caja activa|sesión de caja no encontrada/i.test(error.message)
  );
}

/**
 * Un 403 del `RequireModuleGuard`: el módulo no entra en el plan del tenant.
 *
 * Se separa del resto de los 403 porque no es una falta de permiso ni un error
 * a resolver — es una función que ese plan no incluye, y pintarla en rojo
 * miente sobre lo que pasó.
 */
export function isModuleNotEnabled(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.kind === 'forbidden' &&
    /module '.*' not enabled/i.test(error.message)
  );
}

export function toUserMessage(error: unknown, t: TFunction): string {
  if (error instanceof NotImplementedError) {
    return t('errors.notImplemented');
  }

  if (error instanceof ApiError) {
    // Los del dominio de caja se comprueban antes del `kind`: llegan como 400 o
    // 403 genéricos y su mensaje crudo no le dice nada al cajero.
    if (isAuthorizationRequired(error)) return t('cash.errors.authorizationRequired');
    if (isAuthorizationInvalid(error)) return t('cash.errors.authorizationInvalid');
    if (isNoOpenCashSession(error)) return t('cash.errors.noOpenSession');
    if (isModuleNotEnabled(error)) return t('errors.moduleNotInPlan');

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
