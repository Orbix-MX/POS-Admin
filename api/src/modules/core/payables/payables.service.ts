import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { AccountPayableStatus, Prisma } from '@prisma/client';
import { QueryPayablesDto } from './dto/query-payables.dto';
import { RegisterPayablePaymentDto } from './dto/register-payment.dto';

@Injectable()
export class PayablesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async findAll(query: QueryPayablesDto): Promise<PaginatedResponse<unknown>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page, supplierId, status, search } = query;

    const where: Prisma.AccountPayableWhereInput = { tenantId };
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { purchaseOrder: { orderNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [records, total] = await Promise.all([
      this.prisma.accountPayable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, email: true } },
          purchaseOrder: { select: { id: true, orderNumber: true, total: true } },
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      }),
      this.prisma.accountPayable.count({ where }),
    ]);

    return {
      data: records,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const record = await this.prisma.accountPayable.findFirst({
      where: { id, tenantId },
      include: {
        supplier: { select: { id: true, name: true, email: true, phone: true } },
        purchaseOrder: { select: { id: true, orderNumber: true, total: true, orderDate: true } },
        payments: { orderBy: { paymentDate: 'desc' }, include: { createdBy: { select: { id: true, email: true } } } },
      },
    });
    if (!record) throw new NotFoundException('Cuenta por pagar no encontrada');
    return record;
  }

  async registerPayment(id: string, dto: RegisterPayablePaymentDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const record = await this.prisma.accountPayable.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Cuenta por pagar no encontrada');
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
    const newStatus: AccountPayableStatus = newBalance === 0 ? 'PAGADO' : 'PARCIAL';

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          accountPayableId: id,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          createdById: userId ?? null,
        },
      });

      const activeSession = await tx.cashSession.findFirst({
        where: { tenantId, status: 'ABIERTA' },
        select: { id: true },
      });
      await tx.cashMovement.create({
        data: {
          tenantId,
          cashSessionId: activeSession?.id ?? null,
          type: 'SUPPLIER_PAYMENT',
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          supplierPaymentId: payment.id,
          notes: dto.notes ?? null,
          createdById: userId ?? null,
        },
      });

      return tx.accountPayable.update({
        where: { id },
        data: { balance: newBalance, status: newStatus },
        include: {
          supplier: { select: { id: true, name: true, email: true } },
          purchaseOrder: { select: { id: true, orderNumber: true, total: true } },
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      });
    });
  }

  async getStats() {
    const tenantId = this.tenantContext.requireTenantId();

    const [pendiente, parcial, pagado] = await Promise.all([
      this.prisma.accountPayable.aggregate({
        _sum: { balance: true },
        _count: true,
        where: { tenantId, status: 'PENDIENTE' },
      }),
      this.prisma.accountPayable.aggregate({
        _sum: { balance: true },
        _count: true,
        where: { tenantId, status: 'PARCIAL' },
      }),
      this.prisma.accountPayable.aggregate({
        _sum: { totalAmount: true },
        _count: true,
        where: { tenantId, status: 'PAGADO' },
      }),
    ]);

    return {
      pendiente: { count: pendiente._count, balance: Number(pendiente._sum.balance ?? 0) },
      parcial: { count: parcial._count, balance: Number(parcial._sum.balance ?? 0) },
      pagado: { count: pagado._count, total: Number(pagado._sum.totalAmount ?? 0) },
    };
  }
}
