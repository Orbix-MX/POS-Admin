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
import { Prisma } from '@prisma/client';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { QuerySupplyDto } from './dto/query-supply.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import {
  areUnitsCompatible,
  convertUnits,
  convertToBaseUnit,
  convertFromBaseUnit,
} from '../../../common/helpers/unit-conversion';

const SUPPLY_INCLUDE = {
  branch: true,
  baseUnit: true,
  inventoryUnit: true,
  allowedUnits: { include: { unit: true } },
} as const;

@Injectable()
export class SuppliesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async create(dto: CreateSupplyDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;

    const existing = await this.prisma.supply.findUnique({
      where: { tenantId_sku: { tenantId, sku: dto.sku } },
    });
    if (existing) throw new ConflictException('SKU de insumo ya existe');

    const { allowedUnits, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      const supply = await tx.supply.create({
        data: { ...rest, tenantId, createdById: userId, updatedById: userId },
        include: SUPPLY_INCLUDE,
      });
      if (allowedUnits?.length) {
        await tx.supplyAllowedUnit.createMany({
          data: allowedUnits.map((u) => ({
            supplyId: supply.id,
            unitId: u.unitId,
            conversionFactor: u.conversionFactor,
          })),
        });
        return tx.supply.findUniqueOrThrow({ where: { id: supply.id }, include: SUPPLY_INCLUDE });
      }
      return supply;
    });
  }

  async findAll(queryDto: QuerySupplyDto): Promise<PaginatedResponse<any>> {
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
        include: SUPPLY_INCLUDE,
      }),
      this.prisma.supply.count({ where }),
    ]);

    return {
      data: supplies,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const supply = await this.prisma.supply.findFirst({
      where: { id, tenantId },
      include: {
        ...SUPPLY_INCLUDE,
        movements: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!supply) throw new NotFoundException('Insumo no encontrado');
    return supply;
  }

  async update(id: string, dto: UpdateSupplyDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;

    const supply = await this.prisma.supply.findFirst({ where: { id, tenantId } });
    if (!supply) throw new NotFoundException('Insumo no encontrado');

    const { allowedUnits, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      await tx.supply.update({
        where: { id },
        data: { ...rest, updatedById: userId },
      });
      if (allowedUnits !== undefined) {
        await tx.supplyAllowedUnit.deleteMany({ where: { supplyId: id } });
        if (allowedUnits.length > 0) {
          await tx.supplyAllowedUnit.createMany({
            data: allowedUnits.map((u) => ({
              supplyId: id,
              unitId: u.unitId,
              conversionFactor: u.conversionFactor,
            })),
          });
        }
      }
      return tx.supply.findUniqueOrThrow({ where: { id }, include: SUPPLY_INCLUDE });
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

  async adjustStock(id: string, dto: AdjustStockDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;
    const branchId = this.tenantContext.getBranchId() ?? null;

    const supply = await this.prisma.supply.findFirst({
      where: { id, tenantId },
      include: { inventoryUnit: true, baseUnit: true },
    });
    if (!supply) throw new NotFoundException('Insumo no encontrado');

    const convFactor = Number(supply.conversionFactor) || 1;
    const inventorySymbol = supply.inventoryUnit?.symbol ?? supply.unit;
    const baseSymbol = supply.baseUnit?.symbol ?? supply.unit;

    // Determine the quantity in baseUnit (what gets stored in supply.stock)
    let quantityInBaseUnit: number;
    let conversionNote = '';

    if (dto.unit) {
      const inputUnit = dto.unit.toLowerCase().trim();
      if (inputUnit === inventorySymbol.toLowerCase()) {
        // Input in inventoryUnit → convert to baseUnit
        quantityInBaseUnit = convertToBaseUnit(dto.quantity, convFactor);
        if (convFactor !== 1) {
          conversionNote = ` (${dto.quantity} ${inventorySymbol} → ${quantityInBaseUnit.toFixed(6)} ${baseSymbol})`;
        }
      } else if (inputUnit === baseSymbol.toLowerCase()) {
        // Input already in baseUnit
        quantityInBaseUnit = dto.quantity;
      } else {
        // Fallback: string-based conversion (legacy / manual override)
        if (!areUnitsCompatible(dto.unit, supply.unit)) {
          throw new BadRequestException(
            `No se puede convertir ${dto.unit} a ${supply.unit}: unidades incompatibles`,
          );
        }
        quantityInBaseUnit = convertUnits(dto.quantity, dto.unit, supply.unit);
        conversionNote = ` (${dto.quantity} ${dto.unit} → ${quantityInBaseUnit.toFixed(6)} ${baseSymbol})`;
      }
    } else {
      // No unit provided: treat as baseUnit (or inventoryUnit if no baseUnit configured)
      quantityInBaseUnit = supply.baseUnitId
        ? dto.quantity
        : dto.quantity;
    }

    const newStock = Number(supply.stock) + quantityInBaseUnit;
    if (newStock < 0) throw new BadRequestException('Stock insuficiente');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supply.update({
        where: { id },
        data: { stock: newStock },
        include: SUPPLY_INCLUDE,
      });

      await tx.supplyMovement.create({
        data: {
          tenantId,
          supplyId: id,
          type: 'ADJUSTMENT',
          quantity: quantityInBaseUnit,
          ...(branchId && { branchId }),
          notes: dto.notes ? `${dto.notes}${conversionNote}` : conversionNote || null,
          createdById: userId,
        },
      });

      return updated;
    });
  }

  async getLowStock() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.supply.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: SUPPLY_INCLUDE,
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
