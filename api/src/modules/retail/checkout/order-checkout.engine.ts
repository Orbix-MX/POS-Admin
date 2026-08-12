import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

/**
 * OrderCheckoutEngine — shared financial side of a checkout: resolving the open
 * cash session and writing the Payment + CashMovement rows for an Order. Extracted
 * so every sales channel (retail comanda, direct sale, dining order) produces the
 * exact same financial footprint. Mutating methods run inside a caller-provided
 * transaction; payment/cash writes stay atomic with the rest of the checkout.
 */

export interface CheckoutPayment {
  paymentMethod: string;
  amount: number;
  currency?: string;
  amountReceived?: number;
  changeGiven?: number;
}

@Injectable()
export class OrderCheckoutEngine {
  constructor(private readonly prisma: PrismaService) {}

  /** Open cash session for the branch, or throw if the drawer is closed. */
  async resolveActiveCashSession(
    tenantId: string,
    branchId: string | null,
  ): Promise<{ id: string }> {
    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
      select: { id: true },
    });
    if (!session) {
      throw new BadRequestException('No hay sesión de caja activa. Abre la caja antes de cobrar.');
    }
    return session;
  }

  /** One Payment row per split, concept SALE, status PAID. */
  async createPayments(
    tx: Prisma.TransactionClient,
    params: { orderId: string; payments: CheckoutPayment[]; userId: string | null },
  ): Promise<void> {
    for (const payment of params.payments) {
      const currency = payment.currency ?? 'MXN';
      await tx.payment.create({
        data: {
          orderId: params.orderId,
          paymentMethod: payment.paymentMethod,
          currency,
          amount: payment.amount,
          ...(payment.amountReceived != null && { amountReceived: payment.amountReceived }),
          ...(payment.changeGiven != null && { changeGiven: payment.changeGiven }),
          paymentConcept: 'SALE',
          status: 'PAID',
          ...(params.userId != null && { createdById: params.userId }),
        },
      });
    }
  }

  /** One SALE CashMovement per split, referencing the order. */
  async createCashMovements(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      sessionId: string;
      orderId: string;
      payments: CheckoutPayment[];
      userId: string | null;
    },
  ): Promise<void> {
    for (const payment of params.payments) {
      const currency = payment.currency ?? 'MXN';
      await tx.cashMovement.create({
        data: {
          tenantId: params.tenantId,
          cashSessionId: params.sessionId,
          type: 'SALE',
          currency,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          referenceId: params.orderId,
          referenceType: 'ORDER',
          createdById: params.userId ?? null,
        },
      });
    }
  }
}
