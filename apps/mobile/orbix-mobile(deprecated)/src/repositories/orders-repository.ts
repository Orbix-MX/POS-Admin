/**
 * `/orders` — crear la venta, consultarla después, y deshacerla.
 *
 * Único lugar que conoce estas rutas. Los importes que devuelve el servidor son
 * los autoritativos: el POS solo puede estimar el impuesto desde el `taxRate`
 * de cada producto, porque la tasa por defecto del tenant vive en
 * `tenant.settings` y no llega al cliente.
 */
import type {
  CancelOrderRequest,
  CreateOrderRequest,
  OrderDto,
  OrderItemDto,
  OrderPaymentDto,
  OrderRefundDto,
  QueryOrdersParams,
  RefundOrderRequest,
  SendReceiptResponseDto,
} from '@/dto/orders.dto';
import type { PaginatedDto } from '@/dto/products.dto';
import { http } from '@/services/api';
import type { OrderOrigin, OrderStatus, PaymentStatus } from '@/types/api';

/* ── Modelos de dominio ──────────────────────────────────────────────────── */

export interface OrderLine {
  id: string;
  productId: string | null;
  variantId: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
  /** Unidades ya devueltas de esta línea; acota cuánto se puede devolver aún. */
  refundedQuantity: number;
}

export interface OrderPayment {
  id: string;
  method: string;
  currency: string;
  amount: number;
  amountReceived: number | null;
  changeGiven: number | null;
  createdAt: string;
}

export interface OrderRefund {
  id: string;
  amount: number;
  currency: string;
  method: string;
  reason: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  origin: OrderOrigin | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes: string | null;
  branchId: string | null;
  customerId: string | null;
  customerName: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  lines: OrderLine[];
  payments: OrderPayment[];
  refunds: OrderRefund[];
  /** Suma de las devoluciones; `total - refundedAmount` es lo que queda cobrado. */
  refundedAmount: number;
}

export interface OrderListResult {
  orders: Order[];
  meta: PaginatedDto<OrderDto>['meta'];
}

/* ── Normalización ───────────────────────────────────────────────────────── */

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Unidades ya devueltas por línea, sumadas sobre todas las devoluciones de la
 * orden. El servidor acota cada devolución nueva por (vendido − devuelto), así
 * que la UI necesita el mismo dato para no ofrecer cantidades que rechazará.
 */
function refundedByItem(refunds: OrderRefundDto[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const refund of refunds) {
    for (const item of refund.items ?? []) {
      counts.set(item.orderItemId, (counts.get(item.orderItemId) ?? 0) + item.quantity);
    }
  }
  return counts;
}

function toLine(dto: OrderItemDto, refunded: Map<string, number>): OrderLine {
  return {
    id: dto.id,
    productId: dto.productId,
    variantId: dto.variantId,
    name: dto.name,
    sku: dto.sku,
    quantity: dto.quantity,
    price: toNumber(dto.price),
    discount: toNumber(dto.discount),
    tax: toNumber(dto.tax),
    total: toNumber(dto.total),
    refundedQuantity: refunded.get(dto.id) ?? 0,
  };
}

function toPayment(dto: OrderPaymentDto): OrderPayment {
  return {
    id: dto.id,
    method: dto.paymentMethod,
    currency: dto.currency,
    amount: toNumber(dto.amount),
    amountReceived: dto.amountReceived == null ? null : toNumber(dto.amountReceived),
    changeGiven: dto.changeGiven == null ? null : toNumber(dto.changeGiven),
    createdAt: dto.createdAt,
  };
}

function toRefund(dto: OrderRefundDto): OrderRefund {
  return {
    id: dto.id,
    amount: toNumber(dto.amount),
    currency: dto.currency,
    method: dto.refundMethod,
    reason: dto.reason,
    createdAt: dto.createdAt,
  };
}

/** Nombre a pintar. `null` cuando la venta fue de mostrador, sin cliente. */
function customerNameOf(dto: OrderDto): string | null {
  if (!dto.customer) return null;
  const name = `${dto.customer.firstName} ${dto.customer.lastName}`.trim();
  return name || dto.customer.email || null;
}

export function toDomain(dto: OrderDto): Order {
  const refunds = dto.refunds ?? [];
  const refunded = refundedByItem(refunds);
  return {
    id: dto.id,
    orderNumber: dto.orderNumber,
    status: dto.status,
    paymentStatus: dto.paymentStatus,
    origin: dto.orderOrigin ?? null,
    subtotal: toNumber(dto.subtotal),
    tax: toNumber(dto.tax),
    discount: toNumber(dto.discount),
    total: toNumber(dto.total),
    notes: dto.notes ?? null,
    branchId: dto.branchId ?? null,
    customerId: dto.customerId ?? null,
    customerName: customerNameOf(dto),
    cancelledAt: dto.cancelledAt ?? null,
    cancellationReason: dto.cancellationReason ?? null,
    createdAt: dto.createdAt,
    lines: (dto.items ?? []).map((item) => toLine(item, refunded)),
    payments: (dto.payments ?? []).map(toPayment),
    refunds: refunds.map(toRefund),
    refundedAmount: refunds.reduce((sum, refund) => sum + toNumber(refund.amount), 0),
  };
}

/* ── Repositorio ─────────────────────────────────────────────────────────── */

export const ordersRepository = {
  async list(params: QueryOrdersParams): Promise<OrderListResult> {
    const dto = await http.get<PaginatedDto<OrderDto>>('/orders', { params });
    return { orders: dto.data.map(toDomain), meta: dto.meta };
  },

  async getById(id: string): Promise<Order> {
    return toDomain(await http.get<OrderDto>(`/orders/${id}`));
  },

  async create(request: CreateOrderRequest): Promise<Order> {
    return toDomain(await http.post<OrderDto>('/orders', request));
  },

  /**
   * Anula la venta y revierte inventario, caja y CxC en el servidor. Requiere
   * `orders:edit` y un motivo.
   */
  async cancel(id: string, request: CancelOrderRequest): Promise<Order> {
    return toDomain(await http.post<OrderDto>(`/orders/${id}/cancel`, request));
  },

  /** Devolución completa: revierte inventario y efectivo. Requiere `orders:edit`. */
  async returnSale(id: string, request: CancelOrderRequest): Promise<Order> {
    return toDomain(await http.post<OrderDto>(`/orders/${id}/return`, request));
  },

  /**
   * Devolución parcial o total. Con `items` el servidor restaura el inventario
   * exactamente de esas líneas; sin ellos es una devolución solo de dinero.
   * Requiere `refunds:create`.
   */
  async refund(id: string, request: RefundOrderRequest): Promise<unknown> {
    return http.post<unknown>(`/orders/${id}/refund`, request);
  },

  /** `POST /orders/:id/send-receipt` — envía el ticket por correo. Requiere `orders:view`. */
  async sendReceipt(orderId: string, email: string): Promise<void> {
    await http.post<SendReceiptResponseDto>(`/orders/${orderId}/send-receipt`, { email });
  },
} as const;
