import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { CreateServiceQuoteDto } from './dto/create-service-quote.dto';
import { UpdateServiceQuoteDto } from './dto/update-service-quote.dto';
import { QueryServiceQuotesDto } from './dto/query-service-quotes.dto';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { roundMoney, sumMoney, multiplyMoney } from '../../../common/utils/money.util';
import { InventoryConsumptionEngine } from '../inventory/inventory-consumption.engine';

@Injectable()
export class ServiceQuotesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
    private inventory: InventoryConsumptionEngine,
  ) {}

  async create(dto: CreateServiceQuoteDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const createdById = this.auditContext.getUserId() ?? null;

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    // Validate product items if any
    const productItems = dto.items.filter((i) => i.itemType === 'PRODUCT');
    const productIds = [...new Set(productItems.map((i) => i.productId).filter(Boolean) as string[])];
    let productMap = new Map<string, any>();
    if (productIds.length) {
      const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, tenantId } });
      if (products.length !== productIds.length) throw new NotFoundException('Uno o más productos no encontrados');
      productMap = new Map(products.map((p) => [p.id, p]));
    }

    const subtotal = dto.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const tax = 0;
    const total = subtotal + tax;
    const quoteNumber = `COT-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    return this.prisma.serviceQuote.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        quoteNumber,
        status: 'DRAFT',
        estimatedDeliveryDate: dto.estimatedDeliveryDate ? new Date(dto.estimatedDeliveryDate) : null,
        subtotal,
        tax,
        total,
        notes: dto.notes,
        ...(createdById && { createdById }),
        items: {
          create: dto.items.map((item) => {
            const isProduct = item.itemType === 'PRODUCT';
            const product = isProduct && item.productId ? productMap.get(item.productId) : null;
            return {
              itemType: item.itemType ?? 'SERVICE',
              serviceId: isProduct ? null : (item.serviceId ?? null),
              productId: isProduct ? (item.productId ?? null) : null,
              sku: item.sku ?? (product?.sku ?? null),
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.unitPrice * item.quantity,
            };
          }),
        },
      },
      include: {
        customer: true,
        items: { include: { service: true, product: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findByCustomer(customerId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.serviceQuote.findMany({
      where: {
        tenantId,
        customerId,
        status: { in: ['DRAFT', 'SENT', 'APPROVED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { service: true, product: true } },
      },
    });
  }

  async findAll(query: QueryServiceQuotesDto): Promise<PaginatedResponse<any>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page, customerId, status, search } = query;

    const where: any = {
      tenantId,
      ...(customerId && { customerId }),
      ...(status && { status }),
      ...(search && { quoteNumber: { contains: search, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.serviceQuote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          items: { include: { service: true, product: true } },
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.serviceQuote.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const quote = await this.prisma.serviceQuote.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        items: { include: { service: true, product: true } },
        orders: { select: { id: true, orderNumber: true, status: true, createdAt: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    return quote;
  }

  async update(id: string, dto: UpdateServiceQuoteDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const quote = await this.prisma.serviceQuote.findFirst({ where: { id, tenantId } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    if (quote.status === 'CONVERTED') {
      throw new BadRequestException('No se puede editar una cotización ya convertida');
    }

    return this.prisma.serviceQuote.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.estimatedDeliveryDate !== undefined && {
          estimatedDeliveryDate: dto.estimatedDeliveryDate ? new Date(dto.estimatedDeliveryDate) : null,
        }),
      },
      include: {
        customer: true,
        items: { include: { service: true, product: true } },
      },
    });
  }

  async approve(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const quote = await this.prisma.serviceQuote.findFirst({ where: { id, tenantId } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    if (!['DRAFT', 'SENT'].includes(quote.status)) {
      throw new BadRequestException(`No se puede aprobar una cotización en estado ${quote.status}`);
    }

    return this.prisma.serviceQuote.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { customer: true, items: { include: { service: true } } },
    });
  }

  async convert(id: string, dto: ConvertQuoteDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const createdById = this.auditContext.getUserId() ?? null;
    const branchId = this.tenantContext.getBranchId() ?? null;

    const quote = await this.prisma.serviceQuote.findFirst({
      where: { id, tenantId },
      include: { items: { include: { service: true } } },
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (quote.status !== 'APPROVED') {
      throw new BadRequestException('Solo se pueden convertir cotizaciones aprobadas');
    }

    // Validate extra product items if any
    let productMap = new Map<string, any>();
    if (dto.extraProducts?.length) {
      const productIds = dto.extraProducts.map((p) => p.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, tenantId },
      });
      if (products.length !== productIds.length) {
        throw new NotFoundException('Uno o más productos adicionales no encontrados');
      }
      productMap = new Map(products.map((p) => [p.id, p]));
    }

    const serviceSubtotal = sumMoney(quote.items.map((i) => Number(i.total)));
    const productSubtotal = sumMoney(
      (dto.extraProducts ?? []).map((i) => i.price * i.quantity),
    );
    const subtotal = roundMoney(serviceSubtotal + productSubtotal);
    const total = subtotal;
    const orderNumber = `V-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerId: quote.customerId,
          serviceQuoteId: quote.id,
          subtotal,
          tax: 0,
          shippingCost: 0,
          discount: 0,
          total,
          notes: dto.notes ?? quote.notes,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          deliveryStatus: 'PENDING',
          estimatedDeliveryDate: quote.estimatedDeliveryDate,
          ...(createdById && { createdById }),
          ...(branchId && { branchId }),
        } as any,
      });

      // Create service order items
      for (const item of quote.items) {
        const unitPrice = Number(item.unitPrice);
        const qty = item.quantity;
        const itemSubtotal = unitPrice * qty;
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            itemType: 'SERVICE',
            serviceId: item.serviceId,
            name: item.description,
            sku: null,
            quantity: qty,
            price: unitPrice,
            discount: 0,
            tax: 0,
            subtotal: itemSubtotal,
            total: itemSubtotal,
          },
        });
      }

      // Create product order items (el descuento de stock lo hace el motor abajo)
      for (const item of dto.extraProducts ?? []) {
        const product = productMap.get(item.productId)!;
        const itemSubtotal = multiplyMoney(item.price, item.quantity);
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            itemType: 'PRODUCT',
            productId: product.id,
            name: product.name,
            sku: product.sku,
            quantity: item.quantity,
            price: item.price,
            discount: 0,
            tax: 0,
            subtotal: itemSubtotal,
            total: itemSubtotal,
          },
        });
      }

      // Consumo de inventario vía motor compartido: SIMPLE/RECIPE/COMBO + branch
      // inventory + InventoryMovement, con la misma protección de stock (gte) y
      // simétrico con restore. Reemplaza el decremento manual previo.
      await this.inventory.consume(
        tx,
        (dto.extraProducts ?? []).map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          itemType: 'PRODUCT' as const,
        })),
        { tenantId, branchId, userId: createdById, referenceId: newOrder.id, referenceType: 'ORDER' },
      );

      // Create initial payment placeholder
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          paymentMethod: dto.paymentMethod ?? 'PENDING',
          amount: total,
          status: 'PENDING',
        },
      });

      // Mark quote as converted
      await tx.serviceQuote.update({
        where: { id: quote.id },
        data: { status: 'CONVERTED' },
      });

      // Update customer stats
      await tx.customer.update({
        where: { id: quote.customerId },
        data: { totalOrders: { increment: 1 }, totalSpent: { increment: total } },
      });

      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          customer: true,
          items: true,
          payments: true,
        },
      });
    });

    return order;
  }
}
