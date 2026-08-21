import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { AuditService } from '../../../common/services/audit.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { InventoryModule } from './inventory.module';
import { InventoryEngine } from './inventory.engine';
import { InventoryConsumptionEngine } from './inventory-consumption.engine';
import { VariantInventoryResolver } from './variant-inventory.resolver';
import { BranchesService } from '../../core/branches/branches.service';
import { PurchasesService } from '../purchases/purchases.service';
import { StoreOrdersService } from '../../core/store-orders/store-orders.service';

/**
 * Smoke test del grafo de inyección de dependencias.
 *
 * El inventario por variante metió VariantInventoryResolver como dependencia
 * nueva de varios servicios que viven en otros módulos. TypeScript compila igual
 * aunque falte el `imports: [InventoryModule]` correspondiente: el fallo solo
 * aparece al arrancar Nest, con un "can't resolve dependencies". Estas pruebas
 * lo detectan sin necesidad de levantar la app completa.
 */
describe('Cableado de dependencias del inventario por variante', () => {
  const stubs = [
    { provide: PrismaService, useValue: {} },
    { provide: TenantContextService, useValue: {} },
    { provide: AuditContextService, useValue: {} },
    { provide: AuditService, useValue: {} },
    { provide: PlanLimitsService, useValue: {} },
  ];

  it('InventoryModule expone los tres proveedores del motor', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [InventoryModule],
    }).compile();

    expect(moduleRef.get(InventoryEngine)).toBeInstanceOf(InventoryEngine);
    expect(moduleRef.get(InventoryConsumptionEngine)).toBeInstanceOf(InventoryConsumptionEngine);
    expect(moduleRef.get(VariantInventoryResolver)).toBeInstanceOf(VariantInventoryResolver);
  });

  it.each([
    ['BranchesService', BranchesService],
    ['PurchasesService', PurchasesService],
    ['StoreOrdersService', StoreOrdersService],
  ])('%s resuelve sus dependencias de inventario', async (_name, ServiceClass) => {
    const moduleRef = await Test.createTestingModule({
      imports: [InventoryModule],
      providers: [ServiceClass, ...stubs],
    }).compile();

    expect(moduleRef.get(ServiceClass)).toBeInstanceOf(ServiceClass);
  });
});
