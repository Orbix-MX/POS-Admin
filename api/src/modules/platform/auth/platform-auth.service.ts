import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformAuthResponseDto, PlatformUserResponseDto } from './dto/platform-auth-response.dto';
import { PlatformJwtPayload } from './strategies/platform-jwt.strategy';
import type { PlatformUser } from '@prisma/client';

@Injectable()
export class PlatformAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: PlatformLoginDto): Promise<PlatformAuthResponseDto> {
    const user = await this.prisma.platformUser.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await PasswordUtil.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const accessToken = this.generateToken(user);
    return { accessToken, user: this.mapUser(user) };
  }

  private generateToken(user: PlatformUser): string {
    const payload: PlatformJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isPlatform: true,
      jti: randomUUID(),
    };
    return this.jwtService.sign(payload);
  }

  private mapUser(user: PlatformUser): PlatformUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
