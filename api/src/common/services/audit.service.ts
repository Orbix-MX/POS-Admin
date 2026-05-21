import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditContextService } from '../context/audit-context.service';
import { TenantContextService } from '../context/tenant-context.service';

export type AuditAction =
  | 'ORDER_CANCEL'
  | 'ORDER_RETURN'
  | 'ORDER_REFUND'
  | 'INVENTORY_ADJUST'
  | 'PRICE_CHANGE'
  | 'USER_STATUS_CHANGE';

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
