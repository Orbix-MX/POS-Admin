/**
 * `/cash-sessions` — el ciclo del turno: abrir, mover dinero, arquear, cortar.
 *
 * Único lugar que conoce estas rutas. Mapea DTO → modelo de dominio, y en
 * particular normaliza los `Decimal` que llegan como string.
 *
 * El `summary` que devuelve el servidor se conserva tal cual: es la única
 * fuente de verdad de las cifras del turno. El cliente no recalcula dinero.
 */
import type {
  AuthorizePinRequest,
  CashCountDto,
  CashHandoverDto,
  CashMovementDto,
  CashRegisterDto,
  CashSessionCapacityDto,
  CashSessionDto,
  CashSessionListItemDto,
  CashSessionSummaryDto,
  CloseCashSessionRequest,
  CreateCashCountRequest,
  CreateCashRegisterRequest,
  CreateManualMovementRequest,
  OpenCashSessionRequest,
  QueryCashSessionsParams,
  UpdateCashRegisterRequest,
  WithdrawCashRequest,
} from '@/dto/cash.dto';
import type { PaginatedDto } from '@/dto/products.dto';
import { http } from '@/services/api';
import type {
  CashCountType,
  CashMovementType,
  CashSessionStatus,
} from '@/types/api';

/* ── Modelos de dominio ──────────────────────────────────────────────────── */

export interface CashRegister {
  id: string;
  name: string;
  branchId: string | null;
  isActive: boolean;
  /** La sesión viva de esta caja, si la tiene. `null` = caja libre. */
  liveSession: {
    id: string;
    status: CashSessionStatus;
    openedAt: string;
    openedByEmail: string | null;
  } | null;
}

export interface CashSessionCapacity {
  /** `null` = sin tope. */
  maxSessions: number | null;
  openSessions: number;
  hasCapacity: boolean;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  currency: string;
  amount: number;
  /** Equivalente en MXN de un movimiento en USD; igual a `amount` si ya es MXN. */
  amountMxn: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
}

/** Un tramo de custodia de la caja. Ver `CashHandoverDto`. */
export interface CashHandover {
  id: string;
  userId: string | null;
  name: string;
  enteredAt: string;
  /** `null` = seguía dentro. No es una hora de salida omitida. */
  leftAt: string | null;
}

export interface CashCount {
  id: string;
  type: CashCountType;
  countedMxn: number;
  countedUsd: number;
  expectedMxn: number;
  expectedUsd: number;
  differenceMxn: number;
  differenceUsd: number;
  denominations: Record<string, number> | null;
  reason: string | null;
  createdAt: string;
}

/** Totales del turno, calculados por el servidor. Ver `CashSessionSummaryDto`. */
export type CashSessionSummary = CashSessionSummaryDto;

export interface CashSession {
  id: string;
  status: CashSessionStatus;
  branchId: string | null;
  cashRegisterId: string | null;
  /** Fijado al abrir y congelado para toda la sesión: el cierre calcula contra él. */
  exchangeRateUsdMxn: number;
  openingAmount: number;
  openingAmountUsd: number;
  /** Solo tras el cierre. */
  expectedAmount: number | null;
  cashCounted: number | null;
  cashCountedUsd: number | null;
  difference: number | null;
  differenceUsd: number | null;
  differenceReason: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  openedByEmail: string | null;
  closedByEmail: string | null;
  branchName: string | null;
  movements: CashMovement[];
  /** Ausente en el listado; presente en `active`, el detalle y la apertura. */
  summary: CashSessionSummary | null;
}

/** Fila del historial. Sin movimientos ni summary — la lista no los necesita. */
export interface CashSessionListItem {
  id: string;
  status: CashSessionStatus;
  branchId: string | null;
  branchName: string | null;
  openingAmount: number;
  expectedAmount: number | null;
  cashCounted: number | null;
  difference: number | null;
  openedAt: string;
  closedAt: string | null;
  openedByEmail: string | null;
  closedByEmail: string | null;
  movementsCount: number;
}

export interface CashSessionListResult {
  sessions: CashSessionListItem[];
  meta: PaginatedDto<CashSessionListItemDto>['meta'];
}

/* ── Normalización ───────────────────────────────────────────────────────── */

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Igual que `toNumber` pero conserva la ausencia: un corte sin cerrar no tiene diferencia. */
function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toMovement(dto: CashMovementDto): CashMovement {
  const amount = toNumber(dto.amount);
  return {
    id: dto.id,
    type: dto.type,
    currency: dto.currency,
    amount,
    // El servidor solo llena `amountMxnEquivalent` en los movimientos en USD.
    amountMxn: dto.amountMxnEquivalent != null ? toNumber(dto.amountMxnEquivalent) : amount,
    paymentMethod: dto.paymentMethod,
    notes: dto.notes,
    createdAt: dto.createdAt,
  };
}

