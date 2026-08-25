import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { OAuthTicketService } from './services/oauth-ticket.service';
import { GoogleLinkTicketService } from './services/google-link-ticket.service';
import { MfaService } from './services/mfa.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponseDto,
  UserResponseDto,
  TenantSummaryDto,
  ProfileResponseDto,
  SelectTenantResponseDto,
  SelectBranchResponseDto,
  CapabilitiesResponseDto,
  RefreshResponseDto,
} from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { LicenseService } from '../../../common/services/license.service';
import { TenantMembership, Tenant, TenantRole, TenantPlan, BusinessVertical, BusinessProfile, PosOperationMode, TenantFeature } from '@prisma/client';
import { getModulesForPlan, getAllowedModulesForVertical } from '@orbix/types';
import { buildFeaturesForProfile } from '../../../common/business-config/business-features';

type MembershipWithTenant = TenantMembership & { tenant: Tenant };

@Injectable()
export class AuthService {
  /** Intentos fallidos consecutivos antes del primer bloqueo. */
  static readonly LOCKOUT_THRESHOLD = 5;
  /** Duración del primer bloqueo; se duplica con cada tanda posterior. */
  static readonly LOCKOUT_BASE_MINUTES = 5;
  /** Techo del bloqueo: pasado este punto no crece más. */
  static readonly LOCKOUT_MAX_MINUTES = 60;

