import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { QueryCouponDto } from './dto/query-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { Coupon, Prisma } from '@prisma/client';

@Injectable()
export class CouponsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async create(createCouponDto: CreateCouponDto): Promise<Coupon> {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.prisma.coupon.findUnique({
      where: { tenantId_code: { tenantId, code: createCouponDto.code } },
    });
    if (existing) throw new BadRequestException('Coupon code already exists');

    if (createCouponDto.scope === 'PRODUCT' && !createCouponDto.productId) {
      throw new BadRequestException('Product ID is required for PRODUCT scope');
    }
    if (createCouponDto.scope === 'CATEGORY' && !createCouponDto.categoryId) {
      throw new BadRequestException('Category ID is required for CATEGORY scope');
    }

    const data: any = {
      ...createCouponDto,
      tenantId,
      startDate: new Date(createCouponDto.startDate),
      endDate: createCouponDto.endDate ? new Date(createCouponDto.endDate) : null,
    };

    return this.prisma.coupon.create({ data });
  }

  async findAll(query?: QueryCouponDto): Promise<Coupon[]> {
    const tenantId = this.tenantContext.requireTenantId();
    const where: any = { tenantId };

    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query?.type)     where.type = query.type;
    if (query?.scope)    where.scope = query.scope;
    if (query?.isActive !== undefined)  where.isActive = query.isActive;
    if (query?.autoApply !== undefined) where.autoApply = query.autoApply;

    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;

    return this.prisma.coupon.findMany({
      where,
      include: {
        product:  { select: { id: true, name: true, sku: true } },
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(id: string): Promise<Coupon> {
    const tenantId = this.tenantContext.requireTenantId();
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, tenantId },
      include: {
        product: true,
        category: true,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async findByCode(code: string): Promise<Coupon | null> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.coupon.findUnique({
      where: { tenantId_code: { tenantId, code } },
      include: { product: true, category: true },
    });
  }

  async update(id: string, updateCouponDto: UpdateCouponDto): Promise<Coupon> {
    await this.findOne(id);

    const data: any = { ...updateCouponDto };
    if (updateCouponDto.startDate) data.startDate = new Date(updateCouponDto.startDate);
    if (updateCouponDto.endDate)   data.endDate   = new Date(updateCouponDto.endDate);

    return this.prisma.coupon.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.coupon.delete({ where: { id } });
  }

  async validateCoupon(validateDto: ValidateCouponDto): Promise<{
    valid: boolean;
    message?: string;
    coupon?: Coupon;
    discountAmount?: number;
  }> {
    const coupon = await this.findByCode(validateDto.code);

    if (!coupon) return { valid: false, message: 'Cupón no encontrado' };
    if (!coupon.isActive) return { valid: false, message: 'Cupón inactivo' };

    const now = new Date();
    if (now < coupon.startDate) return { valid: false, message: 'Cupón aún no válido' };
    if (coupon.endDate && now > coupon.endDate) return { valid: false, message: 'Cupón expirado' };
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, message: 'Cupón ha alcanzado el límite de usos' };
    }

    if (coupon.usageLimitPerCustomer && validateDto.customerId) {
      const customerUsage = await this.prisma.order.count({
        where: { customerId: validateDto.customerId, couponId: coupon.id },
      });
      if (customerUsage >= coupon.usageLimitPerCustomer) {
        return { valid: false, message: 'Has alcanzado el límite de usos de este cupón' };
      }
    }

    if (validateDto.customerId && coupon.customerTypes.length > 0) {
      const tenantId = this.tenantContext.requireTenantId();
      const customer = await this.prisma.customer.findFirst({
        where: { id: validateDto.customerId, tenantId },
      });
      if (!customer) return { valid: false, message: 'Cliente no encontrado' };
      if (!coupon.customerTypes.includes(customer.type)) {
        return { valid: false, message: 'Cupón no disponible para tu tipo de cliente' };
      }
      if (coupon.isFirstPurchaseOnly && customer.totalOrders > 0) {
        return { valid: false, message: 'Cupón solo válido para primera compra' };
      }
      if (coupon.minOrders && customer.totalOrders < coupon.minOrders) {
        return {
          valid: false,
          message: `Necesitas al menos ${coupon.minOrders} compras para usar este cupón`,
        };
      }
    }

    if (coupon.minPurchase && validateDto.totalAmount) {
      if (Number(validateDto.totalAmount) < Number(coupon.minPurchase)) {
        return {
          valid: false,
          message: `Compra mínima requerida: $${coupon.minPurchase.toString()}`,
        };
      }
    }

    if (coupon.scope === 'PRODUCT' && coupon.productId) {
      if (!validateDto.productIds?.includes(coupon.productId)) {
        return { valid: false, message: 'Producto no elegible para este cupón' };
      }
    }
    if (coupon.scope === 'CATEGORY' && coupon.categoryId) {
      if (!validateDto.categoryIds?.includes(coupon.categoryId)) {
        return { valid: false, message: 'Categoría no elegible para este cupón' };
      }
    }

    let discountAmount = 0;
    if (validateDto.totalAmount) {
      if (coupon.type === 'PERCENTAGE') {
        discountAmount = (Number(validateDto.totalAmount) * Number(coupon.value)) / 100;
        if (coupon.maxDiscount && discountAmount > Number(coupon.maxDiscount)) {
          discountAmount = Number(coupon.maxDiscount);
        }
      } else {
        discountAmount = Math.min(Number(coupon.value), Number(validateDto.totalAmount));
      }
    }

    return { valid: true, message: 'Cupón válido', coupon, discountAmount };
  }

  /**
   * Suma un uso al cupón. Solo lo llama el cobro de una orden (`OrdersService`), nunca un endpoint.
   *
   * @odd aislamiento-de-cupones T-001/T-002
   *  - T-001: antes `update({ where: { id } })` sin `tenantId` (C-002) y expuesto por HTTP con un permiso de
   *    lectura: una empresa agotaba los cupones de otra. Ahora la fila es `{ id, tenantId }`.
   *  - T-002: el límite se valida al inicio de la orden y se consume al final, así que dos órdenes simultáneas
   *    podían pasar ambas y superar `usageLimit`. El incremento es UNA sentencia que solo suma si queda cupo; sin
   *    cupo, la orden se rechaza (`COUPON_EXHAUSTED`) y, al ir en su transacción (`tx`), no deja nada a medias. Y
   *    si la orden se revierte por otro motivo, el uso tampoco se gasta.
   */
  async incrementUsage(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const db = tx ?? this.prisma;

    const updated = await db.$executeRaw`
      UPDATE "coupons"
         SET "usageCount" = "usageCount" + 1, "updatedAt" = NOW()
       WHERE "id" = ${id} AND "tenantId" = ${tenantId}
         AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")`;
    if (updated > 0) return;

    // 0 filas: o no es de esta empresa (o no existe), o ya no queda cupo.
    const exists = await db.coupon.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Cupón no encontrado');
    throw new ConflictException({
      statusCode: 409,
      code: 'COUPON_EXHAUSTED',
      message: 'El cupón se agotó antes de completar la venta.',
    });
  }

  async getAutoApplicableCoupons(params: {
    customerId: string;
    productIds: string[];
    categoryIds: string[];
    totalAmount: number;
  }): Promise<Coupon[]> {
    const tenantId = this.tenantContext.requireTenantId();

    const customer = await this.prisma.customer.findFirst({
      where: { id: params.customerId, tenantId },
    });
    if (!customer) return [];

    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: {
        tenantId,
        isActive: true,
        autoApply: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        customerTypes: { has: customer.type },
      },
      include: { product: true, category: true },
    });

    const applicableCoupons: Coupon[] = [];

    for (const coupon of coupons) {
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) continue;

      if (coupon.usageLimitPerCustomer) {
        const customerUsage = await this.prisma.order.count({
          where: { customerId: params.customerId, couponId: coupon.id },
        });
        if (customerUsage >= coupon.usageLimitPerCustomer) continue;
      }

      if (coupon.isFirstPurchaseOnly && customer.totalOrders > 0) continue;
      if (coupon.minOrders && customer.totalOrders < coupon.minOrders) continue;
      if (coupon.minPurchase && params.totalAmount < Number(coupon.minPurchase)) continue;

      if (coupon.scope === 'PRODUCT' && coupon.productId) {
        if (!params.productIds.includes(coupon.productId)) continue;
      }
      if (coupon.scope === 'CATEGORY' && coupon.categoryId) {
        if (!params.categoryIds.includes(coupon.categoryId)) continue;
      }

      applicableCoupons.push(coupon);
    }

    return applicableCoupons;
  }
}
