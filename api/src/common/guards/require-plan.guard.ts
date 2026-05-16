import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';

export const REQUIRE_PLAN_KEY = 'requirePlan';
export const RequirePlan = (...plans: string[]) =>
  (target: any, key?: string | symbol, descriptor?: any) => {
    Reflect.defineMetadata(REQUIRE_PLAN_KEY, plans, descriptor?.value ?? target);
    return descriptor ?? target;
  };

@Injectable()
export class RequirePlanGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlans = this.reflector.get<string[]>(REQUIRE_PLAN_KEY, context.getHandler());
    if (!requiredPlans?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.tenantId) return true; // SUPER_ADMIN bypass

    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { plan: true } });
    if (!tenant) throw new ForbiddenException('Tenant not found');

    const PLAN_ORDER = ['FREE', 'STARTER', 'PRO', 'PLUS', 'ENTERPRISE'];
    const tenantLevel = PLAN_ORDER.indexOf(tenant.plan);
    const meetsAny = requiredPlans.some(p => PLAN_ORDER.indexOf(p) <= tenantLevel);
    if (!meetsAny) throw new ForbiddenException(`This feature requires plan: ${requiredPlans.join(' or ')}`);
    return true;
  }
}
