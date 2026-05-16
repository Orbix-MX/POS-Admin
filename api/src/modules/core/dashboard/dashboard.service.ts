import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async getStats() {
    const tenantId = this.tenantContext.requireTenantId();

    const [
      totalOrders,
      totalRevenue,
      totalCustomers,
      totalProducts,
      pendingOrders,
      lowStockProducts,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { tenantId, paymentStatus: 'PAID' },
      }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.order.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.product.count({
        where: { tenantId, trackInventory: true, status: 'ACTIVE' },
      }),
      this.prisma.order.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      totalCustomers,
      totalProducts,
      pendingOrders,
      lowStockProducts,
      recentOrders,
    };
  }
}
