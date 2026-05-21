import { Injectable } from '@nestjs/common';
import { OrderItemType, OrderStatus, PaymentStatus, PurchaseOrderStatus, ServiceQuoteStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import type { WidgetResponse } from '../dashboards/types/widget-response.type';

export interface MonthlySalesData {
  value:  number;
  orders: number;
  label:  string;
}

export interface NewCustomersData {
  value: number;
  label: string;
}

export interface ChartDataset {
  id:     string;
  label:  string;
  values: number[];
  color?: string;
}

export interface ChartData {
  labels:   string[];
  datasets: ChartDataset[];
}

export interface MonthlyQuotesData {
  value: number;
  total: number;
  label: string;
}

export interface MonthlyExpensesData {
  value: number;
  count: number;
  label: string;
}

export interface MonthlyProfitData {
  value:    number;
  sales:    number;
  expenses: number;
  label:    string;
}

export interface RankingItem {
  rank:     number;
  name:     string;
  sku:      string | null;
  quantity: number;
  revenue:  number;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async monthlySales(params: {
    year?: number;
    month?: number;
    branchId?: string;
  }): Promise<WidgetResponse<MonthlySalesData>> {
    const tenantId = this.tenantContext.requireTenantId();

    const now   = new Date();
    const year  = params.year  ?? now.getUTCFullYear();
    const month = params.month ?? now.getUTCMonth() + 1;

    const start    = new Date(Date.UTC(year, month - 1, 1));
    const end      = new Date(Date.UTC(year, month, 1));

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevEnd   = new Date(Date.UTC(prevYear, prevMonth, 1));

    const baseWhere = {
      tenantId,
      status:        { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
      paymentStatus: { in:    [PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID] },
      ...(params.branchId ? { branchId: params.branchId } : {}),
    };

    const [current, previous] = await Promise.all([
      this.prisma.order.aggregate({
        where: { ...baseWhere, createdAt: { gte: start, lt: end } },
        _sum:   { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: { ...baseWhere, createdAt: { gte: prevStart, lt: prevEnd } },
        _sum:   { total: true },
        _count: { _all: true },
      }),
    ]);

    const currentTotal  = Number(current._sum?.total  ?? 0);
    const previousTotal = Number(previous._sum?.total ?? 0);
    const orderCount    = current._count?._all ?? 0;

    const changePercent =
      previousTotal === 0
        ? currentTotal > 0 ? 100 : 0
        : ((currentTotal - previousTotal) / previousTotal) * 100;

    const trend: 'up' | 'down' | 'neutral' =
      changePercent > 0.01 ? 'up' : changePercent < -0.01 ? 'down' : 'neutral';

    const periodLabel = `${MONTH_NAMES_ES[month - 1]} ${year}`;
    const prevLabel   = `${MONTH_NAMES_ES[prevMonth - 1]} ${prevYear}`;

    return {
      success:    true,
      widgetType: 'COUNTER' as const,
      title:      'Ventas del mes',
      subtitle:   periodLabel,
      data: {
        value:  currentTotal,
        orders: orderCount,
        label:  'Total ventas',
      },
      meta: {
        currency: 'MXN',
        period:   `${year}-${String(month).padStart(2, '0')}`,
        comparison: {
          previousValue: previousTotal,
          changePercent: Math.round(changePercent * 100) / 100,
          trend,
          label: `vs ${prevLabel}`,
        },
      },
      config: {
        valueFormat: 'currency',
        animated:    true,
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  async newCustomers(params: {
    year?:     number;
    month?:    number;
    branchId?: string;
  }): Promise<WidgetResponse<NewCustomersData>> {
    const tenantId = this.tenantContext.requireTenantId();

    const now   = new Date();
    const year  = params.year  ?? now.getUTCFullYear();
    const month = params.month ?? now.getUTCMonth() + 1;

    const start    = new Date(Date.UTC(year, month - 1, 1));
    const end      = new Date(Date.UTC(year, month, 1));

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevEnd   = new Date(Date.UTC(prevYear, prevMonth, 1));

    const baseWhere = {
      tenantId,
      ...(params.branchId ? { branchId: params.branchId } : {}),
    };

    const [current, previous] = await Promise.all([
      this.prisma.customer.count({
        where: { ...baseWhere, createdAt: { gte: start, lt: end } },
      }),
      this.prisma.customer.count({
        where: { ...baseWhere, createdAt: { gte: prevStart, lt: prevEnd } },
      }),
    ]);

    const changePercent =
      previous === 0
        ? current > 0 ? 100 : 0
        : ((current - previous) / previous) * 100;

    const trend: 'up' | 'down' | 'neutral' =
      changePercent > 0.01 ? 'up' : changePercent < -0.01 ? 'down' : 'neutral';

    const periodLabel = `${MONTH_NAMES_ES[month - 1]} ${year}`;
    const prevLabel   = `${MONTH_NAMES_ES[prevMonth - 1]} ${prevYear}`;

    return {
      success:    true,
      widgetType: 'COUNTER' as const,
      title:      'Clientes nuevos',
      subtitle:   periodLabel,
      data: {
        value: current,
        label: 'Nuevos clientes',
      },
      meta: {
        period: `${year}-${String(month).padStart(2, '0')}`,
        comparison: {
          previousValue: previous,
          changePercent: Math.round(changePercent * 100) / 100,
          trend,
          label: `vs ${prevLabel}`,
        },
      },
      config: {
        valueFormat: 'number',
        animated:    true,
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  async dailySales(params: {
    year?:     number;
    month?:    number;
    branchId?: string;
  }): Promise<WidgetResponse<ChartData>> {
    const tenantId = this.tenantContext.requireTenantId();

    const now        = new Date();
    const year       = params.year  ?? now.getUTCFullYear();
    const month      = params.month ?? now.getUTCMonth() + 1;
    const start      = new Date(Date.UTC(year, month - 1, 1));
    const end        = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status:        { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
        paymentStatus: { in:    [PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID] },
        createdAt:     { gte: start, lt: end },
        ...(params.branchId ? { branchId: params.branchId } : {}),
      },
      select: { createdAt: true, total: true },
    });

    const totals = new Array<number>(daysInMonth).fill(0);
    for (const order of orders) {
      totals[order.createdAt.getUTCDate() - 1] += Number(order.total ?? 0);
    }

    const labels = Array.from({ length: daysInMonth }, (_, i) =>
      String(i + 1).padStart(2, '0'),
    );

    const periodLabel = `${MONTH_NAMES_ES[month - 1]} ${year}`;

    return {
      success:    true,
      widgetType: 'LINE_CHART' as const,
      title:      'Ventas por día',
      subtitle:   periodLabel,
      data: {
        labels,
        datasets: [
          { id: 'ventas', label: 'Ventas', values: totals },
        ],
      },
      meta: {
        currency: 'MXN',
        period:   `${year}-${String(month).padStart(2, '0')}`,
      },
      config: {
        valueFormat: 'currency',
        animated:    true,
        showGrid:    true,
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  async monthlyQuotes(params: {
    year?:     number;
    month?:    number;
    status?:   ServiceQuoteStatus;
  }): Promise<WidgetResponse<MonthlyQuotesData>> {
    const tenantId = this.tenantContext.requireTenantId();

    const now   = new Date();
    const year  = params.year  ?? now.getUTCFullYear();
    const month = params.month ?? now.getUTCMonth() + 1;

    const start    = new Date(Date.UTC(year, month - 1, 1));
    const end      = new Date(Date.UTC(year, month, 1));

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevEnd   = new Date(Date.UTC(prevYear, prevMonth, 1));

    const baseWhere = {
      tenantId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [current, previous] = await Promise.all([
      this.prisma.serviceQuote.aggregate({
        where: { ...baseWhere, createdAt: { gte: start, lt: end } },
        _sum:   { total: true },
        _count: { _all: true },
      }),
      this.prisma.serviceQuote.aggregate({
        where: { ...baseWhere, createdAt: { gte: prevStart, lt: prevEnd } },
        _sum:   { total: true },
        _count: { _all: true },
      }),
    ]);

    const currentCount  = current._count?._all  ?? 0;
    const previousCount = previous._count?._all ?? 0;
    const currentTotal  = Number(current._sum?.total  ?? 0);

    const changePercent =
      previousCount === 0
        ? currentCount > 0 ? 100 : 0
        : ((currentCount - previousCount) / previousCount) * 100;

    const trend: 'up' | 'down' | 'neutral' =
      changePercent > 0.01 ? 'up' : changePercent < -0.01 ? 'down' : 'neutral';

    const periodLabel = `${MONTH_NAMES_ES[month - 1]} ${year}`;
    const prevLabel   = `${MONTH_NAMES_ES[prevMonth - 1]} ${prevYear}`;

    return {
      success:    true,
      widgetType: 'COUNTER' as const,
      title:      'Cotizaciones del mes',
      subtitle:   periodLabel,
      data: {
        value: currentCount,
        total: currentTotal,
        label: 'Cotizaciones',
      },
      meta: {
        currency: 'MXN',
        period:   `${year}-${String(month).padStart(2, '0')}`,
        comparison: {
          previousValue: previousCount,
          changePercent: Math.round(changePercent * 100) / 100,
          trend,
          label: `vs ${prevLabel}`,
        },
      },
      config: {
        valueFormat: 'number',
        animated:    true,
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  async monthlyProfit(params: {
    year?:  number;
    month?: number;
  }): Promise<WidgetResponse<MonthlyProfitData>> {
    const tenantId = this.tenantContext.requireTenantId();

    const now   = new Date();
    const year  = params.year  ?? now.getUTCFullYear();
    const month = params.month ?? now.getUTCMonth() + 1;

    const start    = new Date(Date.UTC(year, month - 1, 1));
    const end      = new Date(Date.UTC(year, month, 1));

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevEnd   = new Date(Date.UTC(prevYear, prevMonth, 1));

    const salesWhere = {
      tenantId,
      status:        { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
      paymentStatus: { in:    [PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID] },
    };

    const expensesWhere = {
      tenantId,
      status: { notIn: [PurchaseOrderStatus.BORRADOR, PurchaseOrderStatus.CANCELADA] },
    };

    const [curSales, prevSales, curExpenses, prevExpenses] = await Promise.all([
      this.prisma.order.aggregate({
        where: { ...salesWhere, createdAt: { gte: start, lt: end } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { ...salesWhere, createdAt: { gte: prevStart, lt: prevEnd } },
        _sum: { total: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...expensesWhere, orderDate: { gte: start, lt: end } },
        _sum: { total: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...expensesWhere, orderDate: { gte: prevStart, lt: prevEnd } },
        _sum: { total: true },
      }),
    ]);

    const salesTotal    = Number(curSales._sum?.total    ?? 0);
    const expensesTotal = Number(curExpenses._sum?.total ?? 0);
    const profit        = salesTotal - expensesTotal;

    const prevSalesTotal    = Number(prevSales._sum?.total    ?? 0);
    const prevExpensesTotal = Number(prevExpenses._sum?.total ?? 0);
    const prevProfit        = prevSalesTotal - prevExpensesTotal;

    const changePercent =
      prevProfit === 0
        ? profit > 0 ? 100 : profit < 0 ? -100 : 0
        : ((profit - prevProfit) / Math.abs(prevProfit)) * 100;

    const trend: 'up' | 'down' | 'neutral' =
      changePercent > 0.01 ? 'up' : changePercent < -0.01 ? 'down' : 'neutral';

    const periodLabel = `${MONTH_NAMES_ES[month - 1]} ${year}`;
    const prevLabel   = `${MONTH_NAMES_ES[prevMonth - 1]} ${prevYear}`;

    return {
      success:    true,
      widgetType: 'COUNTER' as const,
      title:      'Utilidad del mes',
      subtitle:   periodLabel,
      data: {
        value:    profit,
        sales:    salesTotal,
        expenses: expensesTotal,
        label:    'Ventas − Gastos',
      },
      meta: {
        currency: 'MXN',
        period:   `${year}-${String(month).padStart(2, '0')}`,
        comparison: {
          previousValue: prevProfit,
          changePercent: Math.round(changePercent * 100) / 100,
          trend,
          label: `vs ${prevLabel}`,
        },
      },
      config: {
        valueFormat: 'currency',
        animated:    true,
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  async monthlyExpenses(params: {
    year?:  number;
    month?: number;
  }): Promise<WidgetResponse<MonthlyExpensesData>> {
    const tenantId = this.tenantContext.requireTenantId();

    const now   = new Date();
    const year  = params.year  ?? now.getUTCFullYear();
    const month = params.month ?? now.getUTCMonth() + 1;

    const start    = new Date(Date.UTC(year, month - 1, 1));
    const end      = new Date(Date.UTC(year, month, 1));

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevEnd   = new Date(Date.UTC(prevYear, prevMonth, 1));

    const baseWhere = {
      tenantId,
      status: {
        notIn: [PurchaseOrderStatus.BORRADOR, PurchaseOrderStatus.CANCELADA],
      },
    };

    const [current, previous] = await Promise.all([
      this.prisma.purchaseOrder.aggregate({
        where: { ...baseWhere, orderDate: { gte: start, lt: end } },
        _sum:   { total: true },
        _count: { _all: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...baseWhere, orderDate: { gte: prevStart, lt: prevEnd } },
        _sum:   { total: true },
        _count: { _all: true },
      }),
    ]);

    const currentTotal  = Number(current._sum?.total  ?? 0);
    const previousTotal = Number(previous._sum?.total ?? 0);
    const currentCount  = current._count?._all  ?? 0;

    const changePercent =
      previousTotal === 0
        ? currentTotal > 0 ? 100 : 0
        : ((currentTotal - previousTotal) / previousTotal) * 100;

    const trend: 'up' | 'down' | 'neutral' =
      changePercent > 0.01 ? 'up' : changePercent < -0.01 ? 'down' : 'neutral';

    const periodLabel = `${MONTH_NAMES_ES[month - 1]} ${year}`;
    const prevLabel   = `${MONTH_NAMES_ES[prevMonth - 1]} ${prevYear}`;

    return {
      success:    true,
      widgetType: 'COUNTER' as const,
      title:      'Gastos del mes',
      subtitle:   periodLabel,
      data: {
        value: currentTotal,
        count: currentCount,
        label: 'Total compras',
      },
      meta: {
        currency: 'MXN',
        period:   `${year}-${String(month).padStart(2, '0')}`,
        comparison: {
          previousValue: previousTotal,
          changePercent: Math.round(changePercent * 100) / 100,
          trend,
          label: `vs ${prevLabel}`,
        },
      },
      config: {
        valueFormat: 'currency',
        animated:    true,
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  async topProducts(params: {
    year?:     number;
    month?:    number;
    branchId?: string;
    limit?:    number;
    orderBy?:  'quantity' | 'revenue';
  }): Promise<WidgetResponse<RankingItem[]>> {
    const tenantId = this.tenantContext.requireTenantId();

    const now   = new Date();
    const year  = params.year  ?? now.getUTCFullYear();
    const month = params.month ?? now.getUTCMonth() + 1;
    const limit = Math.min(params.limit ?? 10, 20);
    const sortBy = params.orderBy ?? 'quantity';

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end   = new Date(Date.UTC(year, month, 1));

    // Step 1 — IDs of paid, non-cancelled orders in the period
    const validOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status:        { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
        paymentStatus: { in:    [PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID] },
        createdAt:     { gte: start, lt: end },
        ...(params.branchId ? { branchId: params.branchId } : {}),
      },
      select: { id: true },
    });

    const orderIds = validOrders.map(o => o.id);

    const items =
      orderIds.length === 0
        ? []
        : await this.prisma.orderItem.findMany({
            where: {
              orderId:   { in: orderIds },
              itemType:  OrderItemType.PRODUCT,
              productId: { not: null },
            },
            select: {
              productId: true,
              name:      true,
              sku:       true,
              quantity:  true,
              total:     true,
            },
          });

    // Step 2 — aggregate by productId in JS
    const map = new Map<string, { name: string; sku: string | null; quantity: number; revenue: number }>();
    for (const item of items) {
      const key = item.productId!;
      const acc = map.get(key);
      if (acc) {
        acc.quantity += item.quantity;
        acc.revenue  += Number(item.total);
      } else {
        map.set(key, {
          name:     item.name,
          sku:      item.sku,
          quantity: item.quantity,
          revenue:  Number(item.total),
        });
      }
    }

    const ranking: RankingItem[] = Array.from(map.values())
      .sort((a, b) =>
        sortBy === 'revenue'
          ? b.revenue - a.revenue || b.quantity - a.quantity
          : b.quantity - a.quantity || b.revenue - a.revenue,
      )
      .slice(0, limit)
      .map((item, i) => ({ rank: i + 1, ...item }));

    const periodLabel = `${MONTH_NAMES_ES[month - 1]} ${year}`;

    return {
      success:    true,
      widgetType: 'RANKING' as const,
      title:      'Productos más vendidos',
      subtitle:   periodLabel,
      data:       ranking,
      meta: {
        currency: 'MXN',
        period:   `${year}-${String(month).padStart(2, '0')}`,
        empty:    ranking.length === 0,
        emptyLabel: 'Sin ventas en este período',
      },
      config: {
        valueFormat: 'number',
        animated:    true,
      },
      lastUpdate: new Date().toISOString(),
    };
  }
}
