import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { CreateDiningAreaDto, UpdateDiningAreaDto } from './dto/dining-area.dto';
import { Prisma } from '@prisma/client';
import { assertBranchBelongs } from '../../../common/helpers/assert-branch-belongs';

@Injectable()
export class DiningAreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditContext: AuditContextService,
  ) {}

  async findAll(branchId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.assertBranchBelongs(tenantId, branchId);

    return this.prisma.diningArea.findMany({
      where: { tenantId, branchId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, description: true,
        displayOrder: true, isActive: true,
        createdAt: true, updatedAt: true,
      },
    });
  }

  async create(branchId: string, dto: CreateDiningAreaDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    await this.assertBranchBelongs(tenantId, branchId);

    try {
      return await this.prisma.diningArea.create({
        data: {
          tenantId,
          branchId,
          name: dto.name,
          description: dto.description,
          displayOrder: dto.displayOrder ?? 0,
          createdById: userId,
          updatedById: userId,
        },
        select: {
          id: true, name: true, description: true,
          displayOrder: true, isActive: true,
          createdAt: true, updatedAt: true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe un área con el nombre "${dto.name}" en esta sucursal.`);
      }
      throw e;
    }
  }

  async update(branchId: string, id: string, dto: UpdateDiningAreaDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    await this.assertExists(tenantId, branchId, id);

    try {
      return await this.prisma.diningArea.update({
        where: { id },
        data: { ...dto, updatedById: userId },
        select: {
          id: true, name: true, description: true,
          displayOrder: true, isActive: true,
          createdAt: true, updatedAt: true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe un área con ese nombre en esta sucursal.`);
      }
      throw e;
    }
  }

  private assertBranchBelongs(tenantId: string, branchId: string) {
    return assertBranchBelongs(this.prisma, tenantId, branchId);
  }

  private async assertExists(tenantId: string, branchId: string, id: string) {
    const area = await this.prisma.diningArea.findFirst({
      where: { id, tenantId, branchId },
      select: { id: true },
    });
    if (!area) throw new NotFoundException('Área no encontrada.');
  }
}
