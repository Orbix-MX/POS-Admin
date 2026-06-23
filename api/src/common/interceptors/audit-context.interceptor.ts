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
      | { id?: string; role?: string; tenantId?: string; tenantRole?: TenantRole; branchId?: string }
      | undefined;

    // Operator tokens (`typ:'operator'`) carry an Employee id in `id`, flagged via
    // `role === 'DEVICE_OPERATOR'` (set by JwtStrategy). Propagated so services can
    // treat the operator as the authoritative identity.
    const isOperator = user?.role === 'DEVICE_OPERATOR';

    return new Observable((subscriber) => {
      this.tenantContext.run(
        {
          tenantId: user?.tenantId,
          tenantRole: user?.tenantRole,
          branchId: user?.branchId,
        },
        () => {
          this.auditContext.run({ userId: user?.id, isOperator }, () => {
            next.handle().subscribe(subscriber);
          });
        },
      );
    });
  }
}
