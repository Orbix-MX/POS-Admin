/**
 * Shapes for `/branches`, `/cash-sessions` and `/orders` — the POS checkout
 * path. Decimal fields serialise as strings over JSON, same rationale as
 * `ProductDto`.
 */

export interface BranchDto {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
}

export interface CashSessionDto {
  id: string;
  status: 'ABIERTA' | 'CERRADA';
  branchId: string | null;
  openingAmount: string | number;
  openingAmountUsd: string | number | null;
  exchangeRateUsdMxn: string | number;
  openedAt: string;
}

export interface OpenCashSessionRequest {
  exchangeRateUsdMxn: number;
  openingAmount: number;
  openingAmountUsd?: number;
  notes?: string;
  branchId?: string;
}

export interface CreateOrderItemRequest {
  itemType?: 'PRODUCT' | 'SERVICE';
  productId?: string;
  quantity: number;
  price: number;
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
  changeAmount?: number;
  changeCurrency?: 'MXN' | 'USD';
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: string | number;
  tax: string | number;
  discount: string | number;
  total: string | number;
  createdAt: string;
}
