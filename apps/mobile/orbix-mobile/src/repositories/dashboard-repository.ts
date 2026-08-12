import type { DashboardStatsDto } from '@/dto/dashboard.dto';
import { http } from '@/services/api';

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockProducts: number;
}

export const dashboardRepository = {
  async getStats(): Promise<DashboardStats> {
    const dto = await http.get<DashboardStatsDto>('/dashboard/stats');
    return {
      totalOrders: dto.totalOrders,
      // Decimal arrives as a string; `Number` on a malformed value would yield
      // NaN and render as "NaN", so it is floored to 0.
      totalRevenue: Number(dto.totalRevenue) || 0,
      totalCustomers: dto.totalCustomers,
      totalProducts: dto.totalProducts,
      pendingOrders: dto.pendingOrders,
      lowStockProducts: dto.lowStockProducts,
    };
  },
} as const;
