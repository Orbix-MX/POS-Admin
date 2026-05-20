import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getModulesForPlan, PLAN_ORDER } from '@ventasy/types';

export const REQUIRE_MODULE_KEY = 'requireModule';

export const RequireModule = (module: string) =>
  (target: any, key?: string | symbol, descriptor?: any) => {
    Reflect.defineMetadata(REQUIRE_MODULE_KEY, module, descriptor?.value ?? target);
    return descriptor ?? target;
  };

@Injectable()
export class RequireModuleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const module = this.reflector.get<string>(REQUIRE_MODULE_KEY, context.getHandler())
      ?? this.reflector.get<string>(REQUIRE_MODULE_KEY, context.getClass());
    if (!module) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.tenantId) return true; // SUPER_ADMIN bypass

    const plan = user.plan ?? 'FREE';
    const planModules = getModulesForPlan(plan) as unknown as string[];
    const extra: string[] = user.enabledModules ?? [];
    const effective = new Set([...planModules, ...extra]);

    if (!effective.has(module)) {
      throw new ForbiddenException(`Module '${module}' not enabled for this tenant`);
    }
    return true;
  }
}
