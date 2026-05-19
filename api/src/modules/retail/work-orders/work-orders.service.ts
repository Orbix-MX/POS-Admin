import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';

const DETAIL_INCLUDE = {
  customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  service: { select: { id: true, name: true, basePrice: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  assignments: {
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  quoteLink: {
    include: {
      serviceQuote: { select: { id: true, quoteNumber: true, status: true, total: true } },
    },
  },
};

@Injectable()
export class WorkOrdersService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async create(dto: CreateWorkOrderDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const createdById = this.auditContext.getUserId() ?? null;

    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    if (dto.serviceId) {
      const svc = await this.prisma.service.findFirst({ where: { id: dto.serviceId, tenantId } });
      if (!svc) throw new NotFoundException('Servicio no encontrado');
    }

    if (dto.serviceQuoteId) {
      const quote = await this.prisma.serviceQuote.findFirst({ where: { id: dto.serviceQuoteId, tenantId } });
      if (!quote) throw new NotFoundException('Cotización no encontrada');
    }

    const orderNumber = `OT-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          tenantId,
          orderNumber,
          customerId: dto.customerId,
          serviceId: dto.serviceId ?? null,
          description: dto.description,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes ?? null,
          ...(createdById && { createdById }),
        },
        include: DETAIL_INCLUDE,
      });

      if (dto.serviceQuoteId) {
        await tx.workOrderQuote.create({
          data: { workOrderId: workOrder.id, serviceQuoteId: dto.serviceQuoteId },
        });
      }

      return tx.workOrder.findUnique({ where: { id: workOrder.id }, include: DETAIL_INCLUDE });
    });
  }

  async findAll(query: QueryWorkOrdersDto): Promise<PaginatedResponse<any>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page, status, customerId, search } = query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: DETAIL_INCLUDE,
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
      include: DETAIL_INCLUDE,
    });
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');
    return workOrder;
  }

  async update(id: string, dto: UpdateWorkOrderDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, tenantId } });
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');
    if (workOrder.status === 'CANCELLED') {
      throw new BadRequestException('No se puede editar una orden cancelada');
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status && { status: dto.status }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: DETAIL_INCLUDE,
    });
  }

  async assign(id: string, dto: AssignUserDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, tenantId } });
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');
    if (workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED') {
      throw new BadRequestException('No se puede asignar a una orden terminada o cancelada');
    }

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const assignment = await this.prisma.workOrderAssignment.create({
      data: { workOrderId: id, userId: dto.userId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    return assignment;
  }

  async startAssignment(id: string, assignmentId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, tenantId } });
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');

    const assignment = await this.prisma.workOrderAssignment.findFirst({
      where: { id: assignmentId, workOrderId: id },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    if (assignment.startedAt) throw new BadRequestException('La asignación ya fue iniciada');

    await this.prisma.$transaction([
      this.prisma.workOrderAssignment.update({
        where: { id: assignmentId },
        data: { startedAt: new Date() },
      }),
      this.prisma.workOrder.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      }),
    ]);

    return this.findOne(id);
  }

  async finishAssignment(id: string, assignmentId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, tenantId } });
    if (!workOrder) throw new NotFoundException('Orden de trabajo no encontrada');

    const assignment = await this.prisma.workOrderAssignment.findFirst({
      where: { id: assignmentId, workOrderId: id },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    if (!assignment.startedAt) throw new BadRequestException('La asignación no ha sido iniciada');
    if (assignment.finishedAt) throw new BadRequestException('La asignación ya fue terminada');

    await this.prisma.workOrderAssignment.update({
      where: { id: assignmentId },
      data: { finishedAt: new Date() },
    });

    return this.findOne(id);
  }
}
