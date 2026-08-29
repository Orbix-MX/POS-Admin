/**
 * Google sign-in via `expo-auth-session` (PKCE, authorization-code flow).
 *
 * Fully wired end to end: builds the request from the env client IDs, opens
 * the browser, and hands the authorization code to `POST /auth/google` via
 * `useAuth().loginWithGoogle`. When the account has MFA on, that call returns
 * `null` and `RouteGuard` takes over (status flips to `'mfa-pending'`) — see
 * `src/dto/onboarding.dto.ts` for the wire contract.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { env, isGoogleAuthConfigured } from '@/constants/env';
import type { GoogleSignInRequestDto } from '@/dto/onboarding.dto';
import { useAuth } from '@/hooks/use-auth';

// Required so the auth popup closes itself after the redirect on web/Expo Go.
WebBrowser.maybeCompleteAuthSession();

const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/** Picks the client ID registered for the current platform. */
function resolveClientId(): string | undefined {
  if (Platform.OS === 'ios') return env.google.iosClientId ?? env.google.clientId;
  if (Platform.OS === 'android') return env.google.androidClientId ?? env.google.clientId;
  return env.google.webClientId ?? env.google.clientId;
}

function resolvePlatform(): GoogleSignInRequestDto['platform'] {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

export interface UseGoogleAuthResult {
  /** False when no client ID is configured — the button is hidden. */
  available: boolean;
  isPending: boolean;
  signIn: () => Promise<void>;
  error: unknown;
}

export function useGoogleAuth(onSuccess?: () => void): UseGoogleAuthResult {
  const { loginWithGoogle } = useAuth();
  const clientId = resolveClientId();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Google's Android/iOS OAuth client types only accept a redirect scheme
  // derived from the app's own package name / bundle id (reverse-DNS) —
  // a generic scheme like `orbix://` is rejected ("doesn't comply with
  // OAuth 2.0 policy", Error 400: invalid_request) since any app could
  // register it. The app's main `orbix://` scheme (used for regular deep
  // links) stays untouched; this one is Google-flow-only. Registered
  // alongside it in app.json's `scheme` array.
  const redirectUri = useMemo(
    () =>
      Platform.OS === 'web'
        ? AuthSession.makeRedirectUri({ scheme: 'orbix', path: 'auth/google' })
        : AuthSession.makeRedirectUri({ scheme: 'com.orbix.mobile', path: 'oauth2redirect' }),
    [],
  );

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? '',
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
    },
    DISCOVERY,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;

    const code = response.params.code;
    if (!code) return;

    setIsPending(true);
    setError(null);

    const body: GoogleSignInRequestDto = {
      code,
      codeVerifier: request.codeVerifier,
      redirectUri,
      platform: resolvePlatform(),
    };

    loginWithGoogle(body)
      // `null` means MFA kicked in — `RouteGuard` already redirected off this
      // screen by the time this resolves, nothing left to do here.
      .then((session) => {
        if (session) onSuccess?.();
      })
      .catch(setError)
      .finally(() => setIsPending(false));
  }, [response, request, redirectUri, onSuccess, loginWithGoogle]);

  const signIn = useCallback(async () => {
    setError(null);
    await promptAsync();
  }, [promptAsync]);

  return {
    available: isGoogleAuthConfigured && Boolean(clientId) && Boolean(request),
    isPending,
    signIn,
    error,
  };
}
