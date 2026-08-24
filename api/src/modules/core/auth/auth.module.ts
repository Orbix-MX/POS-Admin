import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { OAuthTicketService } from './services/oauth-ticket.service';
import { GoogleLinkTicketService } from './services/google-link-ticket.service';
import { MfaService } from './services/mfa.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailModule } from '../email/email.module';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LicenseGuard } from '../../../common/guards/license.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequireModuleGuard } from '../../../common/guards/require-module.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') as string,
        signOptions: {
          // `jwt.config.ts` ya garantiza un valor (default 1d si falta la env
          // var) — el `|| '7d'` que había aquí era un segundo fallback muerto,
          // nunca alcanzable, que además discrepaba en silencio del default real.
          expiresIn: configService.get<string>('jwt.expiresIn') as `${number}${'s'|'m'|'h'|'d'|'w'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    TokenBlacklistService,
    RefreshTokenService,
    OAuthTicketService,
    GoogleLinkTicketService,
    MfaService,
    PasswordResetService,
    GoogleOAuthGuard,
    // La estrategia de Google solo se registra si hay credenciales: sin ellas
    // `passport-google-oauth20` lanza en el constructor y tumba el arranque del
    // API entero. El guard responde 503 en ese caso.
    {
      provide: GoogleStrategy,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get<boolean>('googleOAuth.enabled')
          ? new GoogleStrategy(configService)
          : null,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: LicenseGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RequireModuleGuard,
    },
  ],
  exports: [AuthService, TokenBlacklistService, RefreshTokenService, OAuthTicketService],
})
export class AuthModule {}
