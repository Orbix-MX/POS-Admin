import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const ALLOWED_TENANT_STATUSES = ['ACTIVE', 'TRIAL'];

/** Cuánto tarda en notarse la baja de un empleado en una instancia que no la procesó. */
export const OPERATOR_STATUS_TTL_MS = 30_000;
const MAX_ENTRIES = 2_000;

/**
 * ¿Sigue vigente el empleado detrás de un token de operador?
 *
 * Los tokens de operador (PIN, 12 h) llevan identidad y permisos en el propio JWT, así que la
 * estrategia nunca miraba la base: un empleado dado de baja seguía operando hasta el `exp`.
 * El POS dispara una petición por venta, por eso el resultado se cachea 30 s por empleado; quien
 * cambia el estado de un empleado debe llamar a `invalidate` (misma instancia: efecto inmediato;
 * otras réplicas: hasta el TTL — límite aceptado, ver ODD acceso-residual-tras-baja T-002).
 *
 * @odd acceso-residual-tras-baja T-002
 */
@Injectable()
export class OperatorSessionService {
  private readonly cache = new Map<string, { active: boolean; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  private key(tenantId: string, employeeId: string): string {
    return `${tenantId}:${employeeId}`;
  }

  async isActive(tenantId: string, employeeId: string): Promise<boolean> {
    const key = this.key(tenantId, employeeId);
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.active;

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { status: true, tenant: { select: { status: true } } },
    });
    const active =
      !!employee && employee.status === 'ACTIVE' && ALLOWED_TENANT_STATUSES.includes(employee.tenant.status);

    if (this.cache.size >= MAX_ENTRIES) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key, { active, expiresAt: Date.now() + OPERATOR_STATUS_TTL_MS });
    return active;
  }

  /** Tras cambiar el estado de un empleado. */
  invalidate(tenantId: string, employeeId: string): void {
    this.cache.delete(this.key(tenantId, employeeId));
  }
}
