import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.platformSecret') as string,
        signOptions: {
          // Ver auth.module.ts: jwt.config.ts ya garantiza un valor, este
          // segundo fallback era muerto y discrepaba en silencio del real.
          expiresIn: configService.get<string>('jwt.expiresIn') as `${number}${'s'|'m'|'h'|'d'|'w'}`,
        },
      }),
    }),
  ],
  controllers: [PlatformAuthController],
  providers: [PlatformAuthService, PlatformJwtStrategy],
  exports: [PlatformAuthService, JwtModule],
})
export class PlatformAuthModule {}
