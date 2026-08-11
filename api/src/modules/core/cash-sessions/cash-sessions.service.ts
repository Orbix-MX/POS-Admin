import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Prisma, type CashSessionStatus } from '@prisma/client';
import { OpenCashSessionDto } from './dto/open-session.dto';
import { CloseCashSessionDto } from './dto/close-session.dto';
import { CloseWithAuthDto } from './dto/close-with-auth.dto';
import { QueryCashSessionsDto } from './dto/query-sessions.dto';
import { WithdrawForSuppliesDto } from './dto/withdraw-supplies.dto';
import { CreateCashCountDto } from './dto/create-count.dto';
import { WithdrawCashDto } from './dto/withdraw-cash.dto';
import { roundMoney } from '../../../common/utils/money.util';
import { convertToBaseUnit } from '../../../common/helpers/unit-conversion';
import { requireOpenSession } from '../../../common/helpers/cash-session.helper';
import { AuditService } from '../../../common/services/audit.service';

const CASH_INCOME_TYPES = ['SALE', 'CXC_PAYMENT', 'INCOME'] as const;
const CASH_EXPENSE_TYPES = ['SUPPLIER_PAYMENT', 'EXPENSE', 'WITHDRAWAL', 'REFUND'] as const;

// Nombre del índice único parcial (una sesión ABIERTA por tenant+sucursal) —
// para traducir la violación P2002 a un mensaje de negocio claro.
const OPEN_SESSION_UNIQUE_INDEX = 'cash_sessions_one_open_per_register_key';

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
    private audit: AuditService,
  ) {}

  async open(dto: OpenCashSessionDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    const branchId = dto.branchId ?? this.tenantContext.getBranchId() ?? null;

    const cashRegisterId = await this.resolveCashRegister(tenantId, branchId, dto.cashRegisterId);

    // Pre-chequeo amigable. No es la garantía: dos operadores concurrentes pueden
    // cruzarlo antes de insertar. La garantía real es el índice único parcial (una
    // sesión viva por caja física); su violación P2002 se traduce abajo. Check +
    // índice = mensaje claro y cero duplicados.
    const existing = await this.prisma.cashSession.findFirst({
      where: { tenantId, cashRegisterId, status: { not: 'CERRADA' } },
    });
    if (existing) {
      throw new BadRequestException('Ya existe una sesión de caja abierta para esta caja');
    }

    try {
      // Apertura transaccional: el insert es la operación atómica que compite por
      // el índice único. Si dos requests llegan a la vez, solo uno persiste.
      const created = await this.prisma.$transaction((tx) =>
        tx.cashSession.create({
          data: {
            tenantId,
            branchId,
            cashRegisterId,
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
        }),
      );

      // Fuera de la transacción a propósito: la bitácora es best-effort y no debe
      // poder tumbar la apertura (CASH-004).
      await this.audit.log({
        action: 'CASH_SESSION_OPEN',
        entityType: 'CashSession',
        entityId: created.id,
        after: {
          branchId,
          openingAmount: Number(created.openingAmount),
          openingAmountUsd: Number(created.openingAmountUsd),
          exchangeRateUsdMxn: Number(created.exchangeRateUsdMxn),
        },
        reason: dto.notes ?? undefined,
      });

      return created;
    } catch (e) {
      // P2002 sobre el índice parcial = otro operador ganó la carrera y ya abrió
      // la sesión de esta sucursal. Se reporta como conflicto de negocio.
      if (this.isOpenSessionUniqueViolation(e)) {
        throw new BadRequestException('Ya existe una sesión de caja abierta para esta caja');
      }
      throw e;
    }
  }

  /**
   * True cuando el error es una violación del índice único parcial que protege
   * "una sola sesión ABIERTA por tenant+sucursal" (Prisma P2002). Como el índice
   * es por expresión (COALESCE), el target puede no traer columnas: ante un P2002
   * en este flujo se asume dicho índice (es la única restricción única posible).
   */
  private isOpenSessionUniqueViolation(e: unknown): boolean {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') {
      return false;
    }
    const target = e.meta?.target;
    if (typeof target === 'string') return target.includes(OPEN_SESSION_UNIQUE_INDEX);
    if (Array.isArray(target)) return target.includes(OPEN_SESSION_UNIQUE_INDEX);
    return true;
  }

  async close(id: string, dto: CloseCashSessionDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    return this.closeSessionAtomically(id, tenantId, userId, dto, null);
  }

  /**
   * Cierra la sesión en una sola transacción, en tres pasos deliberados:
   *
   *   1. *Reclamar* la sesión con un update condicionado a `status: ABIERTA`.
   *      Es la operación atómica: dos cierres simultáneos compiten aquí y solo
   *      uno afecta filas. Antes el estado se leía y se actualizaba por
   *      separado, así que ambos pasaban el check y el último sobrescribía la
   *      diferencia del primero (CASH-002).
   *   2. Recién entonces leer los movimientos y calcular. Reclamar primero
   *      cierra la ventana por la que un movimiento podía insertarse después
   *      del cálculo y quedar fuera del corte: con la sesión ya en CERRADA,
   *      `assertSessionOpen` rechaza cualquier inserción posterior (CASH-003).
   *   3. Persistir el arqueo sobre la sesión ya reclamada.
   */
  private async closeSessionAtomically(
    id: string,
    tenantId: string,
    closedById: string | null | undefined,
    dto: CloseCashSessionDto,
    authorizedById: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Reclamo atómico a PENDIENTE_REVISION, no directo a CERRADA: el estado
      // final depende de la diferencia, que todavía no se conoce. Reclamar a un
      // estado no operativo congela la caja igual (ningún movimiento entra si no
      // está ABIERTA) y deja decidir después si hace falta autorización.
      //
      // `closeWithAuth` también admite reclamar una sesión ya en revisión: es la
      // vía por la que un autorizador finaliza lo que el cajero dejó parado.
      const claimableStates: CashSessionStatus[] = authorizedById != null
        ? ['ABIERTA', 'EN_ARQUEO', 'PENDIENTE_REVISION']
        : ['ABIERTA', 'EN_ARQUEO'];

      const claimed = await tx.cashSession.updateMany({
        where: { id, tenantId, status: { in: claimableStates } },
        data: { status: 'PENDIENTE_REVISION' },
      });

      if (claimed.count === 0) {
        // O no existe, o alguien más la reclamó primero. Se distingue para que el
        // operador sepa si debe recargar o si simplemente llegó tarde.
        const exists = await tx.cashSession.findFirst({
          where: { id, tenantId },
          select: { id: true, status: true },
        });
        if (!exists) throw new NotFoundException('Sesión de caja no encontrada');
        if (exists.status === 'PENDIENTE_REVISION') {
          throw new BadRequestException(
            'El corte está pendiente de revisión: requiere autorización para cerrarse',
          );
        }
        throw new BadRequestException('Esta sesión ya está cerrada');
      }

      const session = await tx.cashSession.findFirstOrThrow({
        where: { id, tenantId },
        include: { movements: true },
      });
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

      // Umbral server-side: cerrar descuadrado exige explicación. Antes se podía
      // cerrar con cualquier diferencia y sin motivo (CASH-006).
      await this.assertDifferenceJustified(tx, tenantId, differenceMxn, differenceUsd, dto.differenceReason);

      // Una diferencia por encima del umbral no cierra sola: queda en revisión
      // hasta que un autorizador la finalice (CASH-011). Sin diferencia
      // reportable, o ya autorizada, se cierra en el acto.
      const needsReview =
        authorizedById == null &&
        (await this.exceedsThreshold(tx, tenantId, differenceMxn, differenceUsd));
      const finalStatus: CashSessionStatus = needsReview ? 'PENDIENTE_REVISION' : 'CERRADA';

      // El cierre deja su arqueo FINAL como evidencia releíble, con el esperado
      // congelado al momento del conteo.
      await tx.cashCount.create({
        data: {
          tenantId,
          cashSessionId: id,
          type: 'FINAL',
          countedMxn: dto.cashCounted,
          countedUsd: cashCountedUsd,
          expectedMxn: expectedCashMxn,
          expectedUsd: expectedCashUsd,
          differenceMxn,
          differenceUsd,
          reason: dto.differenceReason ?? null,
          countedById: closedById ?? null,
          authorizedById,
        },
      });

      // Dentro de la transacción: el corte y su bitácora se persisten juntos o
      // ninguno. Es el único registro que explica una diferencia (CASH-004).
      await this.audit.log(
        {
          action: 'CASH_SESSION_CLOSE',
          entityType: 'CashSession',
          entityId: id,
          before: { expectedCashMxn, expectedCashUsd, movementsCount: movements.length },
          after: {
            cashCounted: dto.cashCounted,
            cashCountedUsd,
            differenceMxn,
            differenceUsd,
            authorizedById,
          },
          reason: dto.differenceReason ?? dto.notes ?? undefined,
        },
        tx,
      );

      return tx.cashSession.update({
        where: { id },
        data: {
          status: finalStatus,
          ...(finalStatus === 'CERRADA' && {
            closedById: closedById ?? null,
            closedAt: new Date(),
          }),
          ...(authorizedById != null && { authorizedById }),
          expectedAmount: expectedCashMxn,
          cashCounted: dto.cashCounted,
          cashCountedUsd,
          difference: differenceMxn,
          differenceUsd,
          differenceReason: dto.differenceReason ?? null,
          // Fondo que permanece físicamente tras los retiros de la sesión. Es lo
          // que debería encontrar quien abra la caja siguiente (CASH-005).
          remainingFund: dto.cashCounted,
          remainingFundUsd: cashCountedUsd,
          notes: dto.notes ?? session.notes,
        },
        include: {
          branch: { select: { id: true, name: true } },
          openedBy: { select: { id: true, email: true } },
          closedBy: { select: { id: true, email: true } },
          authorizedBy: { select: { id: true, email: true } },
          movements: true,
        },
      });
    });
  }

  /**
   * La sesión viva de la sucursal, esté operando o en medio del corte.
   *
   * Filtra por "no cerrada" y no por ABIERTA: con los estados intermedios, una
   * caja EN_ARQUEO o PENDIENTE_REVISION seguía existiendo pero desaparecía de la
   * pantalla, y el operador no tenía desde dónde reanudarla ni cerrarla
   * (CASH-011). Para *registrar movimientos* la regla sigue siendo ABIERTA:
   * eso lo decide `requireOpenSession`, no esta consulta.
   */
  async getActive(branchId?: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId, branchId: branchId ?? undefined, status: { not: 'CERRADA' } },
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
    const branchId = this.tenantContext.getBranchId() ?? null;

    // La sesión debe ser la de la sucursal del operador. Sin el filtro branchId, un
    // movimiento manual caía en cualquier sesión abierta del tenant (cruce entre
    // sucursales). Con branch null (token sin sucursal) Prisma ignora el filtro y se
    // conserva el comportamiento previo.
    //
    // Sin sesión abierta ahora se rechaza. Antes el movimiento se guardaba con
    // `cashSessionId: null` y el dinero no aparecía en ningún corte (CASH-001).
    const activeSession = await requireOpenSession(this.prisma, tenantId, branchId);

    // Un egreso saca dinero del cajón: sin motivo no hay forma de explicarlo
    // después. El ingreso puede quedar sin él (CASH-012).
    if (dto.type === 'EXPENSE' && !dto.reason?.trim()) {
      throw new BadRequestException('Un egreso de caja requiere motivo.');
    }

    const currency = dto.currency ?? 'MXN';
    const notesParts = [dto.reason, dto.notes].filter(Boolean);
    const notes = notesParts.length > 0 ? notesParts.join(' — ') : null;

    const movement = await this.prisma.cashMovement.create({
      data: {
        tenantId,
        cashSessionId: activeSession.id,
        type: dto.type,
        currency,
        amount: dto.amount,
        paymentMethod: 'CASH',
        notes,
        createdById: userId ?? null,
      },
    });

    await this.audit.log({
      action: 'CASH_MOVEMENT_CREATE',
      entityType: 'CashMovement',
      entityId: movement.id,
      after: { type: dto.type, amount: dto.amount, currency, cashSessionId: activeSession.id },
      reason: dto.reason ?? undefined,
    });

    return movement;
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

    // Mismo cierre atómico que `close()`, más el autorizador.
    return this.closeSessionAtomically(id, tenantId, currentUserId, dto, adminUser.id);
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

  /**
   * Arqueo con la caja abierta: cuenta el efectivo, congela el esperado del
   * momento y registra la diferencia sin cerrar nada. Es lo que permite un corte
   * por turno o un recuento tras un descuadre (CASH-006).
   */
  async createCount(dto: CreateCashCountDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    const active = await requireOpenSession(
      this.prisma,
      tenantId,
      branchId,
      'No hay sesión de caja activa. Abre la caja antes de registrar un arqueo.',
    );

    const session = await this.prisma.cashSession.findFirstOrThrow({
      where: { id: active.id, tenantId },
      include: { movements: true },
    });
    const movements = session.movements as unknown as MovementLike[];

    const expectedMxn = this.calculateExpectedCash(Number(session.openingAmount), movements, 'MXN');
    const expectedUsd = this.calculateExpectedCash(Number(session.openingAmountUsd), movements, 'USD');
    const countedUsd = roundMoney(dto.countedUsd ?? 0);
    const differenceMxn = roundMoney(dto.countedMxn - expectedMxn);
    const differenceUsd = roundMoney(countedUsd - expectedUsd);

    const count = await this.prisma.cashCount.create({
      data: {
        tenantId,
        cashSessionId: session.id,
        type: dto.type ?? 'PARCIAL',
        countedMxn: dto.countedMxn,
        countedUsd,
        expectedMxn,
        expectedUsd,
        differenceMxn,
        differenceUsd,
        denominations: dto.denominations ?? Prisma.JsonNull,
        reason: dto.reason ?? null,
        countedById: userId ?? null,
      },
    });

    await this.audit.log({
      action: 'CASH_COUNT',
      entityType: 'CashCount',
      entityId: count.id,
      before: { expectedMxn, expectedUsd },
      after: { countedMxn: dto.countedMxn, countedUsd, differenceMxn, differenceUsd },
      reason: dto.reason ?? undefined,
    });

    return count;
  }

  /**
   * Retiro de efectivo del cajón. Baja el esperado y queda en bitácora.
   *
   * Se valida contra el efectivo disponible: retirar más de lo que hay dejaría
   * el esperado en negativo, que no es un estado físico posible.
   */
  async withdrawCash(dto: WithdrawCashDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    const active = await requireOpenSession(
      this.prisma,
      tenantId,
      branchId,
      'No hay sesión de caja activa. Abre la caja antes de retirar efectivo.',
    );

    const session = await this.prisma.cashSession.findFirstOrThrow({
      where: { id: active.id, tenantId },
      include: { movements: true },
    });
    const movements = session.movements as unknown as MovementLike[];
    const currency = dto.currency ?? 'MXN';
    const opening = currency === 'USD' ? Number(session.openingAmountUsd) : Number(session.openingAmount);
    const available = this.calculateExpectedCash(opening, movements, currency);

    if (dto.amount > available) {
      throw new BadRequestException(
        `El retiro (${dto.amount} ${currency}) excede el efectivo disponible (${available} ${currency}).`,
      );
    }

    const movement = await this.prisma.cashMovement.create({
      data: {
        tenantId,
        cashSessionId: session.id,
        type: 'WITHDRAWAL',
        currency,
        amount: dto.amount,
        ...(currency === 'USD' && {
          exchangeRateUsed: session.exchangeRateUsdMxn,
          amountOriginalCurrency: dto.amount,
          amountMxnEquivalent: roundMoney(dto.amount * Number(session.exchangeRateUsdMxn)),
        }),
        paymentMethod: 'CASH',
        referenceType: 'WITHDRAWAL',
        notes: dto.reason,
        createdById: userId ?? null,
      },
    });

    await this.audit.log({
      action: 'CASH_WITHDRAWAL',
      entityType: 'CashMovement',
      entityId: movement.id,
      before: { availableBefore: available },
      after: { amount: dto.amount, currency, availableAfter: roundMoney(available - dto.amount) },
      reason: dto.reason,
    });

    return movement;
  }

  /**
   * ABIERTA → EN_ARQUEO. Congela la caja para contar: mientras no esté ABIERTA
   * ningún movimiento entra, así que el efectivo contado no se mueve bajo los
   * pies del cajero (CASH-011).
   */
  async startCount(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.transition(id, tenantId, ['ABIERTA'], 'EN_ARQUEO', 'CASH_COUNT_START');
  }

  /**
   * EN_ARQUEO → ABIERTA. Devuelve la caja a operación cuando el arqueo fue de
   * control y no termina en cierre.
   */
  async resumeOperation(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.transition(id, tenantId, ['EN_ARQUEO'], 'ABIERTA', 'CASH_COUNT_RESUME');
  }

  /** Cambio de estado atómico: el `where` filtra por los orígenes admitidos. */
  private async transition(
    id: string,
    tenantId: string,
    from: CashSessionStatus[],
    to: CashSessionStatus,
    action: 'CASH_COUNT_START' | 'CASH_COUNT_RESUME',
  ) {
    const moved = await this.prisma.cashSession.updateMany({
      where: { id, tenantId, status: { in: from } },
      data: { status: to },
    });

    if (moved.count === 0) {
      const current = await this.prisma.cashSession.findFirst({
        where: { id, tenantId },
        select: { status: true },
      });
      if (!current) throw new NotFoundException('Sesión de caja no encontrada');
      throw new BadRequestException(
        `No se puede pasar a ${to} desde ${current.status}.`,
      );
    }

    await this.audit.log({
      action,
      entityType: 'CashSession',
      entityId: id,
      before: { status: from.join('|') },
      after: { status: to },
    });

    return this.prisma.cashSession.findFirstOrThrow({ where: { id, tenantId } });
  }

  /** Arqueos de una sesión, del más reciente al más antiguo. */
  async listCounts(sessionId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.cashCount.findMany({
      where: { tenantId, cashSessionId: sessionId },
      orderBy: { createdAt: 'desc' },
      include: { countedBy: { select: { id: true, email: true } } },
    });
  }

  /** Cajas físicas de la sucursal (o del tenant si no hay sucursal en el token). */
  async listRegisters() {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;
    return this.prisma.cashRegister.findMany({
      where: { tenantId, ...(branchId != null && { branchId }), isActive: true },
      orderBy: { name: 'asc' },
      include: {
        sessions: {
          where: { status: { not: 'CERRADA' } },
          select: { id: true, status: true, openedAt: true, openedBy: { select: { email: true } } },
          take: 1,
        },
      },
    });
  }

  // ---- helpers ----

  /**
   * Resuelve la caja física en la que se abre la sesión.
   *
   * Sin `cashRegisterId` explícito toma la primera activa de la sucursal, que es
   * el comportamiento de una instalación de caja única; si la sucursal todavía no
   * tiene ninguna, se crea "Caja 1" para no obligar a un alta manual antes de la
   * primera venta.
   */
  private async resolveCashRegister(
    tenantId: string,
    branchId: string | null,
    requestedId?: string,
  ): Promise<string> {
    if (requestedId) {
      const found = await this.prisma.cashRegister.findFirst({
        where: { id: requestedId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!found) throw new NotFoundException('Caja no encontrada');
      return found.id;
    }

    const existing = await this.prisma.cashRegister.findFirst({
      where: { tenantId, branchId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.cashRegister.create({
      data: { tenantId, branchId, name: 'Caja 1' },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Exige motivo cuando la diferencia supera el umbral del tenant.
   *
   * `settings.cashDifferenceThreshold` en MXN; ausente equivale a 0, es decir
   * que cualquier descuadre debe explicarse. El USD se compara contra su propio
   * valor sin convertir: una diferencia en dólares es tan reportable como una en
   * pesos y convertirla escondería descuadres pequeños en moneda fuerte.
   */
  private async assertDifferenceJustified(
    tx: Prisma.TransactionClient,
    tenantId: string,
    differenceMxn: number,
    differenceUsd: number,
    reason?: string,
  ): Promise<void> {
    if (reason?.trim()) return;
    if (await this.exceedsThreshold(tx, tenantId, differenceMxn, differenceUsd)) {
      throw new BadRequestException(
        `La diferencia del corte (${differenceMxn} MXN / ${differenceUsd} USD) requiere un motivo.`,
      );
    }
  }

  /**
   * True cuando la diferencia supera el umbral del tenant.
   *
   * `settings.cashDifferenceThreshold` en MXN; ausente equivale a 0, es decir que
   * cualquier descuadre es reportable. El USD se compara contra su propio valor
   * sin convertir: convertirlo escondería descuadres pequeños en moneda fuerte.
   */
  private async exceedsThreshold(
    tx: Prisma.TransactionClient,
    tenantId: string,
    differenceMxn: number,
    differenceUsd: number,
  ): Promise<boolean> {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const threshold = Math.abs(Number(settings.cashDifferenceThreshold ?? 0)) || 0;
    return Math.abs(differenceMxn) > threshold || Math.abs(differenceUsd) > threshold;
  }

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
      // Fila propia: un retiro no es un gasto del negocio, es efectivo que sale
      // del cajón hacia la caja fuerte (CASH-005).
      withdrawal: { cash: 0, cashUsd: 0, total: 0 },
      // Un reembolso tampoco es un gasto: es dinero que vuelve al cliente. Antes
      // se tipaba EXPENSE y el corte lo mostraba como egreso manual (CASH-013).
      refund: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
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
          } else if (method === 'CARD') totals.sales.card += amtMxn;
          else if (method === 'TRANSFER') totals.sales.transfer += amtMxn;
          break;
        case 'CXC_PAYMENT':
          totals.cxc.total += isUsd ? amtMxn : amt;
          if (method === 'CASH') {
            if (isUsd) totals.cxc.cashUsd += amt;
            else totals.cxc.cash += amt;
          } else if (method === 'CARD') totals.cxc.card += amtMxn;
          else if (method === 'TRANSFER') totals.cxc.transfer += amtMxn;
          break;
        case 'SUPPLIER_PAYMENT':
          totals.supplier.total += isUsd ? amtMxn : amt;
          if (method === 'CASH') {
            if (isUsd) totals.supplier.cashUsd += amt;
            else totals.supplier.cash += amt;
          } else if (method === 'CARD') totals.supplier.card += amtMxn;
          else if (method === 'TRANSFER') totals.supplier.transfer += amtMxn;
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
        case 'WITHDRAWAL':
          totals.withdrawal.total += isUsd ? amtMxn : amt;
          if (isUsd) totals.withdrawal.cashUsd += amt;
          else totals.withdrawal.cash += amt;
          break;
        case 'REFUND':
          totals.refund.total += isUsd ? amtMxn : amt;
          if (method === 'CASH') {
            if (isUsd) totals.refund.cashUsd += amt;
            else totals.refund.cash += amt;
          } else if (method === 'CARD') totals.refund.card += amtMxn;
          else if (method === 'TRANSFER') totals.refund.transfer += amtMxn;
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
