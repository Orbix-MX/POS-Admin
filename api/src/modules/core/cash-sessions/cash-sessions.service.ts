import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Prisma } from '@prisma/client';
import { OpenCashSessionDto } from './dto/open-session.dto';
import { CloseCashSessionDto } from './dto/close-session.dto';
import { QueryCashSessionsDto } from './dto/query-sessions.dto';

const CASH_INCOME_TYPES = ['SALE', 'CXC_PAYMENT', 'INCOME'] as const;
const CASH_EXPENSE_TYPES = ['SUPPLIER_PAYMENT', 'EXPENSE'] as const;

type MovementLike = {
  type: string;
  paymentMethod: string;
  currency: string;
  amount: any;
  amountMxnEquivalent?: any;
};

@Injectable()
export class CashSessionsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async open(dto: OpenCashSessionDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    const branchId = dto.branchId ?? null;

    const existing = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId, status: 'ABIERTA' },
    });
    if (existing) {
      throw new BadRequestException('Ya existe una sesión de caja abierta para esta sucursal');
    }

    return this.prisma.cashSession.create({
      data: {
        tenantId,
        branchId,
        status: 'ABIERTA',
        exchangeRateUsdMxn: dto.exchangeRateUsdMxn,
        openingAmount: dto.openingAmount,
        openingAmountUsd: dto.openingAmountUsd ?? 0,
        notes: dto.notes ?? null,
        openedById: userId ?? null,
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, email: true } },
      },
    });
  }

  async close(id: string, dto: CloseCashSessionDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const session = await this.prisma.cashSession.findFirst({
      where: { id, tenantId },
      include: { movements: true },
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');
    if (session.status === 'CERRADA') {
      throw new BadRequestException('Esta sesión ya está cerrada');
    }

    const movements = session.movements as unknown as MovementLike[];

    const expectedCashMxn = this.calculateExpectedCash(
      Number(session.openingAmount),
      movements,
      'MXN',
    );
    const expectedCashUsd = this.calculateExpectedCash(
      Number(session.openingAmountUsd),
      movements,
      'USD',
    );

    const differenceMxn = dto.cashCounted - expectedCashMxn;
    const cashCountedUsd = dto.cashCountedUsd ?? 0;
    const differenceUsd = cashCountedUsd - expectedCashUsd;

    return this.prisma.cashSession.update({
      where: { id },
      data: {
        status: 'CERRADA',
        closingAmount: expectedCashMxn,
        cashCounted: dto.cashCounted,
        cashCountedUsd,
        difference: differenceMxn,
        differenceUsd,
        notes: dto.notes ?? session.notes,
        closedById: userId ?? null,
        closedAt: new Date(),
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, email: true } },
        closedBy: { select: { id: true, email: true } },
        movements: true,
      },
    });
  }

  async getActive(branchId?: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, email: true } },
        movements: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!session) return null;
    const movements = session.movements as unknown as MovementLike[];
    const summary = this.buildSummary(
      Number(session.openingAmount),
      Number(session.openingAmountUsd),
      movements,
    );
    return { ...session, summary };
  }

  async findAll(query: QueryCashSessionsDto): Promise<PaginatedResponse<unknown>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page, status, branchId } = query;

    const where: Prisma.CashSessionWhereInput = { tenantId };
    if (status) where.status = status;
    if (branchId) where.branchId = branchId;

    const [sessions, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
          openedBy: { select: { id: true, email: true } },
          closedBy: { select: { id: true, email: true } },
          _count: { select: { movements: true } },
        },
      }),
      this.prisma.cashSession.count({ where }),
    ]);

    return {
      data: sessions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const session = await this.prisma.cashSession.findFirst({
      where: { id, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, email: true } },
        closedBy: { select: { id: true, email: true } },
        movements: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');

    const movements = session.movements as unknown as MovementLike[];
    const summary = this.buildSummary(
      Number(session.openingAmount),
      Number(session.openingAmountUsd),
      movements,
    );
    return { ...session, summary };
  }

  // ---- helpers ----

  calculateExpectedCash(
    openingAmount: number,
    movements: MovementLike[],
    currency: 'MXN' | 'USD' = 'MXN',
  ): number {
    let cash = openingAmount;
    for (const m of movements) {
      const movCurrency = (m.currency ?? 'MXN').toUpperCase();
      if (movCurrency !== currency) continue;
      if (m.paymentMethod.toUpperCase() !== 'CASH') continue;
      const amt = Number(m.amount);
      if ((CASH_INCOME_TYPES as readonly string[]).includes(m.type)) {
        cash += amt;
      } else if ((CASH_EXPENSE_TYPES as readonly string[]).includes(m.type)) {
        cash -= amt;
      }
    }
    return Math.round(cash * 100) / 100;
  }

  buildSummary(
    openingAmountMxn: number,
    openingAmountUsd: number,
    movements: MovementLike[],
  ) {
    const totals = {
      sales:    { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
      cxc:      { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
      supplier: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
      income:   { cash: 0, cashUsd: 0, total: 0 },
      expense:  { cash: 0, cashUsd: 0, total: 0 },
    };

    for (const m of movements) {
      const amt = Number(m.amount);
      const amtMxn = m.amountMxnEquivalent != null ? Number(m.amountMxnEquivalent) : amt;
      const method = m.paymentMethod.toUpperCase();
      const isUsd = (m.currency ?? 'MXN').toUpperCase() === 'USD';

      switch (m.type) {
        case 'SALE':
          totals.sales.total += isUsd ? amtMxn : amt;
          if (method === 'CASH') {
            if (isUsd) totals.sales.cashUsd += amt;
            else totals.sales.cash += amt;
          } else if (method === 'CARD') totals.sales.card += amt;
          else if (method === 'TRANSFER') totals.sales.transfer += amt;
          break;
        case 'CXC_PAYMENT':
          totals.cxc.total += isUsd ? amtMxn : amt;
          if (method === 'CASH') {
            if (isUsd) totals.cxc.cashUsd += amt;
            else totals.cxc.cash += amt;
          } else if (method === 'CARD') totals.cxc.card += amt;
          else if (method === 'TRANSFER') totals.cxc.transfer += amt;
          break;
        case 'SUPPLIER_PAYMENT':
          totals.supplier.total += isUsd ? amtMxn : amt;
          if (method === 'CASH') {
            if (isUsd) totals.supplier.cashUsd += amt;
            else totals.supplier.cash += amt;
          } else if (method === 'CARD') totals.supplier.card += amt;
          else if (method === 'TRANSFER') totals.supplier.transfer += amt;
          break;
        case 'INCOME':
          totals.income.total += isUsd ? amtMxn : amt;
          if (method === 'CASH') {
            if (isUsd) totals.income.cashUsd += amt;
            else totals.income.cash += amt;
          }
          break;
        case 'EXPENSE':
          totals.expense.total += isUsd ? amtMxn : amt;
          if (method === 'CASH') {
            if (isUsd) totals.expense.cashUsd += amt;
            else totals.expense.cash += amt;
          }
          break;
      }
    }

    const expectedCashMxn = this.calculateExpectedCash(openingAmountMxn, movements, 'MXN');
    const expectedCashUsd = this.calculateExpectedCash(openingAmountUsd, movements, 'USD');

    return {
      openingAmount: openingAmountMxn,
      openingAmountUsd,
      expectedCash: expectedCashMxn,
      expectedCashUsd,
      totals,
      movementsCount: movements.length,
    };
  }
}
