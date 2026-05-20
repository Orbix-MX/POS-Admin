import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { getMaxBranchesForPlan } from '@ventasy/types';
import type { TenantPlan } from '@ventasy/types';
import { CreatePlatformBranchDto, UpdateBranchStatusDto, UpdateBranchLimitsDto } from './dto/platform-branch.dto';

type PlatformActor = { id: string };

@Injectable()
export class PlatformBranchesService {
  constructor(
    private prisma: PrismaService,
    private planLimits: PlanLimitsService,
  ) {}

  async getBranches(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [branches, capacity] = await Promise.all([
      this.prisma.branch.findMany({
        where: { tenantId },
        orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          isMain: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          phone: true,
          email: true,
          createdAt: true,
        },
      }),
      this.planLimits.getBranchCapacity(tenantId),
    ]);

    return { branches, capacity };
  }

  async createBranch(tenantId: string, dto: CreatePlatformBranchDto, actor: PlatformActor) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.planLimits.assertCanAddBranch(tenantId);

    const existing = await this.prisma.branch.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) throw new BadRequestException(`Branch code '${dto.code}' already exists`);

    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        phone: dto.phone,
        email: dto.email,
        status: 'ACTIVE',
        isMain: false,
      },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId: actor.id,
        tenantId,
        action: 'BRANCH_CREATED',
        entityType: 'Branch',
        entityId: branch.id,
        after: { name: branch.name, code: branch.code },
      },
    });

    return branch;
  }

  async updateBranchStatus(
    tenantId: string,
    branchId: string,
    dto: UpdateBranchStatusDto,
    actor: PlatformActor,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    // Protect last active branch — cannot deactivate or suspend it
    if (dto.status !== 'ACTIVE') {
      const activeBranches = await this.prisma.branch.count({
        where: { tenantId, status: 'ACTIVE' },
      });
      if (activeBranches <= 1) {
        throw new BadRequestException('No se puede desactivar la última sucursal activa');
      }
    }

    const before = { status: branch.status };
    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data: { status: dto.status },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId: actor.id,
        tenantId,
        action: 'BRANCH_STATUS_CHANGED',
        entityType: 'Branch',
        entityId: branchId,
        before,
        after: { status: dto.status },
        notes: dto.reason,
      },
    });

    return updated;
  }

  async updateBranchLimits(tenantId: string, dto: UpdateBranchLimitsDto, actor: PlatformActor) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true, extraBranchLimit: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // New limit must not be below current active count
    const activeBranches = await this.prisma.branch.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const newMax = getMaxBranchesForPlan(tenant.plan, dto.extraBranchLimit);
    if (newMax !== null && activeBranches > newMax) {
      throw new BadRequestException(
        `No se puede reducir el límite a ${newMax}: hay ${activeBranches} sucursales activas`,
      );
    }

    const before = { extraBranchLimit: tenant.extraBranchLimit };
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { extraBranchLimit: dto.extraBranchLimit },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId: actor.id,
        tenantId,
        action: 'BRANCH_LIMITS_CHANGED',
        entityType: 'Tenant',
        entityId: tenantId,
        before,
        after: { extraBranchLimit: dto.extraBranchLimit },
        notes: dto.notes,
      },
    });

    return updated;
  }
}
