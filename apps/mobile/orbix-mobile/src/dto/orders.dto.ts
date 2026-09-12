/**
 * Shapes for `/orders` — creación de venta, historial, detalle, cancelación y
 * devolución.
 *
 * Tomadas de `api/src/modules/retail/orders`. Los `Decimal` de Prisma
 * serialisan como string sobre JSON, misma razón que en `ProductDto`.
 */
import type { OrderOrigin, OrderStatus, PaymentStatus } from '@/types/api';

/* ── Creación ────────────────────────────────────────────────────────────── */

export interface CreateOrderItemRequest {
  itemType?: 'PRODUCT' | 'SERVICE';
  productId?: string;
  /**
   * Presentación vendida. ADR-0030 pone la unidad vendible en la variante; sin
   * esto el servidor resuelve la default y el inventario por presentación no
   * cuadra con lo cobrado.
   */
  variantId?: string;
  quantity: number;
  price: number;
  /** Descuento de la línea. Exige `orders:discount-override`. */
  discount?: number;
}

export interface CreateOrderPaymentSplit {
  method: string;
  currency?: 'MXN' | 'USD';
  amount: number;
  amountReceived?: number;
  changeGiven?: number;
}

export interface CreateOrderRequest {
  items: CreateOrderItemRequest[];
  paymentMethod: string;
  payments?: CreateOrderPaymentSplit[];
  paymentStatus?: string;
  status?: string;
  customerId?: string;
  couponCode?: string;
  notes?: string;
  changeAmount?: number;
  changeCurrency?: 'MXN' | 'USD';
}

/* ── Lectura ─────────────────────────────────────────────────────────────── */

export interface OrderItemDto {
  id: string;
  itemType: 'PRODUCT' | 'SERVICE';
  productId: string | null;
  variantId: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  price: string | number;
  discount: string | number;
  tax: string | number;
  subtotal: string | number;
  total: string | number;
}

export interface OrderPaymentDto {
  id: string;
  paymentMethod: string;
  currency: string;
  amount: string | number;
  amountReceived: string | number | null;
  changeGiven: string | number | null;
  changeCurrency: string | null;
  status: PaymentStatus;
  createdAt: string;
}

export interface OrderRefundItemDto {
  id: string;
  orderItemId: string;
  productId: string | null;
  quantity: number;
}

export interface OrderRefundDto {
  id: string;
  amount: string | number;
  currency: string;
  refundMethod: string;
  originalMethod: string | null;
  reason: string;
  notes: string | null;
  createdAt: string;
  items?: OrderRefundItemDto[];
}

export interface OrderCustomerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

/**
 * `GET /orders` y `GET /orders/:id`.
 *
 * El listado incluye hoy `items` con el `product` completo embebido — payload
 * pesado para una lista móvil. Aquí solo se declara lo que la app consume; el
 * resto se ignora, que es lo que hace que el backend pueda añadir campos sin
 * romper versiones viejas.
 */
export interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  orderOrigin: OrderOrigin | null;
  subtotal: string | number;
  tax: string | number;
  discount: string | number;
  total: string | number;
  notes: string | null;
  branchId: string | null;
  customerId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  customer?: OrderCustomerDto | null;
  items?: OrderItemDto[];
  payments?: OrderPaymentDto[];
  refunds?: OrderRefundDto[];
}

/**
 * `QueryOrdersDto` del servidor.
 *
 * `dateFrom` / `dateTo` son instantes **absolutos** (ISO 8601 con zona) y el
 * rango es `[desde, hasta)`. El cliente los calcula desde su hora local: el
 * servidor compara en UTC, y un "hoy" derivado allí desfasaría el día de
 * cualquier negocio fuera de UTC — las ventas de la tarde de una tienda en
 * UTC−6 caerían en el día siguiente.
 */
export interface QueryOrdersParams {
  customerId?: string;
  status?: OrderStatus;
  orderOrigin?: OrderOrigin;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/* ── Mutaciones sobre una venta ──────────────────────────────────────────── */

/** `POST /orders/:id/cancel` y `/return`. El motivo es obligatorio en ambos. */
export interface CancelOrderRequest {
  reason: string;
}

export interface RefundLineRequest {
  orderItemId: string;
  quantity: number;
}

/**
 * `POST /orders/:id/refund` — `refunds:create`.
 *
 * Con `items`, el servidor restaura el inventario exactamente de esas líneas y
 * acota la cantidad por (vendido − ya devuelto). Sin ellos es una devolución
 * solo de dinero, sin movimiento de stock.
 */
export interface RefundOrderRequest {
  /** Opcional cuando van `items`: se deriva de las líneas y se verifica. */
  amount?: number;
  refundMethod: string;
  reason: string;
  currency?: 'MXN' | 'USD';
  items?: RefundLineRequest[];
  notes?: string;
}

export interface SendReceiptResponseDto {
  success: boolean;
  message: string;
  previewUrl?: string;
}
