import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import googleOAuthConfig from './google-oauth.config';
import mfaConfig from './mfa.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, googleOAuthConfig, mfaConfig],
      envFilePath: '.env',
    }),
  ],
})
export class ConfigModule {}
