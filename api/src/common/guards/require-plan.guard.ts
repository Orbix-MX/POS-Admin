import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_ORDER } from '@ventasy/types';

export const REQUIRE_PLAN_KEY = 'requirePlan';
export const RequirePlan = (...plans: string[]) =>
  (target: any, key?: string | symbol, descriptor?: any) => {
    Reflect.defineMetadata(REQUIRE_PLAN_KEY, plans, descriptor?.value ?? target);
    return descriptor ?? target;
  };

@Injectable()
export class RequirePlanGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlans = this.reflector.get<string[]>(REQUIRE_PLAN_KEY, context.getHandler());
    if (!requiredPlans?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.tenantId) return true; // SUPER_ADMIN bypass

    const plan: string = user.plan ?? 'FREE';
    const tenantLevel = PLAN_ORDER.indexOf(plan as any);
    const meetsAny = requiredPlans.some(p => PLAN_ORDER.indexOf(p as any) <= tenantLevel);
    if (!meetsAny) throw new ForbiddenException(`This feature requires plan: ${requiredPlans.join(' or ')}`);
    return true;
  }
}
