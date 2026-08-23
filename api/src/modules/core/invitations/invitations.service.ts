import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { AuditService } from '../../../common/services/audit.service';
import { EffectivePermissionsService } from '../../../common/services/effective-permissions.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { EmailService } from '../email/email.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

/** Lo que ve quien abre el enlace, antes de aceptar. */
export interface InvitationPreview {
  email: string;
  tenantName: string;
  invitedByName: string | null;
  /** true si ya tiene cuenta: entonces se le pide iniciar sesión, no una contraseña. */
  accountExists: boolean;
  expiresAt: Date;
}

/**
 * Invitaciones para unirse a una empresa.
 *
 * Un administrador no puede meter a alguien en su empresa sin más: la persona
 * acepta desde su correo. Eso cubre dos problemas que el alta directa tenía —
 * nadie entra a una empresa sin enterarse, y nadie fija la contraseña de otro,
 * que era la vía para apropiarse de una cuenta ajena (y con ella, de las demás
 * empresas de esa persona).
 *
 * El token viaja en el enlace y solo se guarda hasheado, igual que los refresh
 * tokens y los tickets de OAuth.
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  /** Vida del enlace. Suficiente para que alguien lo vea sin dejarlo vivo indefinidamente. */
  private static readonly TTL_HOURS = 72;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly auditContext: AuditContextService,
    private readonly audit: AuditService,
    private readonly effectivePermissions: EffectivePermissionsService,
    private readonly planLimits: PlanLimitsService,
    private readonly email: EmailService,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Crea la invitación y manda el correo.
   *
   * No revela por respuesta si el correo tenía cuenta: quien invita ya lo sabrá
   * al recibirla la persona, pero la respuesta es idéntica en ambos casos.
   */
  async invite(dto: CreateInvitationDto): Promise<{ id: string; expiresAt: Date }> {
    const tenantId = this.tenantContext.requireTenantId();
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    if (existingUser) {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: existingUser.id } },
        select: { status: true },
      });
      if (membership) {
        throw new ConflictException('Esa persona ya pertenece a esta empresa.');
      }
      if (existingUser.status !== 'ACTIVE') {
        throw new ConflictException('Esa cuenta no está activa.');
      }
    }

    // Los roles se validan al invitar Y al aceptar: entre ambos momentos pueden
    // borrarse, y quien invita podría además no tener derecho a otorgarlos.
    const roleIds = dto.roleIds ?? [];
    await this.assertRolesAssignable(tenantId, roleIds);

    // Aceptar consumirá un asiento; avisar ahora evita mandar un correo que
    // acabará en un error.
    await this.planLimits.assertCanAddActiveUser(tenantId);

    // Una invitación viva por correo y empresa: reinvitar reemplaza la anterior,
    // de modo que un enlace antiguo deja de servir.
    await this.prisma.tenantInvitation.updateMany({
      where: { tenantId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const raw = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + InvitationsService.TTL_HOURS * 3600_000);

    const invitation = await this.prisma.tenantInvitation.create({
      data: {
        tenantId,
        email,
        tokenHash: this.hash(raw),
        roleIds,
        invitedById: this.auditContext.getUserId() ?? null,
        expiresAt,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    await this.email.sendTenantInvitation({
      to: email,
      tenantName: tenant?.name ?? 'la empresa',
      acceptUrl: this.buildAcceptUrl(raw),
      expiresAt,
    });

    await this.audit.log({
      action: 'USER_INVITED',
      entityType: 'TenantInvitation',
      entityId: invitation.id,
      // Nunca el token: quien leyera el log podría aceptar la invitación.
      after: { email, roleIds, expiresAt },
    });

    return { id: invitation.id, expiresAt };
  }

  /** El enlace apunta al frontend, que es quien muestra la pantalla de aceptación. */
  private buildAcceptUrl(rawToken: string): string {
    const base =
      this.config.get<string>('FRONTEND_URL') ??
      process.env.FRONTEND_URL ??
      'http://localhost:5173';

    return `${base.replace(/\/$/, '')}/invitacion/${rawToken}`;
  }

  /**
   * Quien invita no puede repartir permisos que no tiene, ni roles de otra
   * empresa: la misma regla que en la asignación directa de roles.
   */
  private async assertRolesAssignable(tenantId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, tenantId },
      select: { id: true },
    });
    if (roles.length !== new Set(roleIds).size) {
      throw new BadRequestException('Alguno de los roles no existe en esta empresa.');
    }

    await this.effectivePermissions.assertActorCanGrant(
      await this.effectivePermissions.keysForRoles(roleIds, tenantId),
    );
  }

  /** Busca una invitación viva por su token crudo. */
  private async findLive(rawToken: string) {
    const invitation = await this.prisma.tenantInvitation.findUnique({
      where: { tokenHash: this.hash(rawToken ?? '') },
      include: {
        tenant: { select: { name: true, status: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!invitation || invitation.revokedAt) {
      throw new NotFoundException('Esta invitación no es válida.');
    }
    if (invitation.acceptedAt) {
      throw new ConflictException('Esta invitación ya fue aceptada.');
    }
    if (invitation.expiresAt <= new Date()) {
      throw new NotFoundException('Esta invitación ha caducado. Pide una nueva.');
    }

    return invitation;
  }

  /** Datos para pintar la pantalla de aceptación. Público: aún no hay sesión. */
  async preview(rawToken: string): Promise<InvitationPreview> {
    const invitation = await this.findLive(rawToken);

    const account = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    return {
      email: invitation.email,
      tenantName: invitation.tenant.name,
      invitedByName: invitation.invitedBy
        ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`
        : null,
      accountExists: Boolean(account),
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Acepta la invitación y crea la membresía.
   *
   * Dos caminos según exista la cuenta o no:
   *  - existe  → hay que estar autenticado como ESE correo. Tener el enlace no
   *    basta: si no, quien lo interceptara entraría sin saber la contraseña.
   *  - no existe → la persona fija aquí su contraseña, y esa es la prueba de que
   *    el buzón es suyo.
   */
  async accept(
    rawToken: string,
    dto: AcceptInvitationDto,
    authenticatedUserId?: string,
  ): Promise<{ tenantId: string; tenantSlug: string }> {
    const invitation = await this.findLive(rawToken);

    if (invitation.tenant.status !== 'ACTIVE' && invitation.tenant.status !== 'TRIAL') {
      throw new ConflictException('La empresa que te invitó ya no está activa.');
    }

    const account = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, status: true },
    });

    const userId = account
      ? await this.acceptWithExistingAccount(account, authenticatedUserId)
      : await this.acceptWithNewAccount(invitation.email, dto);

    // Se revalidan aquí: entre invitar y aceptar pueden haber desaparecido.
    const roles = await this.prisma.role.findMany({
      where: { id: { in: invitation.roleIds }, tenantId: invitation.tenantId },
      select: { id: true },
    });

    await this.planLimits.assertCanAddActiveUser(invitation.tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantMembership.create({
        data: { tenantId: invitation.tenantId, userId, role: 'STAFF', status: 'ACTIVE' },
      });

      if (roles.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: roles.map((r) => ({ userId, roleId: r.id, tenantId: invitation.tenantId })),
          skipDuplicates: true,
        });
      }

      await tx.tenantInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: invitation.tenantId },
      select: { slug: true },
    });

    this.logger.log(`Invitación aceptada: ${invitation.email} → ${invitation.tenantId}`);

    return { tenantId: invitation.tenantId, tenantSlug: tenant?.slug ?? '' };
  }

  /** La cuenta ya existe: solo su dueño, con sesión iniciada, puede aceptar. */
  private async acceptWithExistingAccount(
    account: { id: string; status: string },
    authenticatedUserId?: string,
  ): Promise<string> {
    if (!authenticatedUserId) {
      throw new UnauthorizedException({
        code: 'LOGIN_REQUIRED',
        message: 'Inicia sesión con ese correo para aceptar la invitación.',
      });
    }
    if (authenticatedUserId !== account.id) {
      throw new UnauthorizedException({
        code: 'WRONG_ACCOUNT',
        message: 'La invitación es para otra cuenta. Inicia sesión con el correo invitado.',
      });
    }
    if (account.status !== 'ACTIVE') {
      throw new ConflictException('Esa cuenta no está activa.');
    }

    return account.id;
  }

  /** No hay cuenta: la persona la crea aquí eligiendo su contraseña. */
  private async acceptWithNewAccount(
    email: string,
    dto: AcceptInvitationDto,
  ): Promise<string> {
    if (!dto?.password || !dto.firstName || !dto.lastName) {
      throw new BadRequestException({
        code: 'ACCOUNT_SETUP_REQUIRED',
        message: 'Completa tu nombre y elige una contraseña para crear tu cuenta.',
      });
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        password: await PasswordUtil.hash(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'STAFF',
        status: 'ACTIVE',
        // El correo llegó a su buzón y respondió: eso lo da por verificado.
        emailVerified: true,
      },
    });

    return user.id;
  }

  /** Invitaciones vivas de la empresa, para poder revisarlas y revocarlas. */
  async listPending() {
    const tenantId = this.tenantContext.requireTenantId();

    return this.prisma.tenantInvitation.findMany({
      where: { tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, roleIds: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();

    const invitation = await this.prisma.tenantInvitation.findFirst({
      where: { id, tenantId },
      select: { id: true, email: true },
    });
    if (!invitation) throw new NotFoundException('Invitación no encontrada.');

    await this.prisma.tenantInvitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      action: 'USER_INVITE_REVOKED',
      entityType: 'TenantInvitation',
      entityId: id,
      before: { email: invitation.email },
    });
  }
}
