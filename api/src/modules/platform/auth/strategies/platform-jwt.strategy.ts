import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../database/prisma.service';
import { PlatformUserRole } from '@prisma/client';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  role: PlatformUserRole;
  isPlatform: true;
  jti?: string;
  exp?: number;
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') as string,
    });
  }

  async validate(payload: PlatformJwtPayload) {
    if (!payload.isPlatform) {
      throw new UnauthorizedException('Invalid token type for platform access');
    }

    const user = await this.prisma.platformUser.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Platform user not found or inactive');
    }

    return user;
  }
}
