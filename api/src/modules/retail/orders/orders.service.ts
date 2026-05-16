import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { Order, OrderStatus, Coupon, PaymentStatus } from '@prisma/client';
import { CouponsService } from '../coupons/coupons.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private auditContext: AuditContextService,
    private tenantContext: TenantContextService,
    private couponsService: CouponsService,
  ) { }

  async create(dto: CreateOrderDto): Promise<Order> {
    if (!dto.items?.length) {
      throw new BadRequestException('La venta debe tener al menos un item');
    }

    const customerId: string | null = dto.customerId ?? null;
    let addressId: string | null = null;

    if (customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        include: { addresses: true },
      });
      if (!customer) {
        throw new NotFoundException('Cliente no encontrado');
      }
      const address = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
      if (address) addressId = address.id;
    }

    // Separate product and service items
    const productItems = dto.items.filter((i) => !i.itemType || i.itemType === 'PRODUCT');
    const serviceItems = dto.items.filter((i) => i.itemType === 'SERVICE');

    // Validate and load products
    const productIds = [...new Set(productItems.map((i) => i.productId).filter(Boolean) as string[])];
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, include: { category: true } })
      : [];
    if (products.length !== productIds.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !found.has(id));
      throw new NotFoundException(`Productos no encontrados: ${missing.join(', ')}`);
    }

    // Optionally validate services from catalog
    const catalogServiceIds = [...new Set(serviceItems.map((i) => i.serviceId).filter(Boolean) as string[])];
    const catalogServices = catalogServiceIds.length
      ? await this.prisma.service.findMany({ where: { id: { in: catalogServiceIds } } })
      : [];
    const serviceMap = new Map(catalogServices.map((s) => [s.id, s]));

    const productMap = new Map(products.map((p) => [p.id, p]));
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    let discountAmount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;

    if (dto.couponCode?.trim()) {
      const categoryIds = [
        ...new Set(
          products
            .map((p) => p.categoryId)
            .filter((id): id is string => id !== null),
        ),
      ];
      const validation = await this.couponsService.validateCoupon({
        code: dto.couponCode.trim(),
        customerId: customerId ?? undefined,
        productIds,
        categoryIds,
        totalAmount: subtotal,
      });
      if (!validation.valid) {
        throw new BadRequestException(validation.message ?? 'Cupón no válido');
      }
      discountAmount = validation.discountAmount ?? 0;
      if (validation.coupon) {
        couponId = validation.coupon.id;
        couponCode = validation.coupon.code;
      }
    }

    const shippingCost = dto.shippingCost ?? 0;
    const tax = 0;
    const total = Math.max(0, subtotal - discountAmount + shippingCost + tax);
    const orderNumber = `V-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const createdById = this.auditContext.getUserId() ?? null;
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    // Validate source quote if provided
    if (dto.sourceQuoteId) {
      const quote = await this.prisma.serviceQuote.findFirst({
        where: { id: dto.sourceQuoteId, tenantId },
      });
      if (!quote) throw new NotFoundException('Cotización no encontrada');
      if (quote.status !== 'APPROVED') {
        throw new BadRequestException('Solo se pueden convertir cotizaciones aprobadas');
      }
    }

    // Fetch active session for TC (pre-transaction read)
    const activeSessionForTc = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
      select: { id: true, exchangeRateUsdMxn: true },
    });
    const exchangeRate = activeSessionForTc ? Number(activeSessionForTc.exchangeRateUsdMxn) : 1;
    const hasUsdPayment = (dto.payments?.some((p) => p.currency === 'USD') ?? false) || dto.changeCurrency === 'USD';

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          tenantId,
          ...(customerId != null && { customerId }),
          ...(addressId != null && { addressId }),
          subtotal,
          tax,
          shippingCost,
          discount: discountAmount,
          total,
          ...(dto.notes != null && dto.notes !== '' && { notes: dto.notes }),
          ...(couponId != null && { couponId }),
          ...(couponCode != null && { couponCode }),
          status: (dto.status ?? 'PENDING') as any,
          paymentStatus: (dto.paymentStatus ?? PaymentStatus.PENDING) as any,
          ...(createdById != null && { createdById }),
          ...(branchId != null && { branchId }),
          ...(dto.sourceQuoteId != null && { serviceQuoteId: dto.sourceQuoteId }),
          ...(hasUsdPayment && { exchangeRateUsed: exchangeRate }),
        },
      });

      // Create product order items
      for (const item of productItems) {
        const product = productMap.get(item.productId!)!;
        const itemDiscount = item.discount ?? 0;
        const itemTax = item.tax ?? 0;
        const itemSubtotal = Math.max(0, item.price * item.quantity - itemDiscount);
        const itemTotal = itemSubtotal + itemTax;
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            itemType: 'PRODUCT',
            productId: product.id,
            name: product.name,
            sku: product.sku,
            description: item.description ?? null,
            quantity: item.quantity,
            price: item.price,
            discount: itemDiscount,
            tax: itemTax,
            subtotal: itemSubtotal,
            total: itemTotal,
          },
        });
      }

      // Create service order items (no stock impact)
      for (const item of serviceItems) {
        const catalogSvc = item.serviceId ? serviceMap.get(item.serviceId) : null;
        const itemDiscount = item.discount ?? 0;
        const itemTax = item.tax ?? 0;
        const itemSubtotal = Math.max(0, item.price * item.quantity - itemDiscount);
        const itemTotal = itemSubtotal + itemTax;
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            itemType: 'SERVICE',
            serviceId: item.serviceId ?? null,
            name: item.name ?? catalogSvc?.name ?? 'Servicio',
            sku: null,
            description: item.description ?? null,
            quantity: item.quantity,
            price: item.price,
            discount: itemDiscount,
            tax: itemTax,
            subtotal: itemSubtotal,
            total: itemTotal,
          },
        });
      }

      // Decrement stock only for product items
      for (const item of productItems) {
        await tx.product.update({
          where: { id: item.productId! },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Decrement branch inventory for product items only
      if (branchId) {
        for (const item of productItems) {
          const updatedProduct = await tx.product.findUnique({
            where: { id: item.productId! },
            select: { stock: true },
          });
          await tx.branchInventory.upsert({
            where: { branchId_productId: { branchId, productId: item.productId! } },
            update: { stock: { decrement: item.quantity } },
            create: {
              branchId,
              productId: item.productId!,
              stock: updatedProduct?.stock ?? 0,
            },
          });
        }
      }

      const paymentStatus = (dto.paymentStatus ?? 'PENDING') as any;
      if (dto.payments && dto.payments.length > 0) {
        for (const split of dto.payments) {
          const currency = split.currency ?? 'MXN';
          const isUsd = currency === 'USD';
          const amountMxnEquivalent = isUsd ? Math.round(split.amount * exchangeRate * 100) / 100 : split.amount;
          await tx.payment.create({
            data: {
              orderId: newOrder.id,
              paymentMethod: split.method,
              currency,
              amount: split.amount,
              ...(split.amountReceived != null && { amountReceived: split.amountReceived }),
              ...(split.changeGiven != null && { changeGiven: split.changeGiven }),
              ...(split.method === 'CASH' && dto.changeCurrency != null && { changeCurrency: dto.changeCurrency }),
              ...(isUsd && {
                exchangeRateUsed: exchangeRate,
                amountOriginalCurrency: split.amount,
                amountMxnEquivalent,
              }),
              status: paymentStatus,
            },
          });
        }
      } else {
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            paymentMethod: dto.paymentMethod,
            currency: 'MXN',
            amount: total,
            status: paymentStatus,
          },
        });
      }

      if (couponId) {
        await this.couponsService.incrementUsage(couponId);
      }

      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalOrders: { increment: 1 },
            totalSpent: { increment: total },
          },
        });
      }

      // Auto-create CxC for credit orders
      const isCredit =
        dto.paymentMethod === 'CREDITO' ||
        (dto.payments?.some((p) => p.method === 'CREDITO') ?? false);

      if (isCredit && customerId) {
        const dueDate = dto.dueDate
          ? new Date(dto.dueDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await tx.accountReceivable.create({
          data: {
            tenantId,
            orderId: newOrder.id,
            customerId,
            totalAmount: total,
            balance: total,
            status: 'PENDIENTE',
            dueDate,
          },
        });
      }

      // Create CashMovements for non-credit payments
      const cashMovementSessionId = activeSessionForTc?.id ?? null;

      const allPayments = dto.payments?.length
        ? dto.payments.map((p) => ({
            method: p.method,
            currency: p.currency ?? 'MXN',
            amount: p.amount,
            amountReceived: p.amountReceived ?? null,
            changeGiven: p.changeGiven ?? null,
          }))
        : [{ method: dto.paymentMethod, currency: 'MXN', amount: total, amountReceived: null, changeGiven: null }];

      for (const p of allPayments) {
        if (!p.method || p.method === 'CREDITO') continue;
        const isUsd = p.currency === 'USD';
        // Full amountReceived enters the drawer; change-out is a separate EXPENSE movement
        const netAmount =
          p.method === 'CASH' && p.amountReceived != null
            ? Number(p.amountReceived)
            : Number(p.amount);
        const amountMxnEquivalent = isUsd ? Math.round(netAmount * exchangeRate * 100) / 100 : netAmount;
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: cashMovementSessionId,
            type: 'SALE',
            currency: p.currency,
            amount: netAmount,
            ...(isUsd && {
              exchangeRateUsed: exchangeRate,
              amountOriginalCurrency: netAmount,
              amountMxnEquivalent,
            }),
            paymentMethod: p.method,
            referenceId: newOrder.id,
            referenceType: 'ORDER',
            createdById: createdById,
          },
        });
      }

      // Change-out: separate EXPENSE movement so the correct drawer is debited
      if (dto.changeAmount && dto.changeAmount > 0 && dto.changeCurrency && cashMovementSessionId) {
        const isUsdChange = dto.changeCurrency === 'USD';
        const changeAmountMxn = isUsdChange
          ? Math.round(dto.changeAmount * exchangeRate * 100) / 100
          : dto.changeAmount;
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: cashMovementSessionId,
            type: 'EXPENSE',
            currency: dto.changeCurrency,
            amount: dto.changeAmount,
            paymentMethod: 'CASH',
            referenceType: 'CHANGE_OUT',
            referenceId: newOrder.id,
            notes: 'Cambio entregado al cliente',
            ...(isUsdChange && {
              exchangeRateUsed: exchangeRate,
              amountOriginalCurrency: dto.changeAmount,
              amountMxnEquivalent: changeAmountMxn,
            }),
            ...(createdById != null && { createdById }),
          },
        });
      }

      // Mark source quote as CONVERTED if applicable
      if (dto.sourceQuoteId) {
        await tx.serviceQuote.update({
          where: { id: dto.sourceQuoteId },
          data: { status: 'CONVERTED' },
        });
      }

      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          customer: true,
          shippingAddress: true,
          items: { include: { product: true } },
          payments: true,
        },
      });
    });

    return order!;
  }

  async findAll(query: QueryOrdersDto): Promise<PaginatedResponse<Order>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page, customerId, status } = query;

    const where: any = {
      tenantId,
      ...(customerId != null && { customerId }),
      ...(status != null && { status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          items: { include: { product: true } },
          payments: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Order> {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        shippingAddress: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.order.findFirst({ where: { id, tenantId } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: { customer: true, items: true },
    });
  }

  async updateStatusAndPayment(id: string, status: OrderStatus): Promise<Order> {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isCredit = order.payments.some((p) => p.paymentMethod === 'CREDITO');
    const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const fullyPaid = !isCredit && totalPaid >= Number(order.total);

    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(fullyPaid && { paymentStatus: 'PAID' }),
      },
      include: { customer: true, items: true, payments: true },
    });
  }

  async getStats() {
    const tenantId = this.tenantContext.requireTenantId();

    const [totalOrders, totalRevenue, pendingOrders, recentOrders] =
      await Promise.all([
        this.prisma.order.count({ where: { tenantId } }),
        this.prisma.order.aggregate({
          _sum: { total: true },
          where: { tenantId, paymentStatus: 'PAID' },
        }),
        this.prisma.order.count({ where: { tenantId, status: 'PENDING' } }),
        this.prisma.order.findMany({
          where: { tenantId },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            _count: { select: { items: true } },
          },
        }),
      ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      pendingOrders,
      recentOrders,
    };
  }

  /**
   * Obtiene cupones auto-aplicables para una orden en proceso
   */
  async getApplicableCoupons(params: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
  }): Promise<Coupon[]> {
    // Obtener IDs de productos y sus categorías
    const productIds = params.items.map((item) => item.productId);

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });

    const categoryIds = [
      ...new Set(
        products
          .map((p) => p.categoryId)
          .filter((id): id is string => id !== null),
      ),
    ];

    // Calcular total de la orden
    const totalAmount = params.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Obtener cupones auto-aplicables
    return this.couponsService.getAutoApplicableCoupons({
      customerId: params.customerId,
      productIds,
      categoryIds,
      totalAmount,
    });
  }

  /**
   * Calcula el mejor descuento de múltiples cupones auto-aplicables
   */
  async calculateBestDiscount(params: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
  }): Promise<{
    bestCoupon: Coupon | null;
    discountAmount: number;
  }> {
    const applicableCoupons = await this.getApplicableCoupons(params);

    if (applicableCoupons.length === 0) {
      return { bestCoupon: null, discountAmount: 0 };
    }

    const totalAmount = params.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    let bestCoupon: Coupon | null = null;
    let maxDiscount = 0;

    for (const coupon of applicableCoupons) {
      let discount = 0;

      if (coupon.type === 'PERCENTAGE') {
        discount = (totalAmount * Number(coupon.value)) / 100;

        // Aplicar descuento máximo si existe
        if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
          discount = Number(coupon.maxDiscount);
        }
      } else {
        // FIXED
        discount = Math.min(Number(coupon.value), totalAmount);
      }

      if (discount > maxDiscount) {
        maxDiscount = discount;
        bestCoupon = coupon;
      }
    }

    return {
      bestCoupon,
      discountAmount: maxDiscount,
    };
  }
}
