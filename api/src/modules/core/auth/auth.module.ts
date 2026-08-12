import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LicenseGuard } from '../../../common/guards/license.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequireModuleGuard } from '../../../common/guards/require-module.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') as string,
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') || '7d') as `${number}${'s'|'m'|'h'|'d'|'w'}`,
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
  exports: [AuthService, TokenBlacklistService, RefreshTokenService],
})
export class AuthModule {}
