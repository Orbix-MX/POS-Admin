import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';

/** Perfil normalizado que la estrategia entrega al controller vía `req.user`. */
export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

/**
 * Flujo de redirect (authorization code) contra Google.
 *
 * Solo se registra como provider cuando hay credenciales — ver AuthModule. El
 * `state` del flujo lo genera Passport; el destino del frontend viaja aparte,
 * firmado por nosotros, para no depender de que Google conserve el parámetro.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('googleOAuth.clientId') as string,
      clientSecret: config.get<string>('googleOAuth.clientSecret') as string,
      callbackURL: config.get<string>('googleOAuth.callbackUrl') as string,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const primary = profile.emails?.[0];

    if (!primary?.value) {
      done(new Error('La cuenta de Google no expone un correo'), false);
      return;
    }

    const normalized: GoogleProfile = {
      googleId: profile.id,
      email: primary.value.toLowerCase(),
      // passport-google-oauth20 tipa `verified` como string ('true') en unas
      // versiones y boolean en otras — normalizamos ambas.
      emailVerified: String((primary as { verified?: unknown }).verified) === 'true',
      firstName: profile.name?.givenName?.trim() || primary.value.split('@')[0],
      lastName: profile.name?.familyName?.trim() || '',
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, normalized);
  }
}
