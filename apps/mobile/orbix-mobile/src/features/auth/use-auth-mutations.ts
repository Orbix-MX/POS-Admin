/**
 * Auth mutations.
 *
 * Screens call these; they never touch axios or the repositories directly. Each
 * one clears the query cache on success so no data from a previous account can
 * leak into the new session.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/use-auth';
import type { Session } from '@/models/session';
import { toUserMessage } from '@/utils/error-message';

import type { SignInValues, SignUpValues } from './schemas';

export function useSignUp() {
  const { register } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Session, unknown, SignUpValues>({
    mutationFn: (values) =>
      register({ name: values.name, email: values.email, password: values.password }),
    onSuccess: () => {
      queryClient.clear();
    },
    // Surfaced by the form; kept here so every caller gets the same wording.
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useSignIn() {
  const { login } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // `null` means the account has MFA on — `RouteGuard` reacts to the status
  // flip and shows the challenge screen; there is no session to cache yet.
  return useMutation<Session | null, unknown, SignInValues>({
    mutationFn: (values) => login(values.email, values.password),
    onSuccess: (result) => {
      if (result) queryClient.clear();
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useVerifyMfa() {
  const { verifyMfa } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<Session, unknown, string>({
    mutationFn: (code) => verifyMfa(code),
    onSuccess: () => {
      queryClient.clear();
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useSignOut() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
