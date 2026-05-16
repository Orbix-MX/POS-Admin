import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface AuditContext {
  userId?: string;
}

@Injectable()
export class AuditContextService {
  private readonly als = new AsyncLocalStorage<AuditContext>();

  run<T>(context: AuditContext, callback: () => T): T {
    return this.als.run(context, callback);
  }

  getUserId(): string | undefined {
    const store = this.als.getStore();
    return store?.userId;
  }

  setUserId(userId: string | undefined): void {
    const store = this.als.getStore();
    if (store) {
      store.userId = userId;
    }
  }
}
