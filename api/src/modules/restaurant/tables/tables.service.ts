import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { CreateRestaurantTableDto, UpdateRestaurantTableDto } from './dto/restaurant-table.dto';
import { Prisma } from '@prisma/client';

const TABLE_SELECT = {
  id: true, name: true, capacity: true, displayOrder: true,
  isActive: true, status: true, areaId: true, branchId: true,
  createdAt: true, updatedAt: true,
  area: { select: { id: true, name: true } },
  diningOrders: {
    where: { status: 'OPEN' as const },
    take: 1,
    select: {
      id: true,
      openedAt: true,
      waiter: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditContext: AuditContextService,
  ) {}

  async findAll(branchId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.assertBranchBelongs(tenantId, branchId);

    return this.prisma.restaurantTable.findMany({
      where: { tenantId, branchId },
      orderBy: [{ area: { displayOrder: 'asc' } }, { displayOrder: 'asc' }, { name: 'asc' }],
      select: TABLE_SELECT,
    });
  }

  async findByArea(branchId: string, areaId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.assertBranchBelongs(tenantId, branchId);

    return this.prisma.restaurantTable.findMany({
      where: { tenantId, branchId, areaId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: TABLE_SELECT,
    });
  }

  async create(branchId: string, dto: CreateRestaurantTableDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    await this.assertBranchBelongs(tenantId, branchId);
    await this.assertAreaBelongs(tenantId, branchId, dto.areaId);

    try {
      return await this.prisma.restaurantTable.create({
        data: {
          tenantId,
          branchId,
          areaId: dto.areaId,
          name: dto.name,
          capacity: dto.capacity ?? 4,
          displayOrder: dto.displayOrder ?? 0,
          createdById: userId,
          updatedById: userId,
        },
        select: TABLE_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe una mesa con el nombre "${dto.name}" en esta sucursal.`);
      }
      throw e;
    }
  }

  async update(branchId: string, id: string, dto: UpdateRestaurantTableDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    await this.assertExists(tenantId, branchId, id);

    if (dto.areaId) {
      await this.assertAreaBelongs(tenantId, branchId, dto.areaId);
    }

    try {
      return await this.prisma.restaurantTable.update({
        where: { id },
        data: { ...dto, updatedById: userId },
        select: TABLE_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe una mesa con ese nombre en esta sucursal.`);
      }
      throw e;
    }
  }

  private async assertBranchBelongs(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada.');
  }

  private async assertAreaBelongs(tenantId: string, branchId: string, areaId: string) {
    const area = await this.prisma.diningArea.findFirst({
      where: { id: areaId, tenantId, branchId },
      select: { id: true },
    });
    if (!area) throw new NotFoundException('Área no encontrada en esta sucursal.');
  }

  private async assertExists(tenantId: string, branchId: string, id: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id, tenantId, branchId },
      select: { id: true },
    });
    if (!table) throw new NotFoundException('Mesa no encontrada.');
  }
}
