import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { ResetPlatformPasswordDto } from './dto/reset-platform-password.dto';
import { ChangePlatformPasswordDto } from './dto/change-platform-password.dto';
import { PlatformAuthResponseDto, PlatformUserResponseDto } from './dto/platform-auth-response.dto';
import { PlatformJwtPayload } from './strategies/platform-jwt.strategy';
import type { PlatformUser } from '@prisma/client';

/** The authenticated caller, as the platform JWT strategy resolves it. */
export type PlatformActor = Pick<PlatformUser, 'id' | 'email' | 'role'>;

@Injectable()
export class PlatformAuthService {
  private readonly logger = new Logger(PlatformAuthService.name);

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

  /**
   * Administrative reset of ANOTHER platform user's password.
   *
   * Restricted to SUPER_ADMIN: a SUPPORT account that could rewrite a
   * SUPER_ADMIN's password would be able to take over the whole platform (every
   * tenant). Changing your own password goes through `changeOwnPassword`, which
   * demands the current one; this path deliberately does not, because it exists
   * precisely for the case where the owner cannot sign in.
   */
  async resetPassword(dto: ResetPlatformPasswordDto, actor: PlatformActor): Promise<void> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Solo un SUPER_ADMIN puede restablecer la contraseña de otra cuenta.',
      );
    }

    const user = await this.prisma.platformUser.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Platform user not found');

    const hashed = await PasswordUtil.hash(dto.newPassword);
    await this.prisma.platformUser.update({
      where: { id: dto.userId },
      data: { password: hashed },
    });

    await this.writeAuditLog(actor.id, 'PLATFORM_PASSWORD_RESET', user.id, {
      targetEmail: user.email,
      targetRole: user.role,
    });
  }

  /**
   * Self-service password change. Requires the current password so a leaked or
   * borrowed session cannot lock the real owner out of their own account.
   */
  async changeOwnPassword(
    actor: PlatformActor,
    dto: ChangePlatformPasswordDto,
  ): Promise<void> {
    const user = await this.prisma.platformUser.findUnique({ where: { id: actor.id } });
    if (!user) throw new NotFoundException('Platform user not found');

    const valid = await PasswordUtil.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('La contraseña actual no es correcta.');

    const hashed = await PasswordUtil.hash(dto.newPassword);
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    await this.writeAuditLog(user.id, 'PLATFORM_PASSWORD_CHANGE', user.id, {
      targetEmail: user.email,
    });
  }

  /** Best-effort audit write: never break the operation it is recording. */
  private async writeAuditLog(
    platformUserId: string,
    action: string,
    entityId: string,
    after: Prisma.InputJsonValue,
  ): Promise<void> {
    try {
      await this.prisma.platformAuditLog.create({
        data: {
          platformUserId,
          action,
          entityType: 'PlatformUser',
          entityId,
          after,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write platform audit log (${action} ${entityId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
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
