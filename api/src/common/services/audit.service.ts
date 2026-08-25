import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditContextService } from '../context/audit-context.service';
import { TenantContextService } from '../context/tenant-context.service';

export type AuditAction =
  | 'ORDER_CANCEL'
  | 'ORDER_RETURN'
  | 'ORDER_REFUND'
  // H-05: una venta con precio de línea distinto al de catálogo requiere
  // `orders:price-override` y queda aquí — sin esto, cobrar de más o de
  // menos que el precio listado no dejaba rastro.
  | 'ORDER_PRICE_OVERRIDE'
  | 'INVENTORY_ADJUST'
  | 'PRICE_CHANGE'
  | 'USER_STATUS_CHANGE'
  // Caja — sin estas, una diferencia de arqueo no puede explicarse a posteriori
  // (docs/AUDITORIA-CAJA.md, CASH-004).
  | 'CASH_SESSION_OPEN'
  | 'CASH_SESSION_CLOSE'
  | 'CASH_MOVEMENT_CREATE'
  | 'CASH_WITHDRAWAL'
  | 'CASH_COUNT'
  // Transiciones del ciclo de caja (CASH-011).
  | 'CASH_COUNT_START'
  | 'CASH_COUNT_RESUME'
  // Identidad y RBAC. Sin estos, una escalación de privilegios no deja rastro:
  // quién le dio qué rol a quién, y cuándo, era irreconstruible.
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_INVITED'
  | 'USER_INVITE_REVOKED'
  | 'USER_ROLES_CHANGE'
  | 'USER_PERMISSIONS_CHANGE'
  | 'ROLE_CREATE'
  | 'ROLE_UPDATE'
  | 'ROLE_DELETE'
  | 'ROLE_PERMISSIONS_CHANGE'
  // Empleados. El PIN es una credencial: se registra el hecho, nunca su valor
  // ni su hash.
  | 'EMPLOYEE_CREATE'
  | 'EMPLOYEE_UPDATE'
  | 'EMPLOYEE_DEACTIVATE'
  | 'EMPLOYEE_PIN_ASSIGN'
  | 'EMPLOYEE_PIN_CLEAR';

interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

// Minimal shape so we can run inside a $transaction client or the root client
type AuditClient = {
  auditLog: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private prisma: PrismaService,
    private auditContext: AuditContextService,
    private tenantContext: TenantContextService,
  ) {}

  /**
   * Record a critical operation. Best-effort: a logging failure must never
   * roll back or break the business operation. Pass `tx` to enlist the write
   * in an ongoing transaction.
   */
  async log(entry: AuditEntry, tx?: AuditClient): Promise<void> {
    try {
      const tenantId = this.tenantContext.requireTenantId();
      const userId = this.auditContext.getUserId() ?? null;
      const client = tx ?? (this.prisma);
      await client.auditLog.create({
        data: {
          tenantId,
          userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: entry.before ?? Prisma.JsonNull,
          after: entry.after ?? Prisma.JsonNull,
          reason: entry.reason ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log (${entry.action} ${entry.entityType}:${entry.entityId})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
