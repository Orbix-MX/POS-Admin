/**
 * Google sign-in via `expo-auth-session` (PKCE, authorization-code flow).
 *
 * The client side is fully implemented: it builds the request from the env
 * client IDs, opens the browser, and hands the authorization code to the API.
 *
 * ⚠️ The exchange endpoint `POST /api/auth/google` does not exist yet, so the
 * final step throws `NotImplementedError`. Nothing here is mocked — the flow is
 * wired end to end and starts working the moment the backend lands. See
 * `src/dto/onboarding.dto.ts` for the contract the server must honour.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { env, isGoogleAuthConfigured } from '@/constants/env';
import type { GoogleSignInRequestDto } from '@/dto/onboarding.dto';
import { onboardingRepository } from '@/repositories/onboarding-repository';

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
  const clientId = resolveClientId();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'orbix', path: 'auth/google' }),
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

    onboardingRepository
      .signInWithGoogle({
        code,
        codeVerifier: request.codeVerifier,
        redirectUri,
        platform: resolvePlatform(),
      })
      .then(() => onSuccess?.())
      .catch(setError)
      .finally(() => setIsPending(false));
  }, [response, request, redirectUri, onSuccess]);

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
