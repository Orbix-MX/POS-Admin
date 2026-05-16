import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { TenantRole } from '@prisma/client';

export interface TenantContext {
  tenantId?: string;
  tenantRole?: TenantRole;
  branchId?: string;
}

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, callback: () => T): T {
    return this.als.run(context, callback);
  }

  getTenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }

  requireTenantId(): string {
    const id = this.getTenantId();
    if (!id) throw new Error('TenantContext: tenantId is not set');
    return id;
  }

  getTenantRole(): TenantRole | undefined {
    return this.als.getStore()?.tenantRole;
  }

  getBranchId(): string | undefined {
    return this.als.getStore()?.branchId;
  }
}
