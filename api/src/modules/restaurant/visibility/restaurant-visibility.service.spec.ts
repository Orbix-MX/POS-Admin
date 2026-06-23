import { RestaurantVisibilityService } from './restaurant-visibility.service';

/**
 * Helper que resuelve `Branch.restaurantVisibilityMode`. Solo RESUELVE el modo;
 * no filtra nada. El default SHARED garantiza que el llamador nunca se bloquee
 * ni cambie el comportamiento actual.
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function build(branchRow: { restaurantVisibilityMode: string } | null) {
  const findFirst = jest.fn().mockResolvedValue(branchRow);
  const prisma = { branch: { findFirst } };
  const service = new RestaurantVisibilityService(prisma as never);
  return { service, findFirst };
}

describe('RestaurantVisibilityService.resolveRestaurantVisibilityMode', () => {
  it('devuelve el modo configurado en la sucursal', async () => {
    const { service } = build({ restaurantVisibilityMode: 'OWN_ONLY' });
    await expect(service.resolveRestaurantVisibilityMode(TENANT, BRANCH)).resolves.toBe('OWN_ONLY');
  });

  it('default SHARED cuando la sucursal no existe', async () => {
    const { service } = build(null);
    await expect(service.resolveRestaurantVisibilityMode(TENANT, BRANCH)).resolves.toBe('SHARED');
  });

  it('consulta acotada por tenant + branch (aislamiento multi-tenant)', async () => {
    const { service, findFirst } = build({ restaurantVisibilityMode: 'SHARED' });
    await service.resolveRestaurantVisibilityMode(TENANT, BRANCH);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: BRANCH, tenantId: TENANT },
      select: { restaurantVisibilityMode: true },
    });
  });
});
