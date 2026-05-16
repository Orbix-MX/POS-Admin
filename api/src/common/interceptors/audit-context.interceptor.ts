import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuditContextService } from '../context/audit-context.service';
import { TenantContextService } from '../context/tenant-context.service';
import { TenantRole } from '@prisma/client';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(
    private readonly auditContext: AuditContextService,
    private readonly tenantContext: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { id?: string; tenantId?: string; tenantRole?: TenantRole; branchId?: string }
      | undefined;

    return new Observable((subscriber) => {
      this.tenantContext.run(
        {
          tenantId: user?.tenantId,
          tenantRole: user?.tenantRole,
          branchId: user?.branchId,
        },
        () => {
          this.auditContext.run({ userId: user?.id }, () => {
            next.handle().subscribe(subscriber);
          });
        },
      );
    });
  }
}
