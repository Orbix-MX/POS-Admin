/**
 * Shapes for `/cash-sessions` — apertura, movimientos, arqueo y corte.
 *
 * Tomadas de `api/src/modules/core/cash-sessions`. Los `Decimal` de Prisma
 * serialisan como string sobre JSON, misma razón que en `ProductDto`.
 *
 * Cuatro de estas rutas —`start-count`, `resume`, `active/count` y `close`— NO
 * llevan `@RequirePermissions`: resuelven la autorización dentro del servicio,
 * con el permiso propio del usuario **o** el PIN de un empleado que lo tenga.
 * De ahí el `authorizerPin` opcional en sus requests: se manda solo tras un
 * `AUTHORIZATION_REQUIRED`, nunca por adelantado.
 */
import type {
  CashCountType,
  CashCurrency,
  CashMovementType,
  CashSessionStatus,
} from '@/types/api';

/* ── Caja física ─────────────────────────────────────────────────────────── */

/**
 * `GET /cash-sessions/registers` — las cajas activas de la sucursal en
 * contexto, cada una con su sesión viva si la tiene (`take: 1`; el índice único
 * garantiza que no haya más de una).
 */
export interface CashRegisterDto {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Solo lo incluye el listado. `POST`/`PATCH /registers` devuelven la fila
   * pelada, sin relaciones — de ahí que sea opcional.
   */
  sessions?: {
    id: string;
    status: CashSessionStatus;
    openedAt: string;
    openedBy: { email: string } | null;
  }[];
}

/**
 * `GET /cash-sessions/registers/capacity` — tope de sesiones simultáneas.
 *
 * Se cuenta **por sucursal**, no por tenant: el tope describe cuántas cajas
 * puede operar un local a la vez. `maxSessions: null` es "sin tope".
 */
export interface CashSessionCapacityDto {
  maxSessions: number | null;
  openSessions: number;
  hasCapacity: boolean;
}

export interface CreateCashRegisterRequest {
  name: string;
  branchId?: string;
}

export interface UpdateCashRegisterRequest {
  name?: string;
  isActive?: boolean;
}

/* ── Movimientos ─────────────────────────────────────────────────────────── */

export interface CashMovementDto {
  id: string;
  cashSessionId: string;
  type: CashMovementType;
  currency: string;
  amount: string | number;
  exchangeRateUsed: string | number | null;
  amountOriginalCurrency: string | number | null;
  amountMxnEquivalent: string | number | null;
  paymentMethod: string;
  referenceId: string | null;
  referenceType: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
}

/** `POST /cash-sessions/active/movement` — `cash:manage`. */
export interface CreateManualMovementRequest {
  type: 'INCOME' | 'EXPENSE';
  /** ≥ 0.01. */
  amount: number;
  currency?: CashCurrency;
  reason?: string;
  notes?: string;
}

/**
 * `POST /cash-sessions/active/withdraw` — `pos.cash:withdraw`.
 *
 * `reason` es obligatorio, y el servidor rechaza el retiro si excede el
 * efectivo disponible de esa divisa: dejaría el esperado en negativo, que no es
 * un estado físico posible.
 */
export interface WithdrawCashRequest {
  /** ≥ 0.01. */
  amount: number;
  currency?: CashCurrency;
  reason: string;
}

/* ── Arqueo ──────────────────────────────────────────────────────────────── */

export interface CashCountDto {
  id: string;
  cashSessionId: string;
  type: CashCountType;
  countedMxn: string | number;
  countedUsd: string | number;
  /** Esperado congelado al momento del conteo — sigue cambiando mientras la caja opera. */
  expectedMxn: string | number;
  expectedUsd: string | number;
  differenceMxn: string | number;
  differenceUsd: string | number;
  denominations: Record<string, number> | null;
  reason: string | null;
  countedById: string | null;
  createdAt: string;
}

/** `POST /cash-sessions/active/count` — autorización por permiso propio o PIN. */
export interface CreateCashCountRequest {
  /** Default `PARCIAL`. */
  type?: CashCountType;
  countedMxn: number;
  countedUsd?: number;
  /** Desglose opcional, `{ "1000": 2, "500": 3 }`. Suma informativa: manda el monto. */
  denominations?: Record<string, number>;
  reason?: string;
  authorizerPin?: string;
}

/** Cuerpo mínimo de `start-count` y `resume`. Viaja vacío con permiso propio. */
export interface AuthorizePinRequest {
  authorizerPin?: string;
}

/* ── Sesión ──────────────────────────────────────────────────────────────── */

/**
 * Totales que calcula el servidor (`CashSessionsService.buildSummary`). Es la
 * única fuente de verdad de las cifras del turno: el cliente no recalcula
 * dinero, igual que no lo hace con el total de una orden.
 */
export interface CashSummaryBucketDto {
  cash: number;
  cashUsd: number;
  card: number;
  transfer: number;
  total: number;
}

