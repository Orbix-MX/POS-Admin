import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { OpenDiningOrderDto, AddDiningItemDto, UpdateDiningItemDto } from './dto/dining-order.dto';

const ITEM_SELECT = {
  id: true,
  productId: true,
  productName: true,
  unitPrice: true,
  quantity: true,
  notes: true,
  createdAt: true,
} as const;

const ORDER_SELECT = {
  id: true,
  serviceType: true,
  status: true,
  openedAt: true,
  closedAt: true,
  tableId: true,
  branchId: true,
  table: { select: { id: true, name: true, capacity: true } },
  waiter: { select: { id: true, firstName: true, lastName: true } },
  items: { select: ITEM_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class DiningOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditContext: AuditContextService,
  ) {}

  async findActive(branchId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.diningOrder.findMany({
      where: { tenantId, branchId, status: 'OPEN' },
      orderBy: { openedAt: 'asc' },
      select: ORDER_SELECT,
    });
  }

  async findForTable(branchId: string, tableId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { tenantId, branchId, tableId, status: 'OPEN' },
      select: ORDER_SELECT,
    });
    return order ?? null;
  }

  async open(branchId: string, dto: OpenDiningOrderDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const waiterId = this.auditContext.getUserId();
    const serviceType = dto.serviceType ?? 'DINE_IN';

    if (!waiterId) throw new ConflictException('No se pudo identificar al mesero.');

    // Validate waiter belongs to tenant
    const waiter = await this.prisma.employee.findFirst({
      where: { id: waiterId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!waiter) throw new NotFoundException('Mesero no encontrado.');

    if (serviceType === 'DINE_IN') {
      return this.openDineIn(tenantId, branchId, waiterId, dto.tableId!);
    }
    return this.openCounter(tenantId, branchId, waiterId);
  }

  private async openDineIn(tenantId: string, branchId: string, waiterId: string, tableId: string) {
    if (!tableId) throw new BadRequestException('tableId es requerido para órdenes DINE_IN.');

    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, tenantId, branchId, isActive: true },
      select: { id: true, status: true },
    });
    if (!table) throw new NotFoundException('Mesa no encontrada.');

    const existing = await this.prisma.diningOrder.findFirst({
      where: { tableId, status: 'OPEN' },
      select: { id: true },
    });
    if (existing) throw new ConflictException('La mesa ya tiene una cuenta abierta.');

    const [order] = await this.prisma.$transaction([
      this.prisma.diningOrder.create({
        data: { tenantId, branchId, tableId, waiterId, serviceType: 'DINE_IN' },
        select: ORDER_SELECT,
      }),
      this.prisma.restaurantTable.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      }),
    ]);
    return order;
  }

  private async openCounter(tenantId: string, branchId: string, waiterId: string) {
    return this.prisma.diningOrder.create({
      data: { tenantId, branchId, waiterId, serviceType: 'COUNTER' },
      select: ORDER_SELECT,
    });
  }

  async findOne(branchId: string, orderId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId },
      select: ORDER_SELECT,
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    return order;
  }

  async addItem(branchId: string, orderId: string, dto: AddDiningItemDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId, status: 'OPEN' },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Orden activa no encontrada.');

    if (dto.productId) {
      const existing = await this.prisma.diningOrderItem.findFirst({
        where: { orderId, productId: dto.productId },
        select: { id: true, quantity: true },
      });
      if (existing) {
        return this.prisma.diningOrderItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + dto.quantity },
          select: ITEM_SELECT,
        });
      }
    }

    return this.prisma.diningOrderItem.create({
      data: {
        orderId,
        productId: dto.productId ?? null,
        productName: dto.productName,
        unitPrice: dto.unitPrice,
        quantity: dto.quantity,
        notes: dto.notes ?? null,
      },
      select: ITEM_SELECT,
    });
  }

  async updateItem(branchId: string, orderId: string, itemId: string, dto: UpdateDiningItemDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId, status: 'OPEN' },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Orden activa no encontrada.');

    const item = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado.');

    return this.prisma.diningOrderItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
      select: ITEM_SELECT,
    });
  }

  async removeItem(branchId: string, orderId: string, itemId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const order = await this.prisma.diningOrder.findFirst({
      where: { id: orderId, tenantId, branchId, status: 'OPEN' },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Orden activa no encontrada.');

    const item = await this.prisma.diningOrderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado.');

    await this.prisma.diningOrderItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }
}
