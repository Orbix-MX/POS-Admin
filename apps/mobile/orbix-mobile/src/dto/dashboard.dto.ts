/**
 * `GET /api/dashboard/stats` — requires the `dashboard:view` permission.
 *
 * Shape taken from `DashboardService.getStats`. `totalRevenue` is a Prisma
 * `Decimal` aggregate, which serialises to a string over JSON when non-zero and
 * to `0` when there are no paid orders — hence the union.
 */
export interface DashboardStatsDto {
  totalOrders: number;
  totalRevenue: string | number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockProducts: number;
  recentOrders: unknown[];
}
