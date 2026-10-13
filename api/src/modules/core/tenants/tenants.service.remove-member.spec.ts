import { ConflictException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

/**
 * @odd acceso-residual-tras-baja T-001
 * Quitar a un miembro borra su membresía; los permisos en caché de ese usuario deben descartarse
 * en el mismo acto. El bloqueo real lo da la estrategia JWT; esto evita que la caché sobreviva.
 */

const TENANT = 'tenant-1';

function build(ownerUserId = 'dueño') {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ ownerUserId }) },
    tenantMembership: { delete: jest.fn().mockResolvedValue({}) },
  };
  const planLimits = { recomputeOverLimit: jest.fn().mockResolvedValue(undefined) };
  const permissionCache = { invalidateUser: jest.fn().mockResolvedValue(undefined) };
  const service = new TenantsService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    {} as never,
    planLimits as never,
    {} as never,
    {} as never,
    {} as never,
    permissionCache as never,
  );
  return { service, prisma, planLimits, permissionCache };
}

describe('TenantsService.removeMember', () => {
  it('borra la membresía e invalida los permisos en caché de ese usuario', async () => {
    const { service, prisma, permissionCache, planLimits } = build();

    await service.removeMember('miembro-1');

    expect(prisma.tenantMembership.delete).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: TENANT, userId: 'miembro-1' } },
    });
    expect(permissionCache.invalidateUser).toHaveBeenCalledWith('miembro-1', TENANT);
    expect(planLimits.recomputeOverLimit).toHaveBeenCalledWith(TENANT);
  });

  it('no permite remover al propietario y no toca nada', async () => {
    const { service, prisma, permissionCache } = build('dueño');

    await expect(service.removeMember('dueño')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tenantMembership.delete).not.toHaveBeenCalled();
    expect(permissionCache.invalidateUser).not.toHaveBeenCalled();
  });
});
