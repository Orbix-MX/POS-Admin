import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { getModulesForPlan, getAllowedModulesForVertical } from '@orbix/types';

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
  ) {}

  private hashPin(tenantId: string, pin: string): string {
    const pepper = process.env.STAFF_PIN_PEPPER ?? this.config.get<string>('jwt.secret') ?? 'orbix';
    return createHash('sha256').update(`${tenantId}:${pin}:${pepper}`).digest('hex');
  }

  /** Device-principal PIN login. Returns operator identity, permissions, and available branches. */
  async pinLogin(deviceToken: string, pin: string) {
    // Gate: device + tenant + branch + license must all be active/valid.
    const { device, tenantId, branchId } = await this.devicesService.authorizeByToken(deviceToken);

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
        ...(device.branchId ? { id: device.branchId } : {}),
        // Employee scope: if employee has explicit assignments, filter to those
        ...(hasExplicitBranches ? { id: { in: employeeBranchIds } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { isMain: 'desc' },
    });

    // Default branch: employee's primary > device branch > first available
    const primaryBranchId = employee.branches.find((eb) => eb.isPrimary)?.branchId;
    const defaultBranchId = primaryBranchId ?? branchId ?? availableBranches[0]?.id ?? null;

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
      { expiresIn: '12h' },
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
    };
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
