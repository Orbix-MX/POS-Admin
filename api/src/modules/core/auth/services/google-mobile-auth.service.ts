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

  /** Verifica el `code`/`idToken` del body y devuelve el perfil normalizado. */
  async verify(dto: GoogleMobileSignInDto): Promise<MobileGoogleProfile> {
    const clientId = this.clientIdFor(dto.platform);
    const client = new OAuth2Client(clientId);

    let idToken: string;

    if (dto.idToken) {
      idToken = dto.idToken;
    } else {
      if (!dto.code || !dto.codeVerifier || !dto.redirectUri) {
        throw new BadRequestException('Falta code, codeVerifier o redirectUri');
      }

      // Google solo pide client_secret al tipo de cliente "Web" — iOS/Android
      // son públicos y PKCE es toda la prueba de posesión que da el cliente.
      const webSecret =
        dto.platform === 'web'
          ? this.config.get<string>('googleOAuth.mobile.webClientSecret')
          : undefined;

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
      idToken = tokens.id_token;
    }

    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
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
