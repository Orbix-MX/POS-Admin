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

  return useMutation<Session, unknown, SignInValues>({
    mutationFn: (values) => login(values.email, values.password),
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
