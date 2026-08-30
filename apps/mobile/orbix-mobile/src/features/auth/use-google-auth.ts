/**
 * Google sign-in.
 *
 * Native (Android/iOS): `@react-native-google-signin/google-signin`, which
 * wraps Android's Credential Manager / iOS's native Google Sign-In SDK. No
 * redirect URI involved — Google deprecated custom URI scheme redirects for
 * Android/iOS OAuth clients (Error 400: invalid_request, "doesn't comply
 * with OAuth 2.0 policy" even with "Enable custom URI scheme" checked on a
 * freshly-created client; see git history on this file for that dead end).
 * The SDK hands back an `id_token` whose `aud` is always the "Web"-type
 * client passed as `webClientId` — Android/iOS client types can't issue
 * id_tokens themselves, they only authorize which app (by package+SHA-1 /
 * bundle id) may request one from the paired Web client. That's why
 * `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` matters here even on Android, and why
 * the backend verifies against `googleOAuth.mobile.clientIds.web` (falling
 * back to the admin's own Web client) instead of the per-platform id for
 * this flow — see `GoogleMobileAuthService.serverClientId`.
 *
 * Web: unchanged, still `expo-auth-session`'s PKCE redirect flow — the
 * custom-scheme restriction is Android/iOS-only, and there's no native SDK
 * to reach for on web anyway.
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

function useGoogleAuthNative(onSuccess?: () => void): UseGoogleAuthResult {
  const { loginWithGoogle } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (!env.google.webClientId) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: keep this out of the web bundle
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: env.google.webClientId });
    setConfigured(true);
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    setIsPending(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleSignin, isSuccessResponse } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // user cancelled

      const idToken: string | null = response.data.idToken;
      if (!idToken) throw new Error('Google no devolvió un id_token');

      const body: GoogleSignInRequestDto = { idToken, platform: resolvePlatform() };
      const session = await loginWithGoogle(body);
      // `null` means MFA kicked in — `RouteGuard` already redirected off this
      // screen by the time this resolves, nothing left to do here.
      if (session) onSuccess?.();
    } catch (err) {
      setError(err);
    } finally {
      setIsPending(false);
    }
  }, [loginWithGoogle, onSuccess]);

  return {
    available: isGoogleAuthConfigured && Boolean(env.google.webClientId) && configured,
    isPending,
    signIn,
    error,
  };
}

function useGoogleAuthWeb(onSuccess?: () => void): UseGoogleAuthResult {
  const { loginWithGoogle } = useAuth();
  const clientId = env.google.webClientId ?? env.google.clientId;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const redirectUri = useMemo(() => AuthSession.makeRedirectUri({ scheme: 'orbix', path: 'auth/google' }), []);

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

    const body: GoogleSignInRequestDto = { code, codeVerifier: request.codeVerifier, redirectUri, platform: 'web' };

    loginWithGoogle(body)
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

export function useGoogleAuth(onSuccess?: () => void): UseGoogleAuthResult {
  // Hook choice is branched on a build-time constant (Platform.OS never
  // changes at runtime), not a value that can change between renders — the
  // rules-of-hooks conditional-hook-call concern doesn't apply here.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return Platform.OS === 'web' ? useGoogleAuthWeb(onSuccess) : useGoogleAuthNative(onSuccess);
}
