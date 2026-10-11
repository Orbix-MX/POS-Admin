import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanUpgradeRequestsService } from './plan-upgrade-requests.service';

/**
 * @odd planes-self-service T-003
 *
 * "Mejorar plan" (S-E): la app pide un plan de pago y Platform lo atiende a mano. Una
 * pendiente por empresa, y no se puede pedir lo que ya se tiene (salvo durante la
 * prueba, cuando pedir PRO es justo quedarse en él).
 */

function build(tenant: { plan: string; status: string }, pending: Record<string, unknown> | null = null) {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(tenant) },
    planUpgradeRequest: {
      findFirst: jest.fn().mockResolvedValue(pending),
      create: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'req-new', ...data })),
      update: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...pending, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'req-1', status: 'HANDLED' }),
    },
  };
  const tenantContext = { requireTenantId: jest.fn().mockReturnValue('tenant-1') };
  return { service: new PlanUpgradeRequestsService(prisma as never, tenantContext as never), prisma };
}

describe('PlanUpgradeRequestsService.request', () => {
  it('en prueba PRO puede pedir PRO para quedarse en él', async () => {
    const { service, prisma } = build({ plan: 'PRO', status: 'TRIAL' });

    const req = await service.request('user-1', 'PRO', '  Quiero seguir en PRO ');

    expect(prisma.planUpgradeRequest.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        requestedById: 'user-1',
        currentPlan: 'PRO',
        requestedPlan: 'PRO',
        note: 'Quiero seguir en PRO',
      },
    });
    expect(req).toMatchObject({ id: 'req-new' });
  });

  it('desde FREE puede pedir un plan mayor', async () => {
    const { service, prisma } = build({ plan: 'FREE', status: 'ACTIVE' });

    await service.request('user-1', 'PLUS');

    expect(prisma.planUpgradeRequest.create).toHaveBeenCalled();
  });

  it('fuera de prueba no puede pedir su mismo plan ni uno menor', async () => {
    const { service, prisma } = build({ plan: 'PRO', status: 'ACTIVE' });

    await expect(service.request('user-1', 'PRO')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.request('user-1', 'STARTER')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.planUpgradeRequest.create).not.toHaveBeenCalled();
  });

  it('no se puede pedir FREE', async () => {
    const { service } = build({ plan: 'PRO', status: 'TRIAL' });

    await expect(service.request('user-1', 'FREE')).rejects.toThrow('Elige un plan de pago.');
  });

  it('con una pendiente, pedir otra vez la actualiza en vez de duplicarla', async () => {
    const { service, prisma } = build({ plan: 'FREE', status: 'ACTIVE' }, { id: 'req-1', status: 'PENDING' });

    await service.request('user-1', 'ENTERPRISE');

    expect(prisma.planUpgradeRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { currentPlan: 'FREE', requestedPlan: 'ENTERPRISE', note: null },
    });
    expect(prisma.planUpgradeRequest.create).not.toHaveBeenCalled();
  });
});

describe('PlanUpgradeRequestsService.resolve', () => {
  it('Platform marca una pendiente como atendida, con quién y cuándo', async () => {
    const { service, prisma } = build({ plan: 'FREE', status: 'ACTIVE' });

    await service.resolve('req-1', 'HANDLED', 'platform-1');

    expect(prisma.planUpgradeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'HANDLED', handledById: 'platform-1', handledAt: expect.any(Date) }),
    });
  });

  it('una que ya no está pendiente no se vuelve a resolver', async () => {
    const { service, prisma } = build({ plan: 'FREE', status: 'ACTIVE' });
    prisma.planUpgradeRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.resolve('req-1', 'CANCELLED', 'platform-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
