/**
 * MFA (TOTP) management mutations for the Security settings panel.
 *
 * Enabling/disabling flips `session.user.mfaEnabled`, which only `GET
 * /auth/me` returns — the caller (`SecurityPanel`) refreshes the session on
 * success rather than patching the flag locally.
 */
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { MfaConfirmResponseDto, MfaSetupResponseDto } from '@/dto/auth.dto';
import { authService } from '@/services/auth/auth-service';
import { toUserMessage } from '@/utils/error-message';

export function useSetupMfa() {
  const { t } = useTranslation();
  return useMutation<MfaSetupResponseDto, unknown, void>({
    mutationFn: () => authService.setupMfa(),
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useConfirmMfa() {
  const { t } = useTranslation();
  return useMutation<MfaConfirmResponseDto, unknown, string>({
    mutationFn: (code) => authService.confirmMfa(code),
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useDisableMfa() {
  const { t } = useTranslation();
  return useMutation<void, unknown, string>({
    mutationFn: (code) => authService.disableMfa(code),
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}
