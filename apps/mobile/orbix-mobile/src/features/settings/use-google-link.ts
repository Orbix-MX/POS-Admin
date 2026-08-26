/**
 * "Vincular con Google" desde una sesión ya autenticada — mismo PKCE que
 * `use-google-auth.ts`, pero antepone `POST /auth/google/link-start` para
 * obtener el `linkTicket` que el backend exige en este camino (ver
 * `AuthService.linkGoogleIdentity` / `GoogleLinkTicketService`, ya usados por
 * el flujo web equivalente).
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { env, isGoogleAuthConfigured } from '@/constants/env';
import type { GoogleSignInRequestDto } from '@/dto/onboarding.dto';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth/auth-service';

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

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

export interface UseGoogleLinkResult {
  available: boolean;
  isPending: boolean;
  link: () => Promise<void>;
  error: unknown;
}

export function useGoogleLink(onSuccess?: () => void): UseGoogleLinkResult {
  const { applySession } = useAuth();
  const clientId = resolveClientId();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // `promptAsync` fires the browser immediately; the ticket has to already be
  // in hand by the time the response effect runs, so it's fetched in `link()`
  // and stashed here rather than re-fetched after the redirect.
  const linkTicketRef = useRef<string | null>(null);

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
    if (!response || !linkTicketRef.current) return;

    // The browser was dismissed or cancelled before a code came back — there
    // is no exchange to make, but `link()` already flipped `isPending`.
    if (response.type !== 'success' || !request?.codeVerifier || !response.params.code) {
      linkTicketRef.current = null;
      setIsPending(false);
      return;
    }

    const code = response.params.code;
    const linkTicket = linkTicketRef.current;
    setError(null);

    const body: GoogleSignInRequestDto = {
      code,
      codeVerifier: request.codeVerifier,
      redirectUri,
      platform: resolvePlatform(),
      linkTicket,
    };

    authService
      .linkGoogleAccount(body)
      .then((session) => {
        applySession(session);
        onSuccess?.();
      })
      .catch(setError)
      .finally(() => {
        linkTicketRef.current = null;
        setIsPending(false);
      });
  }, [response, request, redirectUri, onSuccess, applySession]);

  const link = useCallback(async () => {
    setError(null);
    setIsPending(true);
    try {
      linkTicketRef.current = await authService.startGoogleLink();
      await promptAsync();
    } catch (err) {
      setError(err);
      setIsPending(false);
    }
  }, [promptAsync]);

  return {
    available: isGoogleAuthConfigured && Boolean(clientId) && Boolean(request),
    isPending,
    link,
    error,
  };
}
