/**
 * Filtros del listado de ventas: sucursal y rango de fechas.
 *
 * Existen porque el historial de tickets del móvil los necesita, y porque sin
 * `branchId` un tenant con varias sucursales veía las ventas de todas mezcladas
 * en el historial de una sola.
 *
 * Lo que se comprueba aquí es la traducción de la query a `where` de Prisma —
 * en particular que el rango sea `[gte, lt)` y no `[gte, lte]`, que contaría dos
 * veces la venta justo en el límite entre dos periodos consecutivos.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../../database/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditService } from '../../../common/services/audit.service';
import { InventoryConsumptionEngine } from '../inventory/inventory-consumption.engine';
import { EffectivePermissionsService } from '../../../common/services/effective-permissions.service';
import { QueryOrdersDto } from './dto/query-orders.dto';

describe('OrdersService.findAll — filtros', () => {
  let service: OrdersService;

  const mockPrisma = {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CouponsService, useValue: { getAutoApplicableCoupons: jest.fn() } },
        { provide: AuditContextService, useValue: { getUserId: jest.fn() } },
        {
          provide: TenantContextService,
          useValue: {
            requireTenantId: jest.fn().mockReturnValue('tenant-1'),
            getBranchId: jest.fn().mockReturnValue(null),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: InventoryConsumptionEngine,
          useValue: { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() },
        },
        {
          provide: EffectivePermissionsService,
          useValue: { actorHas: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(0);
  });

  /** El `where` con el que se llamó a Prisma. */
  function whereUsed(): Record<string, unknown> {
    return mockPrisma.order.findMany.mock.calls[0][0].where;
  }

  function query(overrides: Partial<QueryOrdersDto> = {}): QueryOrdersDto {
    return { page: 1, limit: 20, skip: 0, ...overrides } as QueryOrdersDto;
  }

  it('siempre acota al tenant del contexto', async () => {
    await service.findAll(query());
    expect(whereUsed()).toEqual({ tenantId: 'tenant-1' });
  });

  it('no inventa filtros cuando no se piden', async () => {
    await service.findAll(query());
    const where = whereUsed();
    expect(where).not.toHaveProperty('createdAt');
    expect(where).not.toHaveProperty('branchId');
  });

  it('filtra por sucursal', async () => {
    await service.findAll(query({ branchId: 'branch-1' }));
    expect(whereUsed()).toMatchObject({ branchId: 'branch-1' });
  });

  it('aplica el rango como [desde, hasta) — inclusivo y exclusivo', async () => {
    await service.findAll(
      query({ dateFrom: '2026-09-11T06:00:00.000Z', dateTo: '2026-09-12T06:00:00.000Z' }),
    );

    expect(whereUsed().createdAt).toEqual({
      gte: new Date('2026-09-11T06:00:00.000Z'),
      lt: new Date('2026-09-12T06:00:00.000Z'),
    });
  });

  it('acepta solo el desde', async () => {
    await service.findAll(query({ dateFrom: '2026-09-01T06:00:00.000Z' }));
    expect(whereUsed().createdAt).toEqual({ gte: new Date('2026-09-01T06:00:00.000Z') });
  });

  it('acepta solo el hasta', async () => {
    await service.findAll(query({ dateTo: '2026-10-01T06:00:00.000Z' }));
    expect(whereUsed().createdAt).toEqual({ lt: new Date('2026-10-01T06:00:00.000Z') });
  });

  it('respeta el desfase de zona que manda el cliente', async () => {
    // "Hoy" de un negocio en UTC−6 va de las 06:00Z a las 06:00Z del día
    // siguiente. Calcularlo en el servidor metería las ventas de la tarde en el
    // día equivocado — de ahí que el rango llegue ya absoluto.
    await service.findAll(
      query({ dateFrom: '2026-09-11T00:00:00.000-06:00', dateTo: '2026-09-12T00:00:00.000-06:00' }),
    );

    expect(whereUsed().createdAt).toEqual({
      gte: new Date('2026-09-11T06:00:00.000Z'),
      lt: new Date('2026-09-12T06:00:00.000Z'),
    });
  });

  it('combina todos los filtros', async () => {
    await service.findAll(
      query({
        customerId: 'cust-1',
        status: 'CONFIRMED',
        orderOrigin: 'RETAIL_POS',
        branchId: 'branch-1',
        dateFrom: '2026-09-11T06:00:00.000Z',
      }),
    );

    expect(whereUsed()).toEqual({
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      status: 'CONFIRMED',
      orderOrigin: 'RETAIL_POS',
      branchId: 'branch-1',
      createdAt: { gte: new Date('2026-09-11T06:00:00.000Z') },
    });
  });

  it('el mismo filtro acota también el conteo total', async () => {
    await service.findAll(query({ branchId: 'branch-1', dateFrom: '2026-09-11T06:00:00.000Z' }));

    // Si el count no llevara el mismo where, la paginación prometería páginas
    // que el listado no puede llenar.
    expect(mockPrisma.order.count.mock.calls[0][0].where).toEqual(whereUsed());
  });
});
