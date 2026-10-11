import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PlanUpgradeRequestStatus, TenantPlan } from '@prisma/client';
import { PLAN_ORDER } from '@orbix/types';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';

// Índice único parcial: una solicitud PENDING por empresa (migración
// 20261011000000_plan_upgrade_request_one_pending).
const ONE_PENDING_INDEX = 'plan_upgrade_requests_one_pending_per_tenant_key';

/**
 * Solicitudes de "Mejorar plan" (S-E del alta self-service). Sin cobro: la app pide,
 * Platform atiende a mano. Una pendiente por empresa; pedir otra vez la actualiza.
 *
 * @odd planes-self-service T-003
 */
@Injectable()
export class PlanUpgradeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** La solicitud pendiente de la empresa en sesión, o null. */
  async getPending() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.planUpgradeRequest.findFirst({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Pide un plan de pago. Durante la prueba se puede pedir cualquiera (también el
   * de la prueba, para quedarse en él); fuera de ella, solo uno mayor que el actual.
   */
  async request(userId: string, requestedPlan: TenantPlan, note?: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true, status: true },
    });

    if (requestedPlan === 'FREE') {
      throw new BadRequestException('Elige un plan de pago.');
    }
    const rank = (plan: TenantPlan) => PLAN_ORDER.indexOf(plan);
    if (tenant.status !== 'TRIAL' && rank(requestedPlan) <= rank(tenant.plan)) {
      throw new BadRequestException('Tu empresa ya tiene ese plan o uno mayor.');
    }

    const data = { currentPlan: tenant.plan, requestedPlan, note: note?.trim() || null };
    const pending = await this.getPending();
    if (pending) {
      return this.prisma.planUpgradeRequest.update({ where: { id: pending.id }, data });
    }
    try {
      return await this.prisma.planUpgradeRequest.create({
        data: { ...data, tenantId, requestedById: userId },
      });
    } catch (error) {
      // Dos peticiones a la vez cruzaron el chequeo de arriba: el índice dejó pasar solo a
      // una. Esta actualiza la que ganó en vez de duplicar o fallar. @odd carreras-y-deriva T-001
      if (!this.isOnePendingViolation(error)) throw error;
      const winner = await this.getPending();
      if (!winner) throw error;
      return this.prisma.planUpgradeRequest.update({ where: { id: winner.id }, data });
    }
  }

  private isOnePendingViolation(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
    const target = error.meta?.target;
    if (typeof target === 'string') return target.includes(ONE_PENDING_INDEX);
    if (Array.isArray(target)) return target.includes(ONE_PENDING_INDEX);
    // Con índices parciales el target puede venir sin nombre: es la única restricción única.
    return true;
  }

  /** Bandeja de Platform. */
  async list(status: PlanUpgradeRequestStatus = 'PENDING') {
    return this.prisma.planUpgradeRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: {
        tenant: { select: { id: true, name: true, slug: true, plan: true, status: true } },
        requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Platform la marca atendida o cancelada. Solo desde pendiente. */
  async resolve(id: string, status: 'HANDLED' | 'CANCELLED', platformUserId: string) {
    const updated = await this.prisma.planUpgradeRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, handledById: platformUserId, handledAt: new Date() },
    });
    if (updated.count === 0) {
      throw new NotFoundException('La solicitud no existe o ya no está pendiente.');
    }
    return this.prisma.planUpgradeRequest.findUniqueOrThrow({ where: { id } });
  }
}
