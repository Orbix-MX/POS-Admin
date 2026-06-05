import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { AuditContextService } from '../../common/context/audit-context.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreateComandaDto } from './dto/create-comanda.dto';
import { AddItemsToComandaDto } from './dto/add-items-to-comanda.dto';
import { CheckoutComandaDto } from './dto/checkout-comanda.dto';
import { DirectCheckoutDto } from './dto/direct-checkout.dto';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class RestaurantService {
  constructor(
    private prisma: PrismaService,
    private auditContext: AuditContextService,
    private tenantContext: TenantContextService,
  ) {}

  async createComanda(dto: CreateComandaDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('La comanda debe tener al menos un item');
    }

    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;
    const createdById = this.auditContext.getUserId() ?? null;

    const subtotal = roundMoney(
      dto.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    );
    const total = subtotal;
    const orderNumber = `C-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          tenantId,
          subtotal,
          tax: 0,
          shippingCost: 0,
          discount: 0,
          total,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          kitchenStatus: 'PENDING',
          orderOrigin: 'RESTAURANT_COMANDA',
          tableNumber: dto.tableNumber,
          employeeNumber: dto.employeeNumber,
          guestCount: dto.guestCount,
          ...(branchId != null && { branchId }),
          ...(createdById != null && { createdById }),
        },
      });

      for (const item of dto.items) {
        const isProduct = !item.itemType || item.itemType === 'PRODUCT';
        const lineSubtotal = roundMoney(item.price * item.quantity);

        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            itemType: isProduct ? 'PRODUCT' : 'SERVICE',
            ...(isProduct && item.productId != null && { productId: item.productId }),
            name: item.name ?? (isProduct ? 'Producto' : 'Servicio'),
            description: item.notes ?? null,
            sku: null,
            quantity: item.quantity,
            price: item.price,
            discount: 0,
            tax: 0,
            subtotal: lineSubtotal,
            total: lineSubtotal,
          },
        });
      }

      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: { items: true },
      });
    });

    return order;
  }

  async getOpenTables() {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    return this.prisma.order.findMany({
      where: {
        tenantId,
        ...(branchId != null && { branchId }),
        tableNumber: { not: null },
        paymentStatus: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
      },
    });
  }

  async addItemsToComanda(orderId: string, dto: AddItemsToComandaDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, paymentStatus: 'PENDING' },
    });
    if (!order) throw new NotFoundException('Comanda no encontrada o ya cobrada');
    if (!dto.items?.length) throw new BadRequestException('Debes agregar al menos un item');

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const isProduct = !item.itemType || item.itemType === 'PRODUCT';
        const lineSubtotal = roundMoney(item.price * item.quantity);
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            itemType: isProduct ? 'PRODUCT' : 'SERVICE',
            ...(isProduct && item.productId != null && { productId: item.productId }),
            name: item.name ?? (isProduct ? 'Producto' : 'Servicio'),
            description: item.notes ?? null,
            sku: null,
            quantity: item.quantity,
            price: item.price,
            discount: 0,
            tax: 0,
            subtotal: lineSubtotal,
            total: lineSubtotal,
          },
        });
      }

      const allItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const newTotal = roundMoney(allItems.reduce((s, i) => s + Number(i.total), 0));
      await tx.order.update({
        where: { id: order.id },
        data: { subtotal: newTotal, total: newTotal },
      });
    });

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
  }

  async checkoutComanda(orderId: string, dto: CheckoutComandaDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;
    const userId = this.auditContext.getUserId() ?? null;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true },
    });

    if (!order || !order.tableNumber) throw new NotFoundException('Comanda no encontrada');
    if (order.paymentStatus !== 'PENDING') {
      throw new BadRequestException('La comanda ya fue cobrada o no está pendiente de pago');
    }

    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
      select: { id: true },
    });
    if (!session) {
      throw new BadRequestException('No hay sesión de caja activa. Abre la caja antes de cobrar.');
    }

    const netAmount = roundMoney(Number(order.total));
    const totalPagado = roundMoney(dto.payments.reduce((s, p) => s + p.amount, 0));

    if (totalPagado < netAmount) {
      throw new BadRequestException(
        `Pago insuficiente. Total: $${netAmount}, pagado: $${totalPagado}`,
      );
    }

    const finalPaymentStatus = totalPagado >= netAmount ? 'PAID' : 'PARTIALLY_PAID';

    return this.prisma.$transaction(async (tx) => {
      // Decrement stock for product items with trackInventory = true
      const productItems = order.items.filter(
        (i) => i.itemType === 'PRODUCT' && i.productId != null,
      );

      for (const item of productItems) {
        const product = await tx.product.findUnique({
          where: { id: item.productId! },
          select: { trackInventory: true, stock: true, name: true },
        });
        if (!product) continue;

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

      // Create payment records + cash movements per payment entry
      for (const payment of dto.payments) {
        const currency = payment.currency ?? 'MXN';
        await tx.payment.create({
          data: {
            orderId: order.id,
            paymentMethod: payment.paymentMethod,
            currency,
            amount: payment.amount,
            ...(payment.amountReceived != null && { amountReceived: payment.amountReceived }),
            ...(payment.changeGiven != null && { changeGiven: payment.changeGiven }),
            paymentConcept: 'SALE',
            status: 'PAID',
            ...(userId != null && { createdById: userId }),
          },
        });

        await tx.cashMovement.create({
          data: {
            tenantId,
            cashSessionId: session.id,
            type: 'SALE',
            currency,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            referenceId: order.id,
            referenceType: 'ORDER',
            createdById: userId ?? null,
          },
        });
      }

      // Update order to DELIVERED + paid status
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          paymentStatus: finalPaymentStatus as any,
        },
        include: {
          items: true,
          payments: true,
        },
      });
    });
  }

  async directCheckout(dto: DirectCheckoutDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('El cobro directo debe tener al menos un item');
    }

    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;
    const userId = this.auditContext.getUserId() ?? null;

    // Verify active cash session before entering the transaction
    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
      select: { id: true },
    });
    if (!session) {
      throw new BadRequestException('No hay sesión de caja activa. Abre la caja antes de cobrar.');
    }

    const subtotal = roundMoney(
      dto.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    );
    const total = subtotal;
    const orderNumber = `D-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          tenantId,
          subtotal,
          tax: 0,
          shippingCost: 0,
          discount: 0,
          total,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          tableNumber: null,
          employeeNumber: null,
          ...(branchId != null && { branchId }),
          ...(userId != null && { createdById: userId }),
        },
      });

      // 2. Create order items
      for (const item of dto.items) {
        const isProduct = item.productId != null;
        const lineSubtotal = roundMoney(item.price * item.quantity);

        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            itemType: isProduct ? 'PRODUCT' : 'SERVICE',
            ...(isProduct && { productId: item.productId }),
            name: item.name ?? (isProduct ? 'Producto' : 'Servicio'),
            sku: null,
            quantity: item.quantity,
            price: item.price,
            discount: 0,
            tax: 0,
            subtotal: lineSubtotal,
            total: lineSubtotal,
          },
        });
      }

      // 3. Decrement stock for product items with trackInventory = true
      const productItems = dto.items.filter((i) => i.productId != null);

      for (const item of productItems) {
        const product = await tx.product.findUnique({
          where: { id: item.productId! },
          select: { trackInventory: true, stock: true, name: true },
        });
        if (!product) continue;

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

      // 4. Create payment record
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          paymentMethod: dto.paymentMethod,
          currency: 'MXN',
          amount: total,
          paymentConcept: 'SALE',
          status: 'PAID',
          ...(userId != null && { createdById: userId }),
        },
      });

      // 5. Create cash movement
      await tx.cashMovement.create({
        data: {
          tenantId,
          cashSessionId: session.id,
          type: 'SALE',
          currency: 'MXN',
          amount: total,
          paymentMethod: dto.paymentMethod,
          referenceId: newOrder.id,
          referenceType: 'ORDER',
          createdById: userId ?? null,
        },
      });

      // 6. Mark order as delivered and paid, return with relations
      return tx.order.update({
        where: { id: newOrder.id },
        data: {
          status: 'DELIVERED',
          paymentStatus: 'PAID',
        },
        include: {
          items: true,
          payments: true,
        },
      });
    });
  }
}
