import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { getMaxUsersForPlan } from '@ventasy/types';
import { PrismaService } from '../../database/prisma.service';

export interface UserCapacity {
  /** null === unlimited (ENTERPRISE with no override) */
  maxUsers: number | null;
  activeUsers: number;
  overUserLimit: boolean;
  /** false when a new active user cannot be added right now */
  hasCapacity: boolean;
}

/**
 * Centralised per-tenant user-limit logic. All methods take an explicit
 * tenantId because super-admin operations (tenant downgrade) act on a tenant
 * outside the request's tenant context.
 *
 * Only memberships with status ACTIVE consume a seat — INACTIVE / SUSPENDED /
 * INVITED preserve history without counting against the plan.
 */
@Injectable()
export class PlanLimitsService {
  constructor(private prisma: PrismaService) {}

  async getCapacity(tenantId: string): Promise<UserCapacity> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, userLimitOverride: true, overUserLimit: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const activeUsers = await this.prisma.tenantMembership.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const maxUsers = getMaxUsersForPlan(tenant.plan, tenant.userLimitOverride);
    const hasCapacity =
      !tenant.overUserLimit && (maxUsers == null || activeUsers < maxUsers);

    return {
      maxUsers,
      activeUsers,
      overUserLimit: tenant.overUserLimit,
      hasCapacity,
    };
  }

  /** Throws a user-facing error when no seat is available. */
  async assertCanAddActiveUser(tenantId: string): Promise<void> {
    const cap = await this.getCapacity(tenantId);
    if (cap.overUserLimit) {
      throw new BadRequestException(
        'Tu empresa está sobre el límite de usuarios tras un cambio de plan. Desactiva usuarios para poder agregar o activar otros.',
      );
    }
    if (cap.maxUsers != null && cap.activeUsers >= cap.maxUsers) {
      throw new BadRequestException(
        `Tu plan permite máximo ${cap.maxUsers} usuario(s) activo(s).`,
      );
    }
  }

  /**
   * Recompute the over-limit flag for a tenant (call after plan downgrade,
   * override change, or membership status changes). Never deactivates users.
   */
  async recomputeOverLimit(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, userLimitOverride: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const activeUsers = await this.prisma.tenantMembership.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    const maxUsers = getMaxUsersForPlan(tenant.plan, tenant.userLimitOverride);
    const overUserLimit = maxUsers != null && activeUsers > maxUsers;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { overUserLimit },
    });
    return overUserLimit;
  }
}
