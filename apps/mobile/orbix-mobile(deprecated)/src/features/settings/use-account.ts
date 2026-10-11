/**
 * Account-level mutations for the Security settings panel: unlinking Google
 * and requesting a password reset by email. Linking Google is handled by
 * `use-google-link.ts` — it needs the PKCE round trip, not a plain mutation.
 */
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { authService } from '@/services/auth/auth-service';
import { toUserMessage } from '@/utils/error-message';

export function useUnlinkGoogle() {
  const { t } = useTranslation();
  return useMutation<void, unknown, void>({
    mutationFn: () => authService.unlinkGoogle(),
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useRequestPasswordReset() {
  const { t } = useTranslation();
  return useMutation<void, unknown, string>({
    mutationFn: (email) => authService.requestPasswordReset(email),
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}
