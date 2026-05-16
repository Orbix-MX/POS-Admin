import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { AccountReceivableStatus } from '@prisma/client';
import { QueryReceivablesDto } from './dto/query-receivables.dto';
import { RegisterCxCPaymentDto } from './dto/register-payment.dto';

@Injectable()
export class ReceivablesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async findAll(query: QueryReceivablesDto): Promise<PaginatedResponse<unknown>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page, customerId, status } = query;

    // Mark overdue records before listing
    await this.prisma.accountReceivable.updateMany({
      where: {
        tenantId,
        dueDate: { lt: new Date() },
        balance: { gt: 0 },
        status: { notIn: ['PAGADO', 'VENCIDO'] },
      },
      data: { status: 'VENCIDO' },
    });

    const where: {
      tenantId: string;
      customerId?: string;
      status?: AccountReceivableStatus;
    } = { tenantId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    const [records, total] = await Promise.all([
      this.prisma.accountReceivable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNumber: true, total: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      }),
      this.prisma.accountReceivable.count({ where }),
    ]);

    return {
      data: records,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const record = await this.prisma.accountReceivable.findFirst({
      where: { id, tenantId },
      include: {
        order: { select: { orderNumber: true, total: true, createdAt: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    if (!record) throw new NotFoundException('Cuenta por cobrar no encontrada');
    return record;
  }

  async registerPayment(id: string, dto: RegisterCxCPaymentDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const record = await this.prisma.accountReceivable.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Cuenta por cobrar no encontrada');
    if (record.status === 'PAGADO') {
      throw new BadRequestException('Esta cuenta ya está completamente pagada');
    }

    const balance = Number(record.balance);
    if (dto.amount > balance) {
      throw new BadRequestException(
        `El monto (${dto.amount}) excede el saldo pendiente (${balance})`,
      );
    }

    const newBalance = balance - dto.amount;
    const newStatus: AccountReceivableStatus = newBalance === 0 ? 'PAGADO' : 'PARCIAL';

    const userId = this.auditContext.getUserId();

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.accountReceivablePayment.create({
        data: {
          accountReceivableId: id,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
        },
      });

      if (newBalance === 0 && record.orderId) {
        await tx.order.update({
          where: { id: record.orderId },
          data: { paymentStatus: 'PAID' },
        });
      }

      // Create CashMovement for this CxC payment
      const activeSession = await tx.cashSession.findFirst({
        where: { tenantId, status: 'ABIERTA' },
        select: { id: true },
      });
      await tx.cashMovement.create({
        data: {
          tenantId,
          cashSessionId: activeSession?.id ?? null,
          type: 'CXC_PAYMENT',
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          referenceId: payment.id,
          referenceType: 'CXC_PAYMENT',
          notes: dto.notes ?? null,
          createdById: userId ?? null,
        },
      });

      return tx.accountReceivable.update({
        where: { id },
        data: { balance: newBalance, status: newStatus },
        include: {
          order: { select: { orderNumber: true, total: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      });
    });
  }

  async getStats() {
    const tenantId = this.tenantContext.requireTenantId();

    const [totalPendiente, totalVencido, totalParcial, totalPagado] = await Promise.all([
      this.prisma.accountReceivable.aggregate({
        _sum: { balance: true },
        _count: true,
        where: { tenantId, status: 'PENDIENTE' },
      }),
      this.prisma.accountReceivable.aggregate({
        _sum: { balance: true },
        _count: true,
        where: { tenantId, status: 'VENCIDO' },
      }),
      this.prisma.accountReceivable.aggregate({
        _sum: { balance: true },
        _count: true,
        where: { tenantId, status: 'PARCIAL' },
      }),
      this.prisma.accountReceivable.aggregate({
        _sum: { totalAmount: true },
        _count: true,
        where: { tenantId, status: 'PAGADO' },
      }),
    ]);

    return {
      pendiente: {
        count: totalPendiente._count,
        balance: Number(totalPendiente._sum.balance ?? 0),
      },
      vencido: {
        count: totalVencido._count,
        balance: Number(totalVencido._sum.balance ?? 0),
      },
      parcial: {
        count: totalParcial._count,
        balance: Number(totalParcial._sum.balance ?? 0),
      },
      pagado: {
        count: totalPagado._count,
        total: Number(totalPagado._sum.totalAmount ?? 0),
      },
    };
  }
}