  // M-06: `AuditLog` es tenant-scoped (`tenantId` obligatorio en el schema) y
  // un login vive ANTES de seleccionar tenant — no hay a quién atribuírselo
  // ahí. Estos eventos van a un logger estructurado aparte en vez de forzar
  // esa tabla a aceptar filas sin tenant. Sin esto, ningún ataque de este
  // informe (fuerza bruta, robo de sesión, MFA/Google) dejaba rastro alguno.
  private readonly securityLog = new Logger('AuthSecurity');

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenBlacklist: TokenBlacklistService,
    private refreshTokens: RefreshTokenService,
    private oauthTickets: OAuthTicketService,
    private googleLinkTickets: GoogleLinkTicketService,
    private mfa: MfaService,
    private planLimits: PlanLimitsService,
    private licenseService: LicenseService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await PasswordUtil.hash(registerDto.password);
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const accessToken = this.generateToken({ sub: user.id, email: user.email });
    const refreshToken = await this.refreshTokens.issue(user.id);
    return { accessToken, refreshToken, user: this.mapUser(user) };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        tenantMemberships: { include: { tenant: true } },
      },
    });

    if (!user) {
      this.securityLog.warn(`login fallido — correo no existe: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Cuenta creada por OAuth: no hay hash contra el que comparar. Se responde
    // igual que ante credenciales inválidas para no revelar qué correos existen
    // ni con qué proveedor entran.
    if (!user.password) {
      this.securityLog.warn(`login fallido — cuenta sin password local (solo Google): userId=${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // El throttling del controlador es por IP y no frena un ataque lento
    // repartido entre muchas; esto acota los intentos por CUENTA.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.securityLog.warn(`login rechazado — cuenta bloqueada hasta ${user.lockedUntil.toISOString()}: userId=${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await PasswordUtil.compare(loginDto.password, user.password);
    if (!valid) {
      this.securityLog.warn(`login fallido — password incorrecta: userId=${user.id}`);
      await this.registerFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.securityLog.log(`login exitoso: userId=${user.id}`);

    // Entrar bien limpia el contador: un usuario que se equivoca a ratos y
    // acierta nunca acumula hasta el bloqueo.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    return this.completeLogin(user);
  }

  /**
   * Punto único donde un login (contraseña u OAuth) decide si ya puede emitir
   * la sesión o si primero hace falta el código MFA. Sin este corte común,
   * cada camino de login tendría que acordarse por su cuenta de revisar
   * `mfaEnabled` — y bastaría con olvidarlo en uno para dejar un bypass.
   */
  private async completeLogin(
    user: { id: string; email: string; status: string; mfaEnabled: boolean; tenantMemberships: unknown },
  ): Promise<AuthResponseDto> {
    if (user.mfaEnabled) {
      const mfaTicket = await this.mfa.issueChallenge(user.id);
      return { mfaRequired: true, mfaTicket };
    }
    return this.buildSession(user);
  }

  /** Segundo paso del login con MFA: canjea el ticket + código por la sesión real. */
  async completeMfaLogin(mfaTicket: string, code: string): Promise<AuthResponseDto> {
    const userId = await this.mfa.verifyChallenge(mfaTicket, code);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenantMemberships: { include: { tenant: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return this.buildSession(user);
  }

  /**
   * Cuenta el intento fallido y bloquea la cuenta al llegar al umbral.
   *
   * El bloqueo es temporal y crece con cada tanda de fallos, de modo que un
   * atacante pierde cada vez más tiempo mientras que a la persona real le basta
   * esperar unos minutos. No se bloquea de forma permanente a propósito: eso
   * convertiría el mecanismo en una forma de dejar a alguien fuera de su cuenta
   * a voluntad.
   *
   * La respuesta al usuario no cambia (siempre 'Invalid credentials'): decir
   * "cuenta bloqueada" confirmaría que el correo existe.
   */
  private async registerFailedLogin(userId: string, previousAttempts: number): Promise<void> {
    const attempts = previousAttempts + 1;

    const lockMinutes =
      attempts >= AuthService.LOCKOUT_THRESHOLD
        ? Math.min(
            AuthService.LOCKOUT_BASE_MINUTES *
              2 ** Math.floor((attempts - AuthService.LOCKOUT_THRESHOLD) / AuthService.LOCKOUT_THRESHOLD),
            AuthService.LOCKOUT_MAX_MINUTES,
          )
        : 0;

    if (lockMinutes > 0) {
      this.securityLog.warn(`cuenta bloqueada ${lockMinutes} min tras ${attempts} intentos fallidos: userId=${userId}`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        ...(lockMinutes > 0
          ? { lockedUntil: new Date(Date.now() + lockMinutes * 60_000) }
          : {}),
      },
    });
  }

  /**
   * Cierra el login: valida estado de cuenta y de tenants, y emite el par de
   * tokens con la lista de empresas disponibles. Lo comparten el login por
   * contraseña y el canje del ticket de OAuth, para que ambos caminos apliquen
   * exactamente las mismas reglas de acceso.
   */
  private async buildSession(
    user: { id: string; email: string; status: string; tenantMemberships: unknown },
  ): Promise<AuthResponseDto> {
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const memberships = user.tenantMemberships as MembershipWithTenant[];
    const activeMemberships = memberships.filter(
      (m) => m.tenant.status === 'ACTIVE' || m.tenant.status === 'TRIAL',
    );

    if (memberships.length > 0 && activeMemberships.length === 0) {
      const allSuspended = memberships.every((m) => m.tenant.status === 'SUSPENDED');
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: allSuspended ? 'TENANT_SUSPENDED' : 'TENANT_INACTIVE',
          message: allSuspended
            ? 'Tu empresa se encuentra suspendida. Contacta al administrador.'
            : 'La empresa ya no se encuentra activa.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const accessToken = this.generateToken({ sub: user.id, email: user.email });
    const refreshToken = await this.refreshTokens.issue(user.id);
    return {
      accessToken,
      refreshToken,
      user: this.mapUser(user),
      availableTenants: activeMemberships.map((m) => this.mapMembership(m)),
    };
  }

  /**
   * Resuelve la identidad Google del callback a un usuario local y devuelve su id.
   *
   * Tres casos:
   *  1. `googleId` ya vinculado → ese usuario.
   *  2. Correo existente y verificado por Google → se vincula la identidad al
   *     usuario existente (decisión de producto: auto-vinculación solo con
   *     `email_verified`; sin verificar se rechaza, porque bastaría registrar
   *     ese correo en un IdP propio para apropiarse de la cuenta).
   *  3. Correo nuevo → alta de usuario sin contraseña y sin tenant. Cae en el
   *     wizard de `POST /tenants/onboarding` igual que un registro normal.
   */
  async resolveGoogleIdentity(profile: {
    googleId: string;
    email: string;
    emailVerified: boolean;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  }): Promise<string> {
    const email = profile.email.toLowerCase();

    const linked = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (linked) {
      if (linked.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
      // El nombre y la foto pueden cambiar del lado de Google; el correo no se
      // reescribe aquí — mover una cuenta de correo es una operación aparte.
      await this.prisma.user.update({
        where: { id: linked.id },
        data: { avatarUrl: profile.avatarUrl ?? linked.avatarUrl },
      });
      return linked.id;
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      if (!profile.emailVerified) {
        throw new UnauthorizedException(
          'Google no ha verificado ese correo. Entra con tu contraseña.',
        );
      }
      if (byEmail.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

      await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.googleId,
          emailVerified: true,
          avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl,
        },
      });
      return byEmail.id;
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        password: null,
        firstName: profile.firstName,
        lastName: profile.lastName,
        googleId: profile.googleId,
        emailVerified: profile.emailVerified,
        avatarUrl: profile.avatarUrl,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });
    return created.id;
  }

  /**
   * Resuelve el callback de Google cuando el viaje es "Vincular con Google"
   * desde una sesión ya autenticada (`GoogleLinkTicketService`), no un login.
   *
   * A diferencia de `resolveGoogleIdentity`, aquí el usuario objetivo ya se
   * sabe de antemano (viene del ticket, emitido mientras había sesión) — el
   * perfil de Google solo sirve para comprobar que esa identidad no choque
   * con OTRA cuenta de Orbix. Si choca, se rechaza con un error explícito en
   * vez de iniciar sesión como el dueño real de esa identidad, que es lo que
   * pasaba al reusar el login público para vincular.
   */
  async linkGoogleIdentity(
    rawLinkTicket: string,
    profile: { googleId: string; email: string; avatarUrl?: string },
  ): Promise<string> {
    const targetUserId = await this.googleLinkTickets.consume(rawLinkTicket);

    const byGoogleId = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (byGoogleId) {
      if (byGoogleId.id !== targetUserId) {
        throw new BadRequestException('Esta cuenta de Google ya está vinculada a otro usuario de Orbix.');
      }
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { avatarUrl: profile.avatarUrl ?? byGoogleId.avatarUrl },
      });
      return targetUserId;
    }

    const email = profile.email.toLowerCase();
    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail && byEmail.id !== targetUserId) {
      throw new BadRequestException('Ese correo de Google ya tiene una cuenta distinta en Orbix.');
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl },
    });
    this.securityLog.log(`cuenta de Google vinculada: userId=${targetUserId}`);
    return targetUserId;
  }

  /**
   * Canjea el ticket de un solo uso emitido por el callback de OAuth por la
   * sesión completa — mismo shape que `login`, para que el frontend reutilice
   * el flujo de selección de tenant sin ramificar.
   */
  async exchangeOAuthTicket(rawTicket: string): Promise<AuthResponseDto> {
    // Marcar el ticket y leer al usuario van en la misma transacción: si la
    // lectura falla, el rollback devuelve el ticket a "sin usar" y el reintento
    // del usuario funciona. Sin esto, cualquier corte transitorio entre ambos
    // pasos quemaba el ticket y dejaba al usuario con un 401 irrecuperable.
    const user = await this.prisma.$transaction(async (tx) => {
      const userId = await this.oauthTickets.consume(rawTicket, tx);
      return tx.user.findUnique({
        where: { id: userId },
        include: { tenantMemberships: { include: { tenant: true } } },
      });
    });

    if (!user) throw new UnauthorizedException('Ticket inválido o expirado');

    // Fuera de la transacción: es limpieza, y su fallo no debe tirar el canje.
    void this.oauthTickets.purgeExpired();

    return this.completeLogin(user);
  }

  async logout(token: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.refreshTokens.revokeByRaw(refreshToken).catch(() => undefined);
    }
    if (!token) return;
    try {
      const decoded = this.jwtService.decode<JwtPayload>(token);
      if (decoded?.jti && decoded?.exp) {
        await this.tokenBlacklist.revoke(decoded.jti, decoded.exp * 1000);
      }
    } catch {
      // ignore malformed tokens
    }
  }

  /**
   * Rotates a refresh token and re-mints an access token. The new access token's
   * claims are rebuilt from the user's persisted lastTenantSelected /
   * lastBranchSelected, re-validating tenant/membership/branch status against the
   * live DB — so a suspended tenant or deactivated branch drops out of the token.
   */
  async refresh(rawRefreshToken: string): Promise<RefreshResponseDto> {
    const { userId, refreshToken } = await this.refreshTokens.rotate(rawRefreshToken);
    const accessToken = await this.buildAccessTokenForUser(userId);
    return { accessToken, refreshToken };
  }

  // ─── Device enrollment (QR) ──────────────────────────────────────────────────
  // The QR carries only this short-lived, single-use, TENANT-scoped token — not
  // a user session. The app exchanges it (POST /devices/enroll) over HTTPS to
  // register itself against the tenant's license. The token can't be used as
  // Bearer auth (JwtStrategy rejects any token with `typ`) and is burned on
  // first use via the token blacklist. Waiters still log in normally afterward.
  private static readonly ENROLL_TTL_SECONDS = 600;

  async createEnrollmentToken(
    tenantId: string,
    branchId?: string,
  ): Promise<{ token: string; expiresAt: Date; expiresInSeconds: number }> {
    if (!tenantId) {
      throw new BadRequestException('Select a tenant before enrolling a device');
    }
    // Only enroll devices under a valid license.
    await this.licenseService.assertValid(tenantId);

    const ttl = AuthService.ENROLL_TTL_SECONDS;
    const token = this.jwtService.sign(
      { tenantId, branchId, typ: 'enroll', jti: randomUUID() },
      { expiresIn: `${ttl}s` },
    );
    return { token, expiresAt: new Date(Date.now() + ttl * 1000), expiresInSeconds: ttl };
  }

  /** Verifies + burns an enrollment token, returning the tenant it enrolls into. */
  async consumeEnrollmentToken(token: string): Promise<{ tenantId: string; branchId?: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Enrollment code invalid or expired');
    }

    if (payload.typ !== 'enroll' || !payload.jti || !payload.tenantId) {
      throw new UnauthorizedException('Invalid enrollment code');
    }
    if (this.tokenBlacklist.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Enrollment code already used');
    }
    if (payload.exp) await this.tokenBlacklist.revoke(payload.jti, payload.exp * 1000);

    return { tenantId: payload.tenantId, branchId: payload.branchId };
  }

  private async buildAccessTokenForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // No tenant selected yet → preliminary token, same shape as fresh login.
    if (!user.lastTenantSelectedId) {
      return this.generateToken({ sub: user.id, email: user.email });
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenantId: user.lastTenantSelectedId },
      include: { tenant: true },
    });

    const ALLOWED_TENANT_STATUSES = ['ACTIVE', 'TRIAL'];
    // Tenant/membership no longer usable → fall back to preliminary token so the
    // client is forced to re-select a tenant.
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      !ALLOWED_TENANT_STATUSES.includes(membership.tenant.status)
    ) {
      return this.generateToken({ sub: user.id, email: user.email });
    }

    // License gate on refresh — drop to a preliminary (tenant-less) token if the
    // tenant's license is no longer valid, forcing a fresh tenant selection.
    const license = await this.licenseService.validateLicense(membership.tenantId);
    if (!license.valid) {
      return this.generateToken({ sub: user.id, email: user.email });
    }

    const { plan, enabledModules: extraModules, businessVertical } = membership.tenant;
    const effectiveModules = this.computeEffectiveModules(plan, extraModules, businessVertical);

    // Keep the branch only if it is still active under this tenant.
    let branchId: string | undefined;
    if (user.lastBranchSelectedId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: user.lastBranchSelectedId, tenantId: membership.tenantId, status: 'ACTIVE' },
        select: { id: true },
      });
      branchId = branch?.id;
    }

    return this.generateToken({
      sub: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      tenantRole: membership.role,
      branchId,
      plan,
      enabledModules: effectiveModules,
    });
  }

  private computeEffectiveModules(
    plan: TenantPlan,
    extraModules: string[],
    businessVertical: BusinessVertical,
  ): string[] {
    const planModules = getModulesForPlan(plan) as unknown as string[];
    const allModules = [...new Set([...planModules, ...extraModules])];
    return getAllowedModulesForVertical(allModules, businessVertical);
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantMemberships: { select: { tenantId: true, role: true } },
        lastTenantSelected: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    let currentTenant: TenantSummaryDto | undefined;
    if (user.lastTenantSelected) {
      const membership = user.tenantMemberships.find(
        (m) => m.tenantId === user.lastTenantSelectedId,
      );
      currentTenant = {
        id: user.lastTenantSelected.id,
        name: user.lastTenantSelected.name,
        slug: user.lastTenantSelected.slug,
        memberRole: membership?.role ?? 'STAFF',
        plan: user.lastTenantSelected.plan,
      };
    }

    let roles: ProfileResponseDto['roles'];
    let permissions: ProfileResponseDto['permissions'];

    if (user.lastTenantSelectedId) {
      const tenantId = user.lastTenantSelectedId;

      const assignments = await this.prisma.userRoleAssignment.findMany({
        where: { userId, tenantId },
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      });

      roles = assignments.map((a) => ({
        id: a.role.id,
        name: a.role.name,
        description: a.role.description ?? undefined,
        color: a.role.color ?? undefined,
        permissions: a.role.permissions.map((rp) => rp.permission.key),
      }));

      const grants = await this.prisma.userPermissionGrant.findMany({
        where: { userId, tenantId },
        include: { permission: true },
      });

      const effectiveKeys = new Set<string>(roles.flatMap((r) => r.permissions));
      for (const g of grants) {
        if (g.granted) effectiveKeys.add(g.permission.key);
        else effectiveKeys.delete(g.permission.key);
      }
      permissions = [...effectiveKeys];
    }

    return {
      user: this.mapUser(user),
      currentTenant,
      currentBranchId: user.lastBranchSelectedId ?? undefined,
      roles,
      permissions,
    };
  }

  async selectTenant(
    userId: string,
    userEmail: string,
    tenantSlug: string,
  ): Promise<SelectTenantResponseDto> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenant: { slug: tenantSlug } },
      include: { tenant: true },
    });

    if (!membership) throw new UnauthorizedException('Tenant not found or access denied');

    const ALLOWED_TENANT_STATUSES = ['ACTIVE', 'TRIAL'];
    if (!ALLOWED_TENANT_STATUSES.includes(membership.tenant.status)) {
      const tenantStatusMessages: Record<string, string> = {
        CANCELLED: 'La empresa ya no se encuentra activa.',
        SUSPENDED: 'La empresa se encuentra suspendida. Contacta al administrador.',
        EXPIRED: 'La suscripción de la empresa ha expirado.',
        DISABLED: 'La empresa está deshabilitada. Contacta al administrador.',
      };
      const message = tenantStatusMessages[membership.tenant.status] ?? 'La empresa ya no se encuentra activa.';
      throw new HttpException(
        { statusCode: HttpStatus.FORBIDDEN, code: 'TENANT_INACTIVE', message },
        HttpStatus.FORBIDDEN,
      );
    }

    // Per-tenant access gate. Global User.status is checked at login; here we
    // block users whose membership in THIS tenant is not active.
    if (membership.status !== 'ACTIVE') {
      const messages: Record<string, string> = {
        INACTIVE: 'Tu acceso a esta empresa está desactivado. Contacta al administrador.',
        SUSPENDED: 'Tu acceso a esta empresa está suspendido. Contacta al administrador.',
        INVITED: 'Tu invitación a esta empresa está pendiente de activación.',
      };
      throw new UnauthorizedException(
        messages[membership.status] ?? 'Acceso a esta empresa no disponible.',
      );
    }

    // License gate — the tenant must hold a valid license to be entered.
    const license = await this.licenseService.validateLicense(membership.tenantId);
    if (!license.valid) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: `LICENSE_${license.reason}`,
          message: this.licenseService.reasonMessage(license.reason),
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastTenantSelectedId: membership.tenantId,
        lastBranchSelectedId: null,
      },
    });

    const { plan, enabledModules: extraModules, businessVertical } = membership.tenant;
    const effectiveModules = this.computeEffectiveModules(plan, extraModules, businessVertical);

    const accessToken = this.generateToken({
      sub: userId,
      email: userEmail,
      tenantId: membership.tenantId,
      tenantRole: membership.role,
      plan,
      enabledModules: effectiveModules,
    });

    const posOnly = await this.isPosOnlyUser(userId, membership.tenantId);

    return {
      accessToken,
      posOnly,
      plan,
      enabledModules: effectiveModules,
      businessVertical: membership.tenant.businessVertical,
      businessProfile: membership.tenant.businessProfile,
      posOperationMode: membership.tenant.posOperationMode,
      enabledFeatures: membership.tenant.enabledFeatures,
      // Convergence: capabilities derived from the (immutable) business profile.
      // Pure derivation — no request scope needed in the auth flow.
      businessFeatures: buildFeaturesForProfile(membership.tenant.businessProfile),
      tenant: this.mapMembership(membership),
    };
  }

  private async isPosOnlyUser(userId: string, tenantId: string): Promise<boolean> {
    const POS_PERMISSIONS = new Set([
      'pos:access',
      'orders:create', 'orders:view', 'orders:edit',
      'products:view',
      'customers:view', 'customers:create',
      'coupons:view',
    ]);

    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!assignments.length) return false;

    const allPermissions = assignments.flatMap((a) =>
      a.role.permissions.map((rp) => rp.permission.key),
    );

    if (!allPermissions.length) return false;
    if (!allPermissions.includes('pos:access')) return false;

    return allPermissions.every((key) => POS_PERMISSIONS.has(key));
  }

  async selectBranch(
    userId: string,
    userEmail: string,
    tenantId: string | undefined,
    tenantRole: TenantRole | undefined,
    branchId: string,
    plan?: TenantPlan,
    enabledModules?: string[],
  ): Promise<SelectBranchResponseDto> {
    if (!tenantId) {
      throw new BadRequestException('Select a tenant before selecting a branch');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, status: 'ACTIVE' },
    });

    if (!branch) throw new NotFoundException('Branch not found or not accessible');

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastBranchSelectedId: branchId },
    });

    const accessToken = this.generateToken({
      sub: userId,
      email: userEmail,
      tenantId,
      tenantRole,
      branchId,
      plan,
      enabledModules,
    });

    return { branchId, accessToken };
  }

  async getCapabilities(
    plan: TenantPlan,
    enabledModules: string[],
    tenantId?: string,
  ): Promise<CapabilitiesResponseDto> {
    const planModules = getModulesForPlan(plan) as unknown as string[];
    // Los módulos extra (enabledModules) del JWT pueden estar desactualizados si se
    // habilitó/deshabilitó un módulo después de iniciar sesión. Se leen de la BD
    // cuando hay tenant para que el sidebar refleje el estado real sin re-login.
    let effectiveEnabledModules = enabledModules;

    let maxUsers: number | null = null;
    let activeUsers = 0;
    let overUserLimit = false;
    let businessVertical: BusinessVertical = 'RETAIL';
    let businessProfile: BusinessProfile = 'RETAIL';
    let posOperationMode: PosOperationMode = 'QUICK_SALE';
    let enabledFeatures: TenantFeature[] = [];

    if (tenantId) {
      const [cap, tenant] = await Promise.all([
        this.planLimits.getCapacity(tenantId),
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { businessVertical: true, businessProfile: true, posOperationMode: true, enabledFeatures: true, enabledModules: true },
        }),
      ]);
      maxUsers = cap.maxUsers;
      activeUsers = cap.activeUsers;
      overUserLimit = cap.overUserLimit;
      if (tenant) {
        businessVertical = tenant.businessVertical;
        businessProfile = tenant.businessProfile;
        posOperationMode = tenant.posOperationMode;
        enabledFeatures = tenant.enabledFeatures;
        effectiveEnabledModules = tenant.enabledModules;
      }
    }

    const effectiveModules = [...new Set([...planModules, ...effectiveEnabledModules])];

    // Convergence: expose capabilities derived from the immutable business profile.
    const businessFeatures = buildFeaturesForProfile(businessProfile);

    return { plan, enabledModules: effectiveEnabledModules, effectiveModules, maxUsers, activeUsers, overUserLimit, businessVertical, businessProfile, posOperationMode, enabledFeatures, businessFeatures };
  }

  private generateToken(payload: JwtPayload): string {
    const jti = randomUUID();
    return this.jwtService.sign({ ...payload, jti });
  }

  private mapUser(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      googleLinked: Boolean(user.googleId),
      hasPassword: Boolean(user.password),
      mfaEnabled: Boolean(user.mfaEnabled),
    };
  }

  /**
   * Desvincula la identidad Google del usuario actual.
   *
   * Bloqueado si no tiene contraseña local: esa cuenta solo entra por Google, y
   * desvincular la dejaría sin ninguna forma de acceder.
   */
  async unlinkGoogle(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.googleId) {
      throw new BadRequestException('Tu cuenta no está vinculada con Google');
    }
    if (!user.password) {
      throw new BadRequestException(
        'Establece una contraseña antes de desvincular Google, o perderías acceso a tu cuenta',
      );
    }

    await this.prisma.user.update({ where: { id: userId }, data: { googleId: null } });
    this.securityLog.log(`cuenta de Google desvinculada: userId=${userId}`);
  }

  /**
   * Crea o cambia la contraseña del usuario autenticado, desde configuración.
   *
   * Si ya tenía una, exige la actual (evita que una sesión robada la cambie
   * sin más). Si no tenía —cuenta que solo entraba por Google— no hay nada
   * que verificar: es la primera vez que se fija.
   */
  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.password) {
      if (!currentPassword || !(await PasswordUtil.compare(currentPassword, user.password))) {
        throw new BadRequestException('Contraseña actual incorrecta');
      }
    }

    const hashed = await PasswordUtil.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, tokensValidFrom: new Date() },
    });

    // Igual que el reseteo por correo: cambiar la contraseña cierra cualquier
    // otra sesión activa con la anterior — refresh tokens explícitamente, y
    // access tokens ya emitidos vía `tokensValidFrom` (H-06).
    await this.refreshTokens.revokeAllForUser(userId);
    this.securityLog.log(`contraseña cambiada desde sesión activa: userId=${userId}`);
  }

  private mapMembership(m: MembershipWithTenant): TenantSummaryDto {
    return {
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      memberRole: m.role,
      plan: m.tenant.plan,
    };
  }
}
