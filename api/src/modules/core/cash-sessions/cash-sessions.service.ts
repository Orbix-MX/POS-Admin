import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Prisma } from '@prisma/client';
import { OpenCashSessionDto } from './dto/open-session.dto';
import { CloseCashSessionDto } from './dto/close-session.dto';
import { CloseWithAuthDto } from './dto/close-with-auth.dto';
import { QueryCashSessionsDto } from './dto/query-sessions.dto';
import { WithdrawForSuppliesDto } from './dto/withdraw-supplies.dto';
import { roundMoney } from '../../../common/utils/money.util';
import { convertToBaseUnit } from '../../../common/helpers/unit-conversion';

const CASH_INCOME_TYPES = ['SALE', 'CXC_PAYMENT', 'INCOME'] as const;
const CASH_EXPENSE_TYPES = ['SUPPLIER_PAYMENT', 'EXPENSE'] as const;

// Valid-format bcrypt hash used as constant-time dummy when user email is not found.
// Prevents timing oracle that would reveal which emails exist in the system.
const TIMING_SAFE_DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuQfTkF.n8cXD.5EGovU1qWDzd3tpjRCC';

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
    const branchId = dto.branchId ?? this.tenantContext.getBranchId() ?? null;

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

    const differenceMxn = roundMoney(dto.cashCounted - expectedCashMxn);
    const cashCountedUsd = roundMoney(dto.cashCountedUsd ?? 0);
    const differenceUsd = roundMoney(cashCountedUsd - expectedCashUsd);

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

  async createManualMovement(dto: import('./dto/create-movement.dto').CreateManualMovementDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const activeSession = await this.prisma.cashSession.findFirst({
      where: { tenantId, status: 'ABIERTA' },
    });

    const currency = dto.currency ?? 'MXN';
    const notesParts = [dto.reason, dto.notes].filter(Boolean);
    const notes = notesParts.length > 0 ? notesParts.join(' — ') : null;

    return this.prisma.cashMovement.create({
      data: {
        tenantId,
        cashSessionId: activeSession?.id ?? null,
        type: dto.type,
        currency,
        amount: dto.amount,
        paymentMethod: 'CASH',
        notes,
        createdById: userId ?? null,
      },
    });
  }

  async verifyCloseAuth(dto: import('./dto/verify-auth.dto').VerifyAuthDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const user = await this.prisma.user.findFirst({ where: { email: dto.authEmail } });
    // Always run bcrypt regardless of whether user exists — prevents timing oracle
    const passwordValid = await bcrypt.compare(dto.authPassword, user?.password ?? TIMING_SAFE_DUMMY_HASH);
    if (!user || !passwordValid) throw new UnauthorizedException('Credenciales incorrectas');

    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: user.id, tenantId },
    });
    if (!membership) throw new UnauthorizedException('El usuario autorizador no pertenece a esta organización');

    if (user.role !== 'SUPER_ADMIN') {
      const perms = await this.getEffectivePermissions(user.id, tenantId);
      if (!perms.includes('pos.cash:close')) {
        throw new ForbiddenException('El usuario no tiene permiso para cerrar caja');
      }
    }

    return { email: user.email };
  }

  async closeWithAuth(id: string, dto: CloseWithAuthDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const currentUserId = this.auditContext.getUserId();

    // Validate authorizer credentials
    const adminUser = await this.prisma.user.findFirst({
      where: { email: dto.authEmail },
    });
    // Always run bcrypt regardless of whether user exists — prevents timing oracle
    const passwordValid = await bcrypt.compare(dto.authPassword, adminUser?.password ?? TIMING_SAFE_DUMMY_HASH);
    if (!adminUser || !passwordValid) throw new UnauthorizedException('Credenciales incorrectas');

    // Ensure authorizer belongs to the same tenant
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: adminUser.id, tenantId },
    });
    if (!membership) throw new UnauthorizedException('El usuario autorizador no pertenece a esta organización');

    // Check authorizer has pos.cash:close permission (SUPER_ADMIN bypasses)
    if (adminUser.role !== 'SUPER_ADMIN') {
      const adminPerms = await this.getEffectivePermissions(adminUser.id, tenantId);
      if (!adminPerms.includes('pos.cash:close')) {
        throw new ForbiddenException('El usuario autorizador no tiene permiso para cerrar caja');
      }
    }

    // Close the session
    const session = await this.prisma.cashSession.findFirst({
      where: { id, tenantId },
      include: { movements: true },
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');
    if (session.status === 'CERRADA') throw new BadRequestException('Esta sesión ya está cerrada');

    const movements = session.movements as unknown as MovementLike[];
    const expectedCashMxn = this.calculateExpectedCash(Number(session.openingAmount), movements, 'MXN');
    const expectedCashUsd = this.calculateExpectedCash(Number(session.openingAmountUsd), movements, 'USD');
    const differenceMxn = roundMoney(dto.cashCounted - expectedCashMxn);
    const cashCountedUsd = roundMoney(dto.cashCountedUsd ?? 0);
    const differenceUsd = roundMoney(cashCountedUsd - expectedCashUsd);

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
        closedById: currentUserId ?? null,
        authorizedById: adminUser.id,
        closedAt: new Date(),
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, email: true } },
        closedBy: { select: { id: true, email: true } },
        authorizedBy: { select: { id: true, email: true } },
        movements: true,
      },
    });
  }

  /**
   * Verifica credenciales de un autorizador (admin): email + password + que
   * pertenezca al tenant y tenga el permiso requerido (SUPER_ADMIN lo omite).
   * Devuelve el usuario autorizador.
   */
  private async verifyAuthorizer(
    tenantId: string,
    authEmail: string,
    authPassword: string,
    requiredPermission: string,
  ) {
    const user = await this.prisma.user.findFirst({ where: { email: authEmail } });
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');

    const passwordValid = await bcrypt.compare(authPassword, user.password);
    if (!passwordValid) throw new UnauthorizedException('Credenciales incorrectas');

    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: user.id, tenantId },
    });
    if (!membership) {
      throw new UnauthorizedException('El usuario autorizador no pertenece a esta organización');
    }

    if (user.role !== 'SUPER_ADMIN') {
      const perms = await this.getEffectivePermissions(user.id, tenantId);
      if (!perms.includes(requiredPermission)) {
        throw new ForbiddenException('El usuario autorizador no tiene permiso para autorizar esta operación');
      }
    }

    return user;
  }

  /**
   * Retiro de efectivo de la caja para compra de insumos, con autorización de
   * administrador (mismo permiso que el cierre: pos.cash:close). Registra un
   * egreso (EXPENSE) y suma el stock comprado a cada insumo con su movimiento
   * de tipo PURCHASE. Todo en una transacción.
   */
  async withdrawForSupplies(dto: WithdrawForSuppliesDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId() ?? null;
    const branchId = this.tenantContext.getBranchId() ?? null;

    // 1. Autorización del administrador
    const authorizer = await this.verifyAuthorizer(
      tenantId,
      dto.authEmail,
      dto.authPassword,
      'pos.cash:close',
    );

    // 2. Debe existir sesión de caja abierta
    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
      include: { movements: true },
    });
    if (!session) {
      throw new BadRequestException('No hay sesión de caja activa. Abre la caja antes de retirar efectivo.');
    }

    // 3. Cargar y validar insumos
    const supplyIds = [...new Set(dto.items.map((i) => i.supplyId))];
    const supplies = await this.prisma.supply.findMany({
      where: { id: { in: supplyIds }, tenantId },
    });
    if (supplies.length !== supplyIds.length) {
      throw new NotFoundException('Uno o más insumos no existen');
    }
    const supplyMap = new Map(supplies.map((s) => [s.id, s]));

    const total = roundMoney(dto.items.reduce((sum, i) => sum + i.lineCost, 0));
    if (total <= 0) throw new BadRequestException('El monto del retiro debe ser mayor a 0');

    // 4. Validar efectivo disponible (MXN) en la caja
    const movements = session.movements as unknown as MovementLike[];
    const expectedCashMxn = this.calculateExpectedCash(Number(session.openingAmount), movements, 'MXN');
    if (total > expectedCashMxn) {
      throw new BadRequestException(
        `Efectivo insuficiente en caja. Disponible: $${expectedCashMxn.toFixed(2)}, retiro solicitado: $${total.toFixed(2)}`,
      );
    }

    // 5. Transacción: egreso + alta de stock de insumos
    return this.prisma.$transaction(async (tx) => {
      const cashMovement = await tx.cashMovement.create({
        data: {
          tenantId,
          cashSessionId: session.id,
          type: 'EXPENSE',
          currency: 'MXN',
          amount: total,
          paymentMethod: 'CASH',
          referenceType: 'SUPPLY_PURCHASE',
          notes: `Compra de insumos — autorizado por ${authorizer.email}${dto.notes ? ` — ${dto.notes}` : ''}`,
          createdById: userId,
        },
      });

      for (const line of dto.items) {
        const supply = supplyMap.get(line.supplyId)!;
        const convFactor = Number(supply.conversionFactor) || 1;
        // La cantidad se captura en la unidad de inventario; el stock se guarda en unidad base
        const quantityInBase = supply.baseUnitId
          ? convertToBaseUnit(line.quantity, convFactor)
          : line.quantity;

        await tx.supply.update({
          where: { id: supply.id },
          data: {
            stock: { increment: quantityInBase },
            updatedById: userId,
          },
        });

        await tx.supplyMovement.create({
          data: {
            tenantId,
            supplyId: supply.id,
            type: 'PURCHASE',
            quantity: quantityInBase,
            referenceId: cashMovement.id,
            notes: `Compra desde caja (${line.quantity} ${supply.unit}, $${roundMoney(line.lineCost).toFixed(2)})`,
            ...(branchId && { branchId }),
            ...(userId && { createdById: userId }),
          },
        });
      }

      return { cashMovement, total, itemsCount: dto.items.length };
    });
  }

  private async getEffectivePermissions(userId: string, tenantId: string): Promise<string[]> {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const keys = new Set<string>();
    for (const a of assignments) {
      for (const rp of a.role.permissions) keys.add(rp.permission.key);
    }

    const grants = await this.prisma.userPermissionGrant.findMany({
      where: { userId, tenantId },
      include: { permission: true },
    });
    for (const g of grants) {
      if (g.granted) keys.add(g.permission.key);
      else keys.delete(g.permission.key);
    }

    return Array.from(keys);
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
