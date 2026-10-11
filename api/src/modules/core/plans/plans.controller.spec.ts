import { PLAN_ORDER, getModulesForPlan } from '@orbix/types';
import { listPlans } from './plans.controller';

/**
 * @odd planes-self-service T-002
 *
 * `GET /plans` (S-D) sale de las mismas constantes que aplica el servidor: la comparativa
 * de la app no puede prometer un módulo o un límite que el plan no da.
 */
describe('listPlans', () => {
  it('lista los planes en orden, con sus módulos acumulativos', () => {
    const plans = listPlans();

    expect(plans.map((p) => p.plan)).toEqual(PLAN_ORDER);
    for (const p of plans) {
      expect(p.modules).toEqual(getModulesForPlan(p.plan));
      expect(p.currency).toBe('MXN');
    }
    const pro = plans.find((p) => p.plan === 'PRO')!;
    const free = plans.find((p) => p.plan === 'FREE')!;
    expect(pro.modules.length).toBeGreaterThan(free.modules.length);
  });

  it('sin precios definidos todavía: FREE cuesta 0 y los de pago van a consultar (null)', () => {
    const plans = listPlans();

    expect(plans.find((p) => p.plan === 'FREE')).toMatchObject({ priceMonthly: 0, priceAnnual: 0 });
    for (const plan of ['PRO', 'PLUS', 'ENTERPRISE'] as const) {
      expect(plans.find((p) => p.plan === plan)).toMatchObject({ priceMonthly: null, priceAnnual: null });
    }
  });
});
