import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleMobileSignInDto } from '../dto/google-mobile-signin.dto';

export interface MobileGoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

/**
 * Lado servidor del PKCE que `orbix-mobile` ya hace con `expo-auth-session`:
 * la app manda un `code` (o, si la plataforma no lo permite, un `idToken`) y
 * aquí se canjea/verifica contra Google antes de resolver la identidad —
 * igual de estricto que `GoogleStrategy` en el flujo de redirect de la web,
 * solo que sin passport porque no hay redirect que capturar.
 */
@Injectable()
export class GoogleMobileAuthService {
  constructor(private readonly config: ConfigService) {}

  private clientIdFor(platform: 'ios' | 'android' | 'web'): string {
    const clientId = this.config.get<Record<string, string | undefined>>('googleOAuth.mobile.clientIds')?.[platform];
    if (!clientId) {
      throw new ServiceUnavailableException(
        `El acceso con Google no está configurado para ${platform} en este servidor`,
      );
    }
    return clientId;
  }

  /**
   * Client "servidor" contra el que se verifica un `id_token` emitido por el
   * SDK nativo de Google (Credential Manager / Google Sign-In). Android e iOS
   * no pueden emitir/verificar id_tokens por sí solos — solo autorizan qué
   * app puede pedirlos (por package+SHA-1 / bundle id); quien firma el token
   * de verdad es siempre el client tipo Web pasado como `serverClientId` al
   * configurar el SDK en la app. Reutiliza el client Web del admin
   * (`googleOAuth.clientId`) salvo que se registre uno dedicado para móvil.
   */
  private serverClientId(): string {
    const clientId =
      this.config.get<string>('googleOAuth.mobile.clientIds.web') ?? this.config.get<string>('googleOAuth.clientId');
    if (!clientId) {
      throw new ServiceUnavailableException('El acceso con Google no está configurado en este servidor');
    }
    return clientId;
  }

  /** Verifica el `code`/`idToken` del body y devuelve el perfil normalizado. */
  async verify(dto: GoogleMobileSignInDto): Promise<MobileGoogleProfile> {
    // Emitido por el SDK nativo (Credential Manager) — ver `serverClientId`.
    // No hay code/PKCE que canjear, se verifica directo.
    if (dto.idToken) {
      const audience = this.serverClientId();
      return this.verifyIdToken(new OAuth2Client(), dto.idToken, audience);
    }

    if (!dto.code || !dto.codeVerifier || !dto.redirectUri) {
      throw new BadRequestException('Falta code, codeVerifier o redirectUri');
    }

    const clientId = this.clientIdFor(dto.platform);
    const client = new OAuth2Client(clientId);

    // Google solo pide client_secret al tipo de cliente "Web" — iOS/Android
    // son públicos y PKCE es toda la prueba de posesión que da el cliente.
    const webSecret =
      dto.platform === 'web' ? this.config.get<string>('googleOAuth.mobile.webClientSecret') : undefined;

    let tokens;
    try {
      ({ tokens } = await client.getToken({
        code: dto.code,
        codeVerifier: dto.codeVerifier,
        redirect_uri: dto.redirectUri,
        client_id: clientId,
        ...(webSecret && { client_secret: webSecret }),
      }));
    } catch {
      throw new UnauthorizedException('No fue posible validar el código de Google');
    }

    if (!tokens.id_token) {
      throw new UnauthorizedException('Google no devolvió un id_token');
    }

    return this.verifyIdToken(client, tokens.id_token, clientId);
  }

  private async verifyIdToken(client: OAuth2Client, idToken: string, audience: string): Promise<MobileGoogleProfile> {
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('id_token de Google inválido');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('El token de Google no incluye un correo');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      firstName: payload.given_name?.trim() || payload.email.split('@')[0],
      lastName: payload.family_name?.trim() || '',
      avatarUrl: payload.picture,
    };
  }
}
