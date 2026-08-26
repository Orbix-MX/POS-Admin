import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * `POST /auth/google` — contrato que `orbix-mobile` ya definió del lado
 * cliente (`src/dto/onboarding.dto.ts::GoogleSignInRequestDto`) antes de que
 * este endpoint existiera. Se respeta tal cual para no forzar un release de
 * la app.
 */
export class GoogleMobileSignInDto {
  /** Authorization code del flujo PKCE. Preferido sobre `idToken`. */
  @ValidateIf((o) => !o.idToken)
  @IsString()
  code?: string;

  /** Verifier de PKCE — requerido junto con `code`. */
  @ValidateIf((o) => !o.idToken)
  @IsString()
  codeVerifier?: string;

  /** Redirect URI con el que se pidió `code`; debe calzar con el registrado en Google. */
  @ValidateIf((o) => !o.idToken)
  @IsString()
  redirectUri?: string;

  /** Alternativa cuando la plataforma solo entrega un id_token. */
  @ValidateIf((o) => !o.code)
  @IsString()
  idToken?: string;

  @IsEnum(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';

  /**
   * Presente solo cuando la app pide "vincular" desde una sesión ya activa
   * (ver `POST /auth/google/link-start`) — mismo mecanismo que la web.
   */
  @IsOptional()
  @IsString()
  linkTicket?: string;
}
