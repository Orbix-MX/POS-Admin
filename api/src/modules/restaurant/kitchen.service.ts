import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditContextService } from '../../common/context/audit-context.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { UpdateKitchenStatusDto, KitchenOrderStatus } from './dto/update-kitchen-status.dto';

const ACTIVE_KITCHEN_STATUSES: KitchenOrderStatus[] = [
  KitchenOrderStatus.PENDING,
  KitchenOrderStatus.IN_PROGRESS,
  KitchenOrderStatus.PAUSED,
  KitchenOrderStatus.READY,
];

const VALID_TRANSITIONS: Record<KitchenOrderStatus, KitchenOrderStatus[]> = {
  [KitchenOrderStatus.PENDING]:    [KitchenOrderStatus.IN_PROGRESS, KitchenOrderStatus.REJECTED],
  [KitchenOrderStatus.IN_PROGRESS]:[KitchenOrderStatus.PAUSED, KitchenOrderStatus.READY, KitchenOrderStatus.REJECTED],
  [KitchenOrderStatus.PAUSED]:     [KitchenOrderStatus.IN_PROGRESS, KitchenOrderStatus.REJECTED],
  [KitchenOrderStatus.READY]:      [KitchenOrderStatus.DELIVERED, KitchenOrderStatus.IN_PROGRESS],
  [KitchenOrderStatus.REJECTED]:   [],
  [KitchenOrderStatus.DELIVERED]:  [],
};

const KITCHEN_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          recipe: {
            include: {
              items: {
                include: {
                  supply: { select: { id: true, name: true } },
                  measurementUnit: { select: { id: true, name: true, symbol: true } },
                },
              },
            },
          },
          comboItems: {
            include: {
              child: {
                include: {
                  recipe: {
                    include: {
                      items: {
                        include: {
                          supply: { select: { id: true, name: true } },
                          measurementUnit: { select: { id: true, name: true, symbol: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
};

@Injectable()
export class KitchenService {
  constructor(
    private prisma: PrismaService,
    private auditContext: AuditContextService,
    private tenantContext: TenantContextService,
  ) {}

  async getKitchenOrders() {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;

    return this.prisma.order.findMany({
      where: {
        tenantId,
        ...(branchId != null && { branchId }),
        kitchenStatus: { in: ACTIVE_KITCHEN_STATUSES },
      },
      orderBy: { createdAt: 'asc' },
      include: KITCHEN_INCLUDE,
    });
  }

  async updateKitchenStatus(orderId: string, dto: UpdateKitchenStatusDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const branchId = this.tenantContext.getBranchId() ?? null;
    const userId = this.auditContext.getUserId() ?? null;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, ...(branchId != null && { branchId }) },
    });

    if (!order) throw new NotFoundException('Orden no encontrada');

    const current = (order.kitchenStatus as KitchenOrderStatus | null) ?? KitchenOrderStatus.PENDING;
    const allowed = VALID_TRANSITIONS[current] ?? [];

    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transición inválida: ${current} → ${dto.status}. Permitidas: ${allowed.join(', ') || 'ninguna'}`,
      );
    }

    if (dto.status === KitchenOrderStatus.REJECTED && !dto.rejectionComment?.trim()) {
      throw new BadRequestException('El comentario de rechazo es obligatorio');
    }

    const now = new Date();

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        kitchenStatus: dto.status,
        updatedById: userId,
        ...(dto.status === KitchenOrderStatus.IN_PROGRESS && {
          kitchenStartedAt: (order.kitchenStartedAt as Date | null) ?? now,
        }),
        ...(dto.status === KitchenOrderStatus.PAUSED && { kitchenPausedAt: now }),
        ...(dto.status === KitchenOrderStatus.READY  && { kitchenReadyAt: now }),
        ...(dto.status === KitchenOrderStatus.REJECTED && {
          kitchenRejectedAt: now,
          kitchenRejectedById: userId,
          kitchenRejectionComment: dto.rejectionComment,
        }),
        ...(dto.status === KitchenOrderStatus.DELIVERED && {
          deliveryStatus: 'DELIVERED',
          deliveredAt: now,
        }),
      },
      include: KITCHEN_INCLUDE,
    });
  }
}
