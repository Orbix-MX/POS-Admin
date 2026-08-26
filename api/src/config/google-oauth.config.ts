import { registerAs } from '@nestjs/config';

/**
 * Credenciales del cliente OAuth de Google.
 *
 * A diferencia de `jwt.config`, aquí no se lanza si faltan: el ERP debe poder
 * arrancar sin Google configurado. `GoogleStrategy` solo se registra cuando
 * `enabled` es true, y los endpoints /auth/google responden 503 en ese caso.
 *
 * `callbackUrl` debe coincidir carácter por carácter con el "Authorized redirect
 * URI" del cliente en Google Cloud Console, o Google devuelve redirect_uri_mismatch.
 *
 * `allowedRedirects` es la allowlist de destinos del frontend tras el callback.
 * Sin ella el `state` del flujo convertiría este endpoint en un open redirect.
 */
export default registerAs('googleOAuth', () => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  const allowedRedirects = (
    process.env.OAUTH_ALLOWED_REDIRECTS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175'
  )
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  // Clientes OAuth de la app móvil (Expo/orbix-mobile) — PKCE, un client_id
  // "público" por plataforma (iOS/Android no llevan secreto; el de tipo Web
  // sí, aunque el intercambio use PKCE, por cómo Google trata ese tipo de
  // cliente). Independientes del client de la web de administración de
  // arriba: cada uno se registra en Google Cloud Console con su propio
  // package name / bundle id / redirect URI.
  const mobileIosClientId = process.env.GOOGLE_MOBILE_IOS_CLIENT_ID?.trim();
  const mobileAndroidClientId = process.env.GOOGLE_MOBILE_ANDROID_CLIENT_ID?.trim();
  const mobileWebClientId = process.env.GOOGLE_MOBILE_WEB_CLIENT_ID?.trim();
  const mobileWebClientSecret = process.env.GOOGLE_MOBILE_WEB_CLIENT_SECRET?.trim();

  return {
    enabled: Boolean(clientId && clientSecret),
    clientId: clientId ?? '',
    clientSecret: clientSecret ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL?.trim() || 'http://localhost:3001/api/auth/google/callback',
    allowedRedirects,
    defaultRedirect: allowedRedirects[0] ?? 'http://localhost:5173',
    /** Vida del ticket de un solo uso que el frontend canjea por la sesión. */
    ticketTtlSeconds: Number(process.env.OAUTH_TICKET_TTL_SECONDS) || 120,
    mobile: {
      clientIds: {
        ios: mobileIosClientId,
        android: mobileAndroidClientId,
        web: mobileWebClientId,
      },
      webClientSecret: mobileWebClientSecret,
    },
  };
});