/** Nombre legible de quien tomó la caja, con el correo como respaldo. */
function toHandover(dto: CashHandoverDto): CashHandover {
  const full = `${dto.user?.firstName ?? ''} ${dto.user?.lastName ?? ''}`.trim();
  return {
    id: dto.id,
    userId: dto.userId,
    name: full || dto.user?.email || 'Sin usuario',
    enteredAt: dto.enteredAt,
    leftAt: dto.leftAt,
  };
}

function toCount(dto: CashCountDto): CashCount {
  return {
    id: dto.id,
    type: dto.type,
    countedMxn: toNumber(dto.countedMxn),
    countedUsd: toNumber(dto.countedUsd),
    expectedMxn: toNumber(dto.expectedMxn),
    expectedUsd: toNumber(dto.expectedUsd),
    differenceMxn: toNumber(dto.differenceMxn),
    differenceUsd: toNumber(dto.differenceUsd),
    denominations: dto.denominations,
    reason: dto.reason,
    createdAt: dto.createdAt,
  };
}

function toSession(dto: CashSessionDto): CashSession {
  return {
    id: dto.id,
    status: dto.status,
    branchId: dto.branchId,
    cashRegisterId: dto.cashRegisterId ?? null,
    exchangeRateUsdMxn: toNumber(dto.exchangeRateUsdMxn),
    openingAmount: toNumber(dto.openingAmount),
    openingAmountUsd: toNumber(dto.openingAmountUsd),
    expectedAmount: toNullableNumber(dto.expectedAmount),
    cashCounted: toNullableNumber(dto.cashCounted),
    cashCountedUsd: toNullableNumber(dto.cashCountedUsd),
    difference: toNullableNumber(dto.difference),
    differenceUsd: toNullableNumber(dto.differenceUsd),
    differenceReason: dto.differenceReason ?? null,
    notes: dto.notes ?? null,
    openedAt: dto.openedAt,
    closedAt: dto.closedAt ?? null,
    openedByEmail: dto.openedBy?.email ?? null,
    closedByEmail: dto.closedBy?.email ?? null,
    branchName: dto.branch?.name ?? null,
    movements: (dto.movements ?? []).map(toMovement),
    summary: dto.summary ?? null,
  };
}

function toListItem(dto: CashSessionListItemDto): CashSessionListItem {
  return {
    id: dto.id,
    status: dto.status,
    branchId: dto.branchId,
    branchName: dto.branch?.name ?? null,
    openingAmount: toNumber(dto.openingAmount),
    expectedAmount: toNullableNumber(dto.expectedAmount),
    cashCounted: toNullableNumber(dto.cashCounted),
    difference: toNullableNumber(dto.difference),
    openedAt: dto.openedAt,
    closedAt: dto.closedAt ?? null,
    openedByEmail: dto.openedBy?.email ?? null,
    closedByEmail: dto.closedBy?.email ?? null,
    movementsCount: dto._count?.movements ?? 0,
  };
}

function toRegister(dto: CashRegisterDto): CashRegister {
  const live = dto.sessions?.[0];
  return {
    id: dto.id,
    name: dto.name,
    branchId: dto.branchId,
    isActive: dto.isActive,
    liveSession: live
      ? {
          id: live.id,
          status: live.status,
          openedAt: live.openedAt,
          openedByEmail: live.openedBy?.email ?? null,
        }
      : null,
  };
}

/**
 * Los mapeos, expuestos solo para su prueba. No los importa la app: quien
 * necesite un modelo de dominio lo pide al repositorio, que es lo que mantiene
 * el conocimiento de las rutas en un solo sitio.
 */
export const __test = {
  toSession,
  toListItem,
  toRegister,
  toMovement,
  toCount,
  toHandover,
} as const;

/* ── Repositorios ────────────────────────────────────────────────────────── */

