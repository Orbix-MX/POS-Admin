/**
 * Auth form schemas.
 *
 * Built as factories over `t` so validation messages are localized. The
 * constraints mirror the API's `class-validator` decorators exactly
 * (`RegisterDto`: password ≥ 6, names 2–50), so the client never accepts input
 * the server will reject.
 */
import type { TFunction } from 'i18next';
import { z } from 'zod';

export function buildSignUpSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('validation.nameRequired'))
      .min(2, t('validation.nameTooShort'))
      .max(100),
    email: z
      .string()
      .trim()
      .min(1, t('validation.emailRequired'))
      .pipe(z.email(t('validation.emailInvalid'))),
    password: z
      .string()
      .min(1, t('validation.passwordRequired'))
      .min(6, t('validation.passwordTooShort'))
      .max(50),
  });
}

export function buildSignInSchema(t: TFunction) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, t('validation.emailRequired'))
      .pipe(z.email(t('validation.emailInvalid'))),
    password: z.string().min(1, t('validation.passwordRequired')),
  });
}

export function buildMfaChallengeSchema(t: TFunction) {
  return z.object({
    // 6 dígitos de TOTP o un backup code de 10 — no se valida el formato más
    // estricto aquí, el servidor es quien realmente sabe cuál es cuál.
    code: z.string().trim().min(6, t('validation.codeRequired')).max(10),
  });
}

export type SignUpValues = z.infer<ReturnType<typeof buildSignUpSchema>>;
export type SignInValues = z.infer<ReturnType<typeof buildSignInSchema>>;
export type MfaChallengeValues = z.infer<ReturnType<typeof buildMfaChallengeSchema>>;
