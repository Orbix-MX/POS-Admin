import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { TenantPlan } from '@prisma/client';
import {
  PLAN_BRANCH_LIMITS,
  PLAN_CASH_SESSION_LIMITS,
  PLAN_ORDER,
  PLAN_USER_LIMITS,
  getModulesForPlan,
} from '@orbix/types';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * Precios por plan en MXN. **Sin definir todavía** (decisión de producto 2026-10-10:
 * la comparativa muestra "Precio a consultar"). Cuando haya precios se rellenan aquí
 * y la app los muestra sin cambiar.
 * @odd planes-self-service T-002
 */
const PLAN_PRICES_MXN: Record<TenantPlan, { monthly: number | null; annual: number | null }> = {
  FREE: { monthly: 0, annual: 0 },
  STARTER: { monthly: null, annual: null },
  PRO: { monthly: null, annual: null },
  PLUS: { monthly: null, annual: null },
  ENTERPRISE: { monthly: null, annual: null },
};

export class PlanDto {
  @ApiProperty({ enum: TenantPlan }) plan: TenantPlan;
  @ApiProperty({ type: [String], description: 'Módulos incluidos (acumulativos por nivel)' }) modules: string[];
  @ApiPropertyOptional({ nullable: true, description: 'Usuarios activos; null = ilimitado' }) maxUsers: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Sucursales; null = ilimitado' }) maxBranches: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Cajas abiertas a la vez; null = ilimitado' })
  maxCashSessions: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Precio mensual en MXN; null = a consultar' })
  priceMonthly: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Precio anual en MXN; null = a consultar' })
  priceAnnual: number | null;
  @ApiProperty({ example: 'MXN' }) currency: 'MXN';
}

/** @odd planes-self-service T-002 */
export function listPlans(): PlanDto[] {
  return PLAN_ORDER.map((plan) => ({
    plan,
    modules: getModulesForPlan(plan),
    maxUsers: PLAN_USER_LIMITS[plan],
    maxBranches: PLAN_BRANCH_LIMITS[plan],
    maxCashSessions: PLAN_CASH_SESSION_LIMITS[plan],
    priceMonthly: PLAN_PRICES_MXN[plan].monthly,
    priceAnnual: PLAN_PRICES_MXN[plan].annual,
    currency: 'MXN',
  }));
}

/**
 * Catálogo público de planes (S-D): lo que incluye cada uno, sacado de las mismas
 * constantes que aplica el servidor (`@orbix/types`), para que la comparativa de la app
 * no se desalinee de lo que de verdad se permite.
 */
@ApiTags('plans')
@Controller('plans')
export class PlansController {
  /** @odd planes-self-service T-002 */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Catálogo de planes: módulos, límites y precio (null = a consultar)' })
  @ApiOkResponse({ type: [PlanDto] })
  list(): PlanDto[] {
    return listPlans();
  }
}