export const cashSessionsRepository = {
  /**
   * La sesión viva de la caja. El backend devuelve `{}` —no `null`— cuando no
   * hay ninguna, así que el discriminante es `id`.
   *
   * Con `cashRegisterId` resuelve por caja física; sin él, devuelve la única
   * viva de la sucursal, o la que abrió el propio usuario si hay varias.
   */
  async getActive(params?: { branchId?: string; cashRegisterId?: string }): Promise<CashSession | null> {
    const dto = await http.get<Partial<CashSessionDto>>('/cash-sessions/active', { params });
    if (!dto.id) return null;
    return toSession(dto as CashSessionDto);
  },

  async getById(id: string): Promise<CashSession> {
    return toSession(await http.get<CashSessionDto>(`/cash-sessions/${id}`));
  },

  async list(params: QueryCashSessionsParams): Promise<CashSessionListResult> {
    const dto = await http.get<PaginatedDto<CashSessionListItemDto>>('/cash-sessions', { params });
    return { sessions: dto.data.map(toListItem), meta: dto.meta };
  },

  async open(request: OpenCashSessionRequest): Promise<CashSession> {
    return toSession(await http.post<CashSessionDto>('/cash-sessions', request));
  },

  /**
   * Corte. Puede resolver en `CERRADA` o en `PENDIENTE_REVISION` —cuando la
   * diferencia supera el umbral del tenant—, así que quien llame **debe** mirar
   * el `status` devuelto en vez de asumir que un 200 cerró el turno.
   */
  async close(id: string, request: CloseCashSessionRequest): Promise<CashSession> {
    return toSession(await http.patch<CashSessionDto>(`/cash-sessions/${id}/close`, request));
  },

  /** `ABIERTA → EN_ARQUEO`. Congela la caja: ningún movimiento entra mientras dure. */
  async startCount(id: string, request: AuthorizePinRequest = {}): Promise<CashSession> {
    return toSession(await http.patch<CashSessionDto>(`/cash-sessions/${id}/start-count`, request));
  },

  /** `EN_ARQUEO → ABIERTA`. Cierra el paréntesis de un arqueo de control. */
  async resume(id: string, request: AuthorizePinRequest = {}): Promise<CashSession> {
    return toSession(await http.patch<CashSessionDto>(`/cash-sessions/${id}/resume`, request));
  },

  async createCount(request: CreateCashCountRequest): Promise<CashCount> {
    return toCount(await http.post<CashCountDto>('/cash-sessions/active/count', request));
  },

  async listCounts(sessionId: string): Promise<CashCount[]> {
    const dto = await http.get<CashCountDto[]>(`/cash-sessions/${sessionId}/counts`);
    return dto.map(toCount);
  },

  /**
   * Deja constancia de que este usuario tomó la caja abierta.
   *
   * Se llama al entrar, no al abrir: el caso que registra es el **relevo de
   * turno**, donde la caja ya estaba abierta por otra persona. El servidor es
   * idempotente, así que reabrir la app no duplica el tramo.
   */
  async registerHandover(cashSessionId?: string): Promise<void> {
    await http.post('/cash-sessions/active/handover', { cashSessionId });
  },

  /** Quién estuvo en la caja durante la sesión, en orden de entrada. */
  async listHandovers(sessionId: string): Promise<CashHandover[]> {
    const dto = await http.get<CashHandoverDto[]>(`/cash-sessions/${sessionId}/handovers`);
    return dto.map(toHandover);
  },
} as const;

export const cashMovementsRepository = {
  /** Ingreso o egreso manual sobre la sesión abierta. Requiere `cash:manage`. */
  async createManual(request: CreateManualMovementRequest): Promise<CashMovement> {
    return toMovement(await http.post<CashMovementDto>('/cash-sessions/active/movement', request));
  },

  /**
   * Retiro del cajón hacia la caja fuerte o el banco. Requiere
   * `pos.cash:withdraw`, `reason` obligatorio, y el servidor lo rechaza si
   * excede el efectivo disponible de esa divisa.
   */
  async withdraw(request: WithdrawCashRequest): Promise<CashMovement> {
    return toMovement(await http.post<CashMovementDto>('/cash-sessions/active/withdraw', request));
  },
} as const;

export const cashRegistersRepository = {
  /** Cajas activas de la sucursal en contexto, con su sesión viva si la tienen. */
  async list(): Promise<CashRegister[]> {
    const dto = await http.get<CashRegisterDto[]>('/cash-sessions/registers');
    return dto.map(toRegister);
  },

  async capacity(): Promise<CashSessionCapacity> {
    const dto = await http.get<CashSessionCapacityDto>('/cash-sessions/registers/capacity');
    return {
      maxSessions: dto.maxSessions,
      openSessions: dto.openSessions,
      hasCapacity: dto.hasCapacity,
    };
  },

  async create(request: CreateCashRegisterRequest): Promise<CashRegister> {
    return toRegister(await http.post<CashRegisterDto>('/cash-sessions/registers', request));
  },

  async update(id: string, request: UpdateCashRegisterRequest): Promise<CashRegister> {
    return toRegister(await http.patch<CashRegisterDto>(`/cash-sessions/registers/${id}`, request));
  },
} as const;
