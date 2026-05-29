import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Supply, Prisma } from '@prisma/client';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { QuerySupplyDto } from './dto/query-supply.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class SuppliesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async create(dto: CreateSupplyDto): Promise<Supply> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;

    const existing = await this.prisma.supply.findUnique({
      where: { tenantId_sku: { tenantId, sku: dto.sku } },
    });
    if (existing) throw new ConflictException('SKU de insumo ya existe');

    return this.prisma.supply.create({
      data: { ...dto, tenantId, createdById: userId, updatedById: userId },
      include: { branch: true },
    });
  }

  async findAll(queryDto: QuerySupplyDto): Promise<PaginatedResponse<Supply>> {
    const { skip, limit, page, search, status, branchId } = queryDto;
    const tenantId = this.tenantContext.requireTenantId();
    const where: Prisma.SupplyWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (branchId) where.branchId = branchId;

    const [supplies, total] = await Promise.all([
      this.prisma.supply.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { branch: true },
      }),
      this.prisma.supply.count({ where }),
    ]);

    return {
      data: supplies,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Supply> {
    const tenantId = this.tenantContext.requireTenantId();
    const supply = await this.prisma.supply.findFirst({
      where: { id, tenantId },
      include: { branch: true, movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!supply) throw new NotFoundException('Insumo no encontrado');
    return supply;
  }

  async update(id: string, dto: UpdateSupplyDto): Promise<Supply> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;

    const supply = await this.prisma.supply.findFirst({ where: { id, tenantId } });
    if (!supply) throw new NotFoundException('Insumo no encontrado');

    return this.prisma.supply.update({
      where: { id },
      data: { ...dto, updatedById: userId },
      include: { branch: true },
    });
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const supply = await this.prisma.supply.findFirst({
      where: { id, tenantId },
      include: { recipeItems: true },
    });
    if (!supply) throw new NotFoundException('Insumo no encontrado');

    if (supply.recipeItems.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar un insumo que está en recetas activas',
      );
    }

    await this.prisma.supply.delete({ where: { id } });
  }

  async adjustStock(id: string, dto: AdjustStockDto): Promise<Supply> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;
    const branchId = this.tenantContext.getBranchId() ?? null;

    const supply = await this.prisma.supply.findFirst({ where: { id, tenantId } });
    if (!supply) throw new NotFoundException('Insumo no encontrado');

    const newStock = Number(supply.stock) + dto.quantity;
    if (newStock < 0) throw new BadRequestException('Stock insuficiente');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supply.update({
        where: { id },
        data: { stock: newStock },
        include: { branch: true },
      });

      await tx.supplyMovement.create({
        data: {
          tenantId,
          supplyId: id,
          type: 'ADJUSTMENT',
          quantity: dto.quantity,
          ...(branchId && { branchId }),
          notes: dto.notes ?? null,
          createdById: userId,
        },
      });

      return updated;
    });
  }

  async getLowStock(): Promise<Supply[]> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.supply.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        // stock <= minStock
      },
      include: { branch: true },
      orderBy: { stock: 'asc' },
    });
  }

  async getMovements(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const supply = await this.prisma.supply.findFirst({ where: { id, tenantId } });
    if (!supply) throw new NotFoundException('Insumo no encontrado');

    return this.prisma.supplyMovement.findMany({
      where: { supplyId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
