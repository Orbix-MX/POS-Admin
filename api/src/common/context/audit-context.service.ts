import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface AuditContext {
  userId?: string;
  /**
   * True when the request is authenticated by a device operator token
   * (`typ:'operator'`, `role === 'DEVICE_OPERATOR'`). In that case `userId` is an
   * Employee id (the operator), not a User id — used to make the operator the
   * authoritative identity (e.g. DiningOrder.waiterId) and ignore client-sent ids.
   */
  isOperator?: boolean;
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

  /** True when the current principal is a device operator (employee), not a user. */
  isOperator(): boolean {
    return this.als.getStore()?.isOperator ?? false;
  }
}
