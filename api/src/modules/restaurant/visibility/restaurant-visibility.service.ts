import { Injectable } from '@nestjs/common';
import { RestaurantVisibilityMode } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Resuelve el modo de visibilidad de comandas entre meseros, configurado por
 * sucursal (`Branch.restaurantVisibilityMode`).
 *
 * IMPORTANTE: este servicio SOLO resuelve el modo. NO filtra nada. El filtro de
 * DiningOrder (cuando exista) vive en `DiningOrdersService.resolveVisibilityWhere`.
 * Hoy todos los modos se comportan como SHARED.
 *
 * Decisión funcional (Opción A): Mesas, Kitchen y Caja son SIEMPRE globales; el
 * modo solo afectará el listado de DiningOrder para el scope 'own' (operador).
 */
@Injectable()
export class RestaurantVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Modo configurado para la sucursal. Default SHARED si la sucursal no existe
   * o no tiene el valor — así el llamador nunca queda bloqueado y el
   * comportamiento por defecto preserva la operación actual.
   */
  async resolveRestaurantVisibilityMode(
    tenantId: string,
    branchId: string,
  ): Promise<RestaurantVisibilityMode> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { restaurantVisibilityMode: true },
    });
    return branch?.restaurantVisibilityMode ?? RestaurantVisibilityMode.SHARED;
  }
}
