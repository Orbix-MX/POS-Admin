import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UnitCategory } from '@prisma/client';

@Injectable()
export class MeasurementUnitsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.measurementUnit.findMany({
      orderBy: [{ category: 'asc' }, { baseFactor: 'asc' }],
    });
  }

  async findOne(id: string) {
    const unit = await this.prisma.measurementUnit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unidad de medida no encontrada');
    return unit;
  }

  findByCategory(category: UnitCategory) {
    return this.prisma.measurementUnit.findMany({
      where: { category },
      orderBy: { baseFactor: 'asc' },
    });
  }

  /**
   * Resolve conversion factor from `unitId` to the supply's base unit.
   * Priority: SupplyAllowedUnit.conversionFactor > MeasurementUnit.baseFactor
   */
  async resolveConversionFactor(unitId: string, supplyId: string): Promise<number> {
    const [allowed, unit] = await Promise.all([
      this.prisma.supplyAllowedUnit.findUnique({
        where: { supplyId_unitId: { supplyId, unitId } },
      }),
      this.prisma.measurementUnit.findUnique({ where: { id: unitId } }),
    ]);
    if (allowed) return Number(allowed.conversionFactor);
    if (unit) return Number(unit.baseFactor);
    return 1;
  }
}
