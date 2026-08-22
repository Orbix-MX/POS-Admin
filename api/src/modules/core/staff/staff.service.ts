import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { EffectivePermissionsService } from '../../../common/services/effective-permissions.service';
import { PermissionCacheService } from '../../../common/cache/permission-cache.service';
import { getModulesForPlan, getAllowedModulesForVertical } from '@orbix/types';

/**
 * Operator token lifetime. A PIN session is shift-bound: 12h covers a full shift
 * and forces re-identification afterwards. Shared by both operator-login paths
 * (device-gated mobile + user-session-gated web) so the JWT is identical and the
 * downstream auth (JwtStrategy `typ:'operator'` + PermissionsGuard DEVICE_OPERATOR)
 * behaves the same regardless of which client minted it.
 */
const OPERATOR_TOKEN_TTL = '12h';

/**
 * Operative PIN login. The DEVICE is the principal (validated via deviceToken);
 * the PIN only selects which employee is operating. PINs are stored as a
 * deterministic salted hash (sha256 + pepper) so they stay unique per tenant and
 * are directly looked up — paired with rate-limiting on the controller.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly devicesService: DevicesService,
    private readonly jwtService: JwtService,
    private readonly effectivePermissions: EffectivePermissionsService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  private hashPin(tenantId: string, pin: string): string {
    const pepper = process.env.STAFF_PIN_PEPPER ?? this.config.get<string>('jwt.secret') ?? 'orbix';
    return createHash('sha256').update(`${tenantId}:${pin}:${pepper}`).digest('hex');
  }

  /** Device-principal PIN login. Returns operator identity, permissions, and available branches. */
  async pinLogin(deviceToken: string, pin: string) {
    // Gate: device + tenant + branch + license must all be active/valid.
    const { device, tenantId } = await this.devicesService.authorizeByToken(deviceToken);
    // Mobile: no explicit branch is requested — the device scope + employee
    // primary branch resolve the default. Identical token minting as web.
    return this.buildOperatorSession(tenantId, pin, { deviceBranchId: device.branchId });
  }

  /**
   * Authorize an employee by PIN under an EXISTING user session and mint an
   * operator JWT for them — the web counterpart to the mobile device login. The
   * user session (RBAC `comanda:view`) is the gate instead of a device token;
   * `tenantId` comes from that session (never the body). The minted token is the
   * exact same shape as mobile's, so the backend learns the real waiter
   * (`sub = employee.id`) for every web comanda/caja request — closing the gap
   * where web only knew a client-side PIN. `branchId` is validated against the
   * operator's available branches.
   */
  async operatorLogin(tenantId: string, pin: string, branchId: string) {
    return this.buildOperatorSession(tenantId, pin, { requestedBranchId: branchId });
  }

  /**
   * Shared operator-session builder. Resolves the employee by PIN, computes the
   * available branches (device scope ∩ employee assignments), picks the operating
   * branch and signs the `typ:'operator'` JWT. Both login paths funnel through
   * here so mobile and web stay byte-for-byte compatible.
   *
   * Branch resolution:
   *  - `requestedBranchId` (web): must be one of the operator's available branches.
   *  - otherwise (mobile): employee primary > device branch > first available.
   */
  private async buildOperatorSession(
    tenantId: string,
    pin: string,
    opts: { deviceBranchId?: string | null; requestedBranchId?: string },
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, pinHash: this.hashPin(tenantId, pin), status: 'ACTIVE' },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        branches: { include: { branch: { select: { id: true, name: true, status: true } } } },
      },
    });

    if (!employee) {
      throw new UnauthorizedException({ code: 'PIN_INVALID', message: 'PIN incorrecto.' });
    }

    const permissions = employee.role?.permissions.map((rp) => rp.permission.key) ?? [];

    // Compute available branches: intersection of device scope and employee assignments.
    // If the employee has no explicit branch assignments, they inherit all tenant branches
    // (bounded by the device's branch if the device is pinned to one).
    const employeeBranchIds = employee.branches.map((eb) => eb.branchId);
    const hasExplicitBranches = employeeBranchIds.length > 0;

    const availableBranches = await this.prisma.branch.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        // Device scope: if device is pinned to a branch, restrict to that branch only
        ...(opts.deviceBranchId ? { id: opts.deviceBranchId } : {}),
        // Employee scope: if employee has explicit assignments, filter to those
        ...(hasExplicitBranches ? { id: { in: employeeBranchIds } } : {}),
      },
      select: { id: true, name: true, restaurantVisibilityMode: true },
      orderBy: { isMain: 'desc' },
    });

    // Branch selection. Web passes the already-selected branch and it MUST be in
    // scope (no silent fallback that would let an operator act on a branch they
    // can't access). Mobile passes none → primary > device branch > first.
    let defaultBranchId: string | null;
    if (opts.requestedBranchId) {
      const allowed = availableBranches.some((b) => b.id === opts.requestedBranchId);
      if (!allowed) {
        throw new BadRequestException({
          code: 'BRANCH_NOT_ALLOWED',
          message: 'La sucursal no está disponible para este operador.',
        });
      }
      defaultBranchId = opts.requestedBranchId;
    } else {
      const primaryBranchId = employee.branches.find((eb) => eb.isPrimary)?.branchId;
      defaultBranchId = primaryBranchId ?? opts.deviceBranchId ?? availableBranches[0]?.id ?? null;
    }

    // Compute tenant modules so the operator JWT carries them (needed for RequireModuleGuard).
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, enabledModules: true, businessVertical: true },
    });
    const planModules = tenant ? (getModulesForPlan(tenant.plan) as unknown as string[]) : [];
    const allModules = tenant ? [...new Set([...planModules, ...tenant.enabledModules])] : planModules;
    const enabledModules = tenant
      ? getAllowedModulesForVertical(allModules, tenant.businessVertical)
      : allModules;

    const accessToken = this.jwtService.sign(
      {
        sub: employee.id,
        typ: 'operator',
        tenantId,
        branchId: defaultBranchId,
        plan: tenant?.plan ?? 'FREE',
        enabledModules,
        permissions,
      },
      { expiresIn: OPERATOR_TOKEN_TTL },
    );

    return {
      accessToken,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeNumber: employee.employeeNumber,
      },
      role: employee.role ? { id: employee.role.id, name: employee.role.name } : null,
      permissions,
      branchId: defaultBranchId,
      availableBranches,
      // Modo de visibilidad de comandas de la sucursal operada. Infra: el cliente
      // lo consume desde la sesión; HOY no altera ninguna pantalla (default SHARED).
      restaurantVisibilityMode:
        availableBranches.find((b) => b.id === defaultBranchId)?.restaurantVisibilityMode ?? 'SHARED',
    };
  }

  /**
   * Authorize an employee by PIN under an existing (user) session. Unlike
   * `pinLogin`, this does NOT mint a JWT and does NOT require a device — it only
   * resolves which active employee owns the PIN within the current tenant, so the
   * web comanda can attribute dining orders to a waiter (Employee). The caller is
   * already authenticated as a user; the PIN just selects the operating waiter.
   */
  async verifyPin(tenantId: string, pin: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, pinHash: this.hashPin(tenantId, pin), status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    });
    if (!employee) {
      throw new UnauthorizedException({ code: 'PIN_INVALID', message: 'PIN incorrecto.' });
    }
    return { employee };
  }

  /** Admin: set/replace an employee's PIN (and optional operative role). */
  async assignPin(tenantId: string, employeeId: string, pin: string, roleId?: string) {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestException('El PIN debe tener entre 4 y 6 dígitos.');
    }
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    if (roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId }, select: { id: true } });
      if (!role) throw new BadRequestException('Rol inválido');

      // The PIN turns this role into a usable login, so assigning it is a grant:
      // it must not hand the operator permissions the caller lacks.
      await this.effectivePermissions.assertActorCanGrant(
        await this.effectivePermissions.keysForRoles([roleId], tenantId),
      );
    }

    try {
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { pinHash: this.hashPin(tenantId, pin), ...(roleId !== undefined ? { roleId } : {}) },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Ese PIN ya está en uso por otro empleado.');
      }
      throw e;
    }

    // The operator's permissions ride in their JWT, minted at PIN login, so an
    // already-issued operator token keeps its old role until it expires. The
    // cache flush only covers users; that token lifetime is the real bound.
    await this.permissionCache.invalidateTenant(tenantId);
    return { ok: true };
  }

  /** Admin: clear an employee's PIN. */
  async clearPin(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    await this.prisma.employee.update({ where: { id: employeeId }, data: { pinHash: null } });
    return { ok: true };
  }
}
