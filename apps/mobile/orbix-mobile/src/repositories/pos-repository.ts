import type {
  BranchDto,
  CashSessionDto,
  CreateOrderRequest,
  OpenCashSessionRequest,
  OrderDto,
} from '@/dto/pos.dto';
import { http } from '@/services/api';

export interface Branch {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
}

export interface CashSession {
  id: string;
  status: 'ABIERTA' | 'CERRADA';
  branchId: string | null;
  openingAmount: number;
  exchangeRateUsdMxn: number;
  openedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const branchesRepository = {
  async list(): Promise<Branch[]> {
    return http.get<BranchDto[]>('/branches');
  },
} as const;

export const cashSessionsRepository = {
  /** Backend returns `{}` (not null) when there's no active session. */
  async getActive(): Promise<CashSession | null> {
    const dto = await http.get<Partial<CashSessionDto>>('/cash-sessions/active');
    if (!dto.id) return null;
    return {
      id: dto.id,
      status: dto.status as 'ABIERTA' | 'CERRADA',
      branchId: dto.branchId ?? null,
      openingAmount: toNumber(dto.openingAmount),
      exchangeRateUsdMxn: toNumber(dto.exchangeRateUsdMxn),
      openedAt: dto.openedAt as string,
    };
  },

  async open(request: OpenCashSessionRequest): Promise<CashSession> {
    const dto = await http.post<CashSessionDto>('/cash-sessions', request);
    return {
      id: dto.id,
      status: dto.status,
      branchId: dto.branchId,
      openingAmount: toNumber(dto.openingAmount),
      exchangeRateUsdMxn: toNumber(dto.exchangeRateUsdMxn),
      openedAt: dto.openedAt,
    };
  },
} as const;

export const ordersRepository = {
  async create(request: CreateOrderRequest): Promise<Order> {
    const dto = await http.post<OrderDto>('/orders', request);
    return {
      id: dto.id,
      orderNumber: dto.orderNumber,
      status: dto.status,
      paymentStatus: dto.paymentStatus,
      total: toNumber(dto.total),
      createdAt: dto.createdAt,
    };
  },
} as const;
