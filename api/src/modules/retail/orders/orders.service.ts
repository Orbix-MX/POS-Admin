import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { Order, OrderStatus, Coupon, PaymentStatus } from '@prisma/client';
import { CouponsService } from '../coupons/coupons.service';
import { AuditService } from '../../../common/services/audit.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import {
  roundMoney,
  sumMoney,
  calculateLineSubtotal,
  calculateTax,
  convertMoney,
} from '../../../common/utils/money.util';
import { safeConvertUnits } from '../../../common/helpers/unit-conversion';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private auditContext: AuditContextService,
    private tenantContext: TenantContextService,
    private couponsService: CouponsService,
    private audit: AuditService,
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

    // Validate and load products (include recipe for consumption check)
    const productIds = [...new Set(productItems.map((i) => i.productId).filter(Boolean) as string[])];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          include: {
            category: true,
            recipe: {
              include: {
                items: {
                  include: { supply: { include: { baseUnit: true, inventoryUnit: true } } },
                },
              },
            },
          },
        })
      : [];
    if (products.length !== productIds.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !found.has(id));
      throw new NotFoundException(`Productos no encontrados: ${missing.join(', ')}`);
    }

    // Pre-validate supply stock for RECIPE products
    for (const item of productItems) {
      const product = products.find((p) => p.id === item.productId)!;
      if ((product as any).type !== 'RECIPE') continue;
      const recipe = (product as any).recipe;
      if (!recipe?.items?.length) {
        throw new BadRequestException(
          `El producto "${product.name}" es de tipo receta pero no tiene ingredientes configurados`,
        );
      }
      for (const ri of recipe.items) {
        // neededInStockUnit = quantity in the same unit as supply.stock (baseUnit when configured)
        const stockUnit = (ri.supply as any).baseUnit?.symbol ?? ri.supply.unit;
        const neededInStockUnit = ri.normalizedQuantity != null
          ? Number(ri.normalizedQuantity) * item.quantity
          : safeConvertUnits(Number(ri.quantity) * item.quantity, ri.unit, stockUnit);
        if (Number(ri.supply.stock) < neededInStockUnit) {
          const displayUnit = (ri.supply as any).inventoryUnit?.symbol ?? ri.supply.unit;
          throw new BadRequestException(
            `Stock insuficiente del insumo "${ri.supply.name}". ` +
            `Disponible: ${ri.supply.stock} ${stockUnit}, necesario: ${neededInStockUnit.toFixed(3)} ${stockUnit}`,
          );
        }
      }
    }

    // Optionally validate services from catalog
    const catalogServiceIds = [...new Set(serviceItems.map((i) => i.serviceId).filter(Boolean) as string[])];
    const catalogServices = catalogServiceIds.length
      ? await this.prisma.service.findMany({ where: { id: { in: catalogServiceIds } } })
      : [];
    const serviceMap = new Map(catalogServices.map((s) => [s.id, s]));

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Tenant default tax rate (percent) from settings JSON; product.taxRate overrides per item
    const tenantId = this.tenantContext.requireTenantId();
    const tenantRow = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const tenantSettings = (tenantRow?.settings ?? {}) as Record<string, unknown>;
    const tenantDefaultTaxRate = Number(tenantSettings.defaultTaxRate ?? 0) || 0;

    const resolveTaxRate = (productId?: string): number => {
      if (!productId) return tenantDefaultTaxRate;
      const p = productMap.get(productId);
      return p?.taxRate != null ? Number(p.taxRate) : tenantDefaultTaxRate;
    };

    const subtotal = sumMoney(
      dto.items.map((item) => item.price * item.quantity),
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

    // Per-item line math (discount, tax, subtotal, total) computed once and reused
    const lineMath = new Map<
      (typeof dto.items)[number],
      { discount: number; tax: number; subtotal: number; total: number }
    >();
    for (const item of dto.items) {
      const itemDiscount = roundMoney(item.discount ?? 0);
      const itemSubtotal = calculateLineSubtotal(
        item.price,
        item.quantity,
        itemDiscount,
      );
      const isProduct = !item.itemType || item.itemType === 'PRODUCT';
      // Explicit per-item tax wins; otherwise derive from product/tenant rate
      const explicitTax = roundMoney(item.tax ?? 0);
      const derivedTax = isProduct
        ? calculateTax(itemSubtotal, resolveTaxRate(item.productId))
        : 0;
      const itemTax = explicitTax > 0 ? explicitTax : derivedTax;
      lineMath.set(item, {
        discount: itemDiscount,
        tax: itemTax,
        subtotal: itemSubtotal,
        total: roundMoney(itemSubtotal + itemTax),
      });
    }

    const shippingCost = roundMoney(dto.shippingCost ?? 0);
    discountAmount = roundMoney(discountAmount);
    const tax = sumMoney([...lineMath.values()].map((l) => l.tax));
    const total = roundMoney(
      Math.max(0, subtotal - discountAmount + shippingCost + tax),
    );
    const orderNumber = `V-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const createdById = this.auditContext.getUserId() ?? null;
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

    // Fetch active session for TC (pre-transaction read) — required for checkout
    const activeSessionForTc = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
      select: { id: true, exchangeRateUsdMxn: true },
    });
    if (!activeSessionForTc) {
      throw new BadRequestException('No hay sesión de caja activa. Abre la caja antes de realizar ventas.');
    }
    const exchangeRate = Number(activeSessionForTc.exchangeRateUsdMxn);
    const hasUsdPayment = (dto.payments?.some((p) => p.currency === 'USD') ?? false) || dto.changeCurrency === 'USD';

    // Compute how much is being paid now (non-credit methods)
    const paidNow = dto.payments?.length
      ? dto.payments.filter((p) => p.method !== 'CREDITO').reduce((s, p) => s + Number(p.amount), 0)
      : dto.paymentMethod !== 'CREDITO' ? total : 0;

    // For layaway orders, compute payment status server-side
    let initialPaymentStatus: string;
    if (dto.isLayaway) {
      initialPaymentStatus = paidNow >= total ? 'PAID' : paidNow > 0 ? 'PARTIALLY_PAID' : 'PENDING';
    } else {
      initialPaymentStatus = (dto.paymentStatus ?? PaymentStatus.PENDING) as string;
    }

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
          status: dto.isLayaway ? ('LAYAWAY' as any) : ((dto.status ?? 'PENDING') as any),
          paymentStatus: initialPaymentStatus as any,
          ...(createdById != null && { createdById }),
          ...(branchId != null && { branchId }),
          ...(dto.sourceQuoteId != null && { serviceQuoteId: dto.sourceQuoteId }),
          ...(hasUsdPayment && { exchangeRateUsed: exchangeRate }),
        },
      });

      // Create product order items
      for (const item of productItems) {
        const product = productMap.get(item.productId!)!;
        const m = lineMath.get(item)!;
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
            discount: m.discount,
            tax: m.tax,
            subtotal: m.subtotal,
            total: m.total,
          },
        });
      }

      // Create service order items (no stock impact)
      for (const item of serviceItems) {
        const catalogSvc = item.serviceId ? serviceMap.get(item.serviceId) : null;
        const m = lineMath.get(item)!;
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
            discount: m.discount,
            tax: m.tax,
            subtotal: m.subtotal,
            total: m.total,
          },
        });
      }

      // Decrement stock only for SIMPLE product items — guarded against negative stock.
      // updateMany with stock>=qty is atomic at row level; count===0 means the
      // product is untracked-with-insufficient or a concurrent sale drained it.
      for (const item of productItems) {
        const product = productMap.get(item.productId!)!;
        if ((product as any).type === 'RECIPE') {
          // Consume recipe supply ingredients
          const recipe = (product as any).recipe;
          if (recipe?.items?.length) {
            for (const ri of recipe.items) {
              const stockUnit = (ri.supply as any).baseUnit?.symbol ?? ri.supply.unit;
              const needed = ri.normalizedQuantity != null
                ? Number(ri.normalizedQuantity) * item.quantity
                : safeConvertUnits(Number(ri.quantity) * item.quantity, ri.unit, stockUnit);
              const res = await tx.supply.updateMany({
                where: { id: ri.supplyId, stock: { gte: needed } },
                data: { stock: { decrement: needed } },
              });
              if (res.count === 0) {
                throw new BadRequestException(
                  `Stock insuficiente del insumo "${ri.supply.name}" al procesar venta`,
                );
              }
              const convNote = ri.normalizedQuantity != null && ri.unit !== stockUnit
                ? `Consumo receta: ${product.name} (${Number(ri.quantity)} ${ri.unit} → ${needed.toFixed(3)} ${stockUnit})`
                : `Consumo receta: ${product.name}`;
              await tx.supplyMovement.create({
                data: {
                  tenantId,
                  supplyId: ri.supplyId,
                  type: 'RECIPE_CONSUMPTION',
                  quantity: needed,
                  referenceId: newOrder.id,
                  notes: convNote,
                  ...(branchId && { branchId }),
                  ...(createdById && { createdById }),
                },
              });
            }
          }
          continue;
        }

        // SIMPLE product stock decrement
        if (product.trackInventory) {
          const res = await tx.product.updateMany({
            where: { id: item.productId!, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (res.count === 0) {
            throw new BadRequestException(
              `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}`,
            );
          }
        }
      }

      // Decrement branch inventory only for SIMPLE items with trackInventory
      if (branchId) {
        for (const item of productItems) {
          const product = productMap.get(item.productId!)!;
          if ((product as any).type !== 'SIMPLE' || !product.trackInventory) continue;
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

      const paymentStatus = initialPaymentStatus as any;
      const paymentConcept = dto.isLayaway ? 'LAYAWAY_DEPOSIT' : 'SALE';
      if (dto.payments && dto.payments.length > 0) {
        for (const split of dto.payments) {
          const currency = split.currency ?? 'MXN';
          const isUsd = currency === 'USD';
          const amountMxnEquivalent = isUsd ? convertMoney(split.amount, exchangeRate) : roundMoney(split.amount);
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
              paymentConcept: paymentConcept as any,
              status: paymentStatus,
              ...(createdById != null && { createdById }),
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
            paymentConcept: paymentConcept as any,
            status: paymentStatus,
            ...(createdById != null && { createdById }),
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

      // Auto-create CxC for credit orders and layaway with remaining balance
      const isCredit =
        dto.paymentMethod === 'CREDITO' ||
        (dto.payments?.some((p) => p.method === 'CREDITO') ?? false);

      const remainingBalance = Math.max(0, total - paidNow);

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
      } else if (dto.isLayaway && remainingBalance > 0 && customerId) {
        // Layaway with partial deposit — track remainder as CxC
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await tx.accountReceivable.create({
          data: {
            tenantId,
            orderId: newOrder.id,
            customerId,
            totalAmount: total,
            balance: remainingBalance,
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
        // Use sale amount (net) — amountReceived/changeGiven are metadata only (for tickets/audit)
        const netAmount = roundMoney(Number(p.amount));
        const amountMxnEquivalent = isUsd ? convertMoney(netAmount, exchangeRate) : netAmount;
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
      // Change is metadata only — no separate CHANGE_OUT movement

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
          refunds: { orderBy: { createdAt: 'desc' } },
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
        refunds: { orderBy: { createdAt: 'desc' } },
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

  /** Cancel an order: void it, restore inventory/cash/CxC. */
  async cancelOrder(id: string, reason: string): Promise<Order> {
    return this.reverseOrder(id, reason, 'CANCEL');
  }

  /** Return a sale (full refund MVP): restore inventory/cash, mark REFUNDED. */
  async returnOrder(id: string, reason: string): Promise<Order> {
    return this.reverseOrder(id, reason, 'RETURN');
  }

  private async reverseOrder(
    id: string,
    reason: string,
    mode: 'CANCEL' | 'RETURN',
  ): Promise<Order> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;

    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        payments: true,
        accountReceivable: { include: { payments: true } },
      },
    });
    if (!order) throw new NotFoundException('Venta no encontrada');
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException('La venta ya fue cancelada o devuelta');
    }

    const before = { status: order.status, paymentStatus: order.paymentStatus };

    return this.prisma.$transaction(async (tx) => {
      // 1. Restore stock for product items
      for (const it of order.items) {
        if (it.itemType !== 'PRODUCT' || !it.productId) continue;
        const prod = await tx.product.findUnique({
          where: { id: it.productId },
          select: { trackInventory: true },
        });
        if (!prod?.trackInventory) continue;

        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.quantity } },
        });
        if (order.branchId) {
          await tx.branchInventory.upsert({
            where: {
              branchId_productId: {
                branchId: order.branchId,
                productId: it.productId,
              },
            },
            update: { stock: { increment: it.quantity } },
            create: {
              branchId: order.branchId,
              productId: it.productId,
              stock: it.quantity,
            },
          });
        }
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            type: 'DEVOLUCION',
            productId: it.productId,
            branchId: order.branchId ?? null,
            quantity: it.quantity,
            referenceId: order.id,
            referenceType: 'ORDER',
            notes: `Reversa por ${mode}`,
            createdById: userId,
          },
        });
      }

      // 2. Reverse cash movements tied to this order
      const activeSession = await tx.cashSession.findFirst({
        where: {
          tenantId,
          branchId: order.branchId ?? undefined,
          status: 'ABIERTA',
        },
        select: { id: true },
      });
      const orderMovements = await tx.cashMovement.findMany({
        where: { tenantId, referenceId: order.id, referenceType: { in: ['ORDER', 'CHANGE_OUT'] } },
      });
      for (const m of orderMovements) {
        // SALE (cash in) → reverse with EXPENSE; CHANGE_OUT (cash out) → reverse with INCOME
        const reverseType = m.type === 'EXPENSE' ? 'INCOME' : 'EXPENSE';
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: activeSession?.id ?? null,
            type: reverseType,
            currency: m.currency,
            amount: m.amount,
            ...(m.exchangeRateUsed != null && { exchangeRateUsed: m.exchangeRateUsed }),
            ...(m.amountOriginalCurrency != null && { amountOriginalCurrency: m.amountOriginalCurrency }),
            ...(m.amountMxnEquivalent != null && { amountMxnEquivalent: m.amountMxnEquivalent }),
            paymentMethod: m.paymentMethod,
            referenceId: order.id,
            referenceType: `REVERSAL_${mode}`,
            notes: `Reversa de venta ${order.orderNumber}`,
            createdById: userId,
          },
        });
      }

      // 3. Reverse CxC: delete if nothing collected, otherwise close it out
      if (order.accountReceivable) {
        const collected = order.accountReceivable.payments.length > 0;
        if (!collected) {
          await tx.accountReceivable.delete({
            where: { id: order.accountReceivable.id },
          });
        } else {
          await tx.accountReceivable.update({
            where: { id: order.accountReceivable.id },
            data: {
              balance: 0,
              status: 'PAGADO',
              notes: `Anulada por ${mode}: ${reason}`,
            },
          });
        }
      }

      // 4. Reverse customer stats
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            totalOrders: { decrement: 1 },
            totalSpent: { decrement: Number(order.total) },
          },
        });
      }

      // 5. Update order status
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: mode === 'CANCEL' ? 'CANCELLED' : 'REFUNDED',
          paymentStatus: 'REFUNDED',
          cancelledAt: new Date(),
          cancellationReason: reason,
          cancelledById: userId,
        },
        include: { customer: true, items: true, payments: true },
      });

      // 6. Audit trail
      await this.audit.log(
        {
          action: mode === 'CANCEL' ? 'ORDER_CANCEL' : 'ORDER_RETURN',
          entityType: 'Order',
          entityId: order.id,
          before,
          after: { status: updated.status, paymentStatus: updated.paymentStatus },
          reason,
        },
        tx,
      );

      return updated;
    });
  }

  async addPayment(orderId: string, dto: AddPaymentDto): Promise<Order> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;
    const branchId = this.tenantContext.getBranchId() ?? null;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { payments: true, accountReceivable: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (['CANCELLED', 'REFUNDED'].includes(order.status)) {
      throw new BadRequestException('No se pueden agregar pagos a una orden cancelada o reembolsada');
    }
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('La orden ya está completamente pagada');
    }

    const activeSession = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
      select: { id: true, exchangeRateUsdMxn: true },
    });
    if (!activeSession) {
      throw new BadRequestException('No hay sesión de caja activa');
    }
    const sessionRate = Number(activeSession.exchangeRateUsdMxn);

    const orderTotal = Number(order.total);
    const alreadyPaid = order.payments
      .filter((p) => p.paymentMethod !== 'CREDITO' && p.status !== 'REFUNDED')
      .reduce((s, p) => s + Number(p.amount), 0);

    const hasCardPayment = dto.payments.some((p) => p.method === 'CARD');
    const paymentConcept = (dto.paymentConcept ?? 'BALANCE_PAYMENT') as any;

    return this.prisma.$transaction(async (tx) => {
      // Create payment records
      for (const split of dto.payments) {
        const currency = split.currency ?? 'MXN';
        const isUsd = currency === 'USD';
        const amountMxnEquivalent = isUsd ? convertMoney(split.amount, sessionRate) : roundMoney(split.amount);
        await tx.payment.create({
          data: {
            orderId: order.id,
            paymentMethod: split.method,
            currency,
            amount: split.amount,
            ...(split.amountReceived != null && { amountReceived: split.amountReceived }),
            ...(split.changeGiven != null && { changeGiven: split.changeGiven }),
            ...(split.method === 'CASH' && dto.changeCurrency != null && { changeCurrency: dto.changeCurrency }),
            ...(isUsd && {
              exchangeRateUsed: sessionRate,
              amountOriginalCurrency: split.amount,
              amountMxnEquivalent,
            }),
            paymentConcept,
            status: split.method === 'CARD' ? 'PENDING' : ('PAID' as any),
            ...(userId != null && { createdById: userId }),
          },
        });
      }

      // Create cash movements for non-credit, non-card payments
      // Use sale amount (net) — amountReceived/changeGiven are metadata only (for tickets/audit)
      for (const p of dto.payments) {
        if (!p.method || p.method === 'CREDITO' || p.method === 'CARD') continue;
        const isUsd = (p.currency ?? 'MXN') === 'USD';
        const netAmount = roundMoney(Number(p.amount));
        const amountMxnEquivalent = isUsd ? convertMoney(netAmount, sessionRate) : netAmount;
        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: activeSession.id,
            type: 'SALE',
            currency: p.currency ?? 'MXN',
            amount: netAmount,
            ...(isUsd && { exchangeRateUsed: sessionRate, amountOriginalCurrency: netAmount, amountMxnEquivalent }),
            paymentMethod: p.method,
            referenceId: order.id,
            referenceType: 'ORDER',
            ...(userId != null && { createdById: userId }),
          },
        });
      }
      // Change is metadata only — no separate CHANGE_OUT movement

      // Recompute payment status
      const newlyPaidNonCard = dto.payments
        .filter((p) => p.method !== 'CREDITO' && p.method !== 'CARD')
        .reduce((s, p) => s + Number(p.amount), 0);
      const totalPaid = alreadyPaid + newlyPaidNonCard;

      let newPaymentStatus: string;
      if (hasCardPayment) {
        newPaymentStatus = 'PENDING'; // confirmed by updateStatusAndPayment flow
      } else {
        newPaymentStatus =
          totalPaid >= orderTotal ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
      }

      const newOrderStatus =
        newPaymentStatus === 'PAID' && order.status === 'LAYAWAY' ? 'CONFIRMED' : order.status;

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus as any,
          status: newOrderStatus as any,
        },
      });

      // Update CxC balance if exists
      if (order.accountReceivable) {
        const newBalance = Math.max(0, orderTotal - totalPaid);
        const newCxCStatus =
          newBalance <= 0 ? 'PAGADO' : newBalance < orderTotal ? 'PARCIAL' : 'PENDIENTE';
        await tx.accountReceivable.update({
          where: { id: order.accountReceivable.id },
          data: { balance: newBalance, status: newCxCStatus as any },
        });
      }

      return tx.order.findUnique({
        where: { id: order.id },
        include: { customer: true, items: { include: { product: true } }, payments: true },
      }) as Promise<Order>;
    });
  }

  /**
   * Refund a layaway deposit or a partial/full amount from a sale.
   * Creates an OrderRefund record, a EXPENSE cash movement (money out to customer),
   * and updates the order paymentStatus accordingly.
   */
  async refundOrder(orderId: string, dto: RefundOrderDto): Promise<Order> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;
    const branchId = this.tenantContext.getBranchId() ?? null;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        payments: true,
        items: true,
        refunds: true,
        accountReceivable: true,
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException('La orden ya fue cancelada o reembolsada completamente');
    }

    // Validate amount: cannot exceed what has actually been collected
    const totalCollected = order.payments
      .filter((p) => p.status !== 'REFUNDED' && p.paymentMethod !== 'CREDITO')
      .reduce((s, p) => s + Number(p.amount), 0);
    const previouslyRefunded = order.refunds.reduce((s, r) => s + Number(r.amount), 0);
    const maxRefundable = totalCollected - previouslyRefunded;

    const refundAmount = dto.amount;
    if (refundAmount > maxRefundable + 0.001) {
      throw new BadRequestException(
        `El monto a reembolsar ($${refundAmount}) supera el máximo reembolsable ($${maxRefundable.toFixed(2)})`,
      );
    }

    // Check layaway refund time window from tenant settings (only if NOT overriding)
    if (!dto.windowOverride && order.status === 'LAYAWAY' && order.createdAt) {
      const tenantRow = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });
      const settings = (tenantRow?.settings ?? {}) as Record<string, unknown>;
      const windowHours = typeof settings.layawayRefundWindowHours === 'number'
        ? settings.layawayRefundWindowHours
        : 24;
      const hoursElapsed = (Date.now() - new Date(order.createdAt).getTime()) / 3_600_000;
      if (windowHours > 0 && hoursElapsed > windowHours) {
        throw new BadRequestException(
          `El plazo de reembolso de ${windowHours}h ha vencido. Se requiere autorización para continuar.`,
        );
      }
    }

    const currency = dto.currency ?? 'MXN';

    // Original payment method (most recent non-credit payment)
    const originalMethod =
      [...order.payments]
        .filter((p) => p.paymentMethod !== 'CREDITO')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        ?.paymentMethod ?? null;

    return this.prisma.$transaction(async (tx) => {
      // 1. Find active cash session
      const activeSession = await tx.cashSession.findFirst({
        where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
        select: { id: true, exchangeRateUsdMxn: true },
      });
      if (!activeSession) throw new BadRequestException('No hay sesión de caja activa');

      const sessionRate = Number(activeSession.exchangeRateUsdMxn);
      const isUsd = currency === 'USD';

      // 2. Cash movement: EXPENSE (money leaves the drawer to the customer)
      const cashMov = await tx.cashMovement.create({
        data: {
          tenantId,
          cashSessionId: activeSession.id,
          type: 'EXPENSE',
          currency,
          amount: refundAmount,
          ...(isUsd && {
            exchangeRateUsed: sessionRate,
            amountOriginalCurrency: refundAmount,
            amountMxnEquivalent: convertMoney(refundAmount, sessionRate),
          }),
          paymentMethod: dto.refundMethod,
          referenceId: order.id,
          referenceType: 'REFUND',
          notes: `Reembolso: ${dto.reason}`,
          ...(userId != null && { createdById: userId }),
        },
      });

      // 3. OrderRefund record
      await tx.orderRefund.create({
        data: {
          tenantId,
          orderId: order.id,
          amount: refundAmount,
          currency,
          refundMethod: dto.refundMethod,
          originalMethod: originalMethod ?? undefined,
          reason: dto.reason,
          restoreInventory: dto.restoreInventory ?? false,
          windowOverride: dto.windowOverride ?? false,
          notes: dto.notes ?? null,
          cashMovementId: cashMov.id,
          ...(userId != null && { createdById: userId }),
        },
      });

      // 4. If restoreInventory, credit stock back for product items
      if (dto.restoreInventory) {
        for (const it of order.items) {
          if (it.itemType !== 'PRODUCT' || !it.productId) continue;
          const prod = await tx.product.findUnique({
            where: { id: it.productId },
            select: { trackInventory: true },
          });
          if (!prod?.trackInventory) continue;
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
          if (order.branchId) {
            await tx.branchInventory.upsert({
              where: { branchId_productId: { branchId: order.branchId, productId: it.productId } },
              update: { stock: { increment: it.quantity } },
              create: { branchId: order.branchId, productId: it.productId, stock: it.quantity },
            });
          }
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              type: 'DEVOLUCION',
              productId: it.productId,
              branchId: order.branchId ?? null,
              quantity: it.quantity,
              referenceId: order.id,
              referenceType: 'REFUND',
              notes: `Reembolso: ${dto.reason}`,
              createdById: userId,
            },
          });
        }
      }

      // 5. Recompute payment status
      const newTotalRefunded = previouslyRefunded + refundAmount;
      const isFullRefund = newTotalRefunded >= totalCollected - 0.001;

      let newPaymentStatus: string;
      if (isFullRefund) {
        newPaymentStatus = 'REFUNDED';
      } else {
        newPaymentStatus = 'PARTIALLY_REFUNDED';
      }

      // For layaway orders being fully refunded: also cancel the order
      const isLayaway = order.status === 'LAYAWAY';
      const newOrderStatus = isFullRefund && isLayaway ? 'CANCELLED' : order.status;

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus as any,
          status: newOrderStatus as any,
          ...(isFullRefund && isLayaway && {
            cancelledAt: new Date(),
            cancellationReason: dto.reason,
            cancelledById: userId,
          }),
        },
      });

      // 6. Update CxC if exists and fully refunded
      if (order.accountReceivable && isFullRefund) {
        await tx.accountReceivable.update({
          where: { id: order.accountReceivable.id },
          data: {
            balance: 0,
            status: 'PAGADO',
            notes: `Reembolso: ${dto.reason}`,
          },
        });
      }

      // 7. Audit
      await this.audit.log(
        {
          action: 'ORDER_REFUND',
          entityType: 'Order',
          entityId: order.id,
          before: { status: order.status, paymentStatus: order.paymentStatus },
          after: { status: newOrderStatus, paymentStatus: newPaymentStatus, refundAmount },
          reason: dto.reason,
        },
        tx,
      );

      return tx.order.findUnique({
        where: { id: order.id },
        include: { customer: true, items: { include: { product: true } }, payments: true, refunds: true },
      }) as Promise<Order>;
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