/** Ingresos, gastos, retiros: solo efectivo, sin tarjeta ni transferencia. */
export interface CashSummaryCashBucketDto {
  cash: number;
  cashUsd: number;
  total: number;
}

/**
  * Lo que movió una persona durante el turno.
  *
  * Responde la pregunta del corte cuando no cuadra: «¿de quién es este
  * faltante?». Solo ve a quien **movió dinero** — quien entró, consultó y no
  * vendió aparece en la bitácora de relevos, no aquí.
  */
export interface CashUserBreakdownDto {
  userId: string | null;
  name: string;
  sales: number;
  cxc: number;
  income: number;
  expense: number;
  withdrawal: number;
  refund: number;
  /** Efectivo en MXN que esta persona dejó en el cajón: metió menos sacó. */
  netCash: number;
  movementsCount: number;
}

/**
 * Un tramo de custodia: alguien tomó la caja abierta.
 *
 * `leftAt: null` significa **«seguía dentro»**, nunca «salió a tal hora». En un
 * móvil la señal de salida no es fiable —la app se mata, se acaba la batería—,
 * así que el tramo lo cierra la entrada del siguiente o el cierre de la sesión.
 */
export interface CashHandoverDto {
  id: string;
  cashSessionId: string;
  userId: string | null;
  enteredAt: string;
  leftAt: string | null;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
}

export interface CashSessionSummaryDto {
  openingAmount: number;
  openingAmountUsd: number;
  /** Fondo + entradas − salidas, solo efectivo de esa divisa. */
  expectedCash: number;
  expectedCashUsd: number;
  movementsCount: number;
  /** Quién movió cuánto. Ausente en respuestas viejas del servidor. */
  byUser?: CashUserBreakdownDto[];
  totals: {
    sales: CashSummaryBucketDto;
    cxc: CashSummaryBucketDto;
    supplier: CashSummaryBucketDto;
    income: CashSummaryCashBucketDto;
    expense: CashSummaryCashBucketDto;
    withdrawal: CashSummaryCashBucketDto;
    refund: CashSummaryBucketDto;
  };
}

/**
 * `GET /cash-sessions/active` y `GET /cash-sessions/:id`.
 *
 * `active` devuelve `{}` —no `null`— cuando no hay sesión viva, así que todo es
 * opcional al leerla; el repositorio decide mirando `id`.
 */
export interface CashSessionDto {
  id: string;
  status: CashSessionStatus;
  branchId: string | null;
  cashRegisterId: string | null;
  exchangeRateUsdMxn: string | number;
  openingAmount: string | number;
  openingAmountUsd: string | number | null;
  expectedAmount: string | number | null;
  cashCounted: string | number | null;
  cashCountedUsd: string | number | null;
  difference: string | number | null;
  differenceUsd: string | number | null;
  differenceReason: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  branch?: { id: string; name: string } | null;
  openedBy?: { id: string; email: string } | null;
  closedBy?: { id: string; email: string } | null;
  movements?: CashMovementDto[];
  /** Presente en `active`, `findOne` y la respuesta de apertura; ausente en el listado. */
  summary?: CashSessionSummaryDto;
}

/** Fila del historial: sin movimientos ni summary, con el conteo de movimientos. */
export interface CashSessionListItemDto {
  id: string;
  status: CashSessionStatus;
  branchId: string | null;
  cashRegisterId: string | null;
  openingAmount: string | number;
  openingAmountUsd: string | number | null;
  expectedAmount: string | number | null;
  cashCounted: string | number | null;
  difference: string | number | null;
  openedAt: string;
  closedAt: string | null;
  branch?: { id: string; name: string } | null;
  openedBy?: { id: string; email: string } | null;
  closedBy?: { id: string; email: string } | null;
  _count?: { movements: number };
}

/**
 * `POST /cash-sessions` — `pos.cash:open`.
 *
 * `exchangeRateUsdMxn` es obligatorio y ≥ 0.01 aunque no haya dólares en el
 * cajón: queda fijado para toda la sesión y el cierre calcula `differenceUsd`
 * contra él.
 */
export interface OpenCashSessionRequest {
  exchangeRateUsdMxn: number;
  openingAmount: number;
  openingAmountUsd?: number;
  notes?: string;
  branchId?: string;
  /** Sin él, el servidor toma la primera caja activa **libre** de la sucursal. */
  cashRegisterId?: string;
}

/**
 * `PATCH /cash-sessions/:id/close`.
 *
 * `differenceReason` lo exige el servidor cuando la diferencia supera
 * `Tenant.settings.cashDifferenceThreshold`, que no llega al cliente: la
 * decisión es suya, no nuestra.
 */
export interface CloseCashSessionRequest {
  cashCounted: number;
  cashCountedUsd?: number;
  differenceReason?: string;
  notes?: string;
  authorizerPin?: string;
}

export interface QueryCashSessionsParams {
  status?: CashSessionStatus;
  branchId?: string;
  page?: number;
  limit?: number;
}
