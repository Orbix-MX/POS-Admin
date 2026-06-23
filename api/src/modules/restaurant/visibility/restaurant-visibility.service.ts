import { Injectable, NotFoundException } from '@nestjs/common';
import { RestaurantVisibilityMode } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';

/** Datos mínimos de una orden para decidir acceso por recurso. */
export interface OrderOwnership {
  waiterId: string;
  branchId: string;
}

/**
 * Visibilidad de comandas entre meseros, configurada por sucursal
 * (`Branch.restaurantVisibilityMode`). Un único punto para DOS decisiones que
 * deben ir siempre en sincronía:
 *
 *  1) `resolveRestaurantVisibilityMode` — resuelve el modo (lo usa el LISTADO).
 *  2) `assertCanAccessOrder` — autorización por RECURSO (acceso por id), para
 *     que un operador no pueda leer/mutar una orden ajena conociendo su id
 *     aunque el listado la oculte (evita IDOR cuando llegue OWN_ONLY).
 *
 * Decisión funcional (Opción A): Mesas/Kitchen/Caja son SIEMPRE globales; el
 * modo solo gobierna las comandas del operador. El cajero (usuario admin) y los
 * flujos de usuario tienen acceso total y nunca pasan por el filtro de recurso.
 */
@Injectable()
export class RestaurantVisibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditContext: AuditContextService,
  ) {}

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

  /**
   * Autoriza el acceso por id a una orden concreta según el modo de la sucursal.
   * Espejo de `resolveVisibilityWhere` pero para recursos individuales.
   *
   * Reglas:
   *  - Usuario administrativo (no operador): acceso total (caja, admin, cron).
   *  - SHARED: acceso total (comportamiento actual; default de todas las sucursales).
   *  - OWN_ONLY: solo si la orden es del operador (`waiterId === operador`).
   *  - OWN_WITH_SUPERVISOR: propia o de un subordinado del operador.
   *
   * Lanza NotFoundException (NO 403) cuando no hay acceso: no revela la
   * existencia de cuentas ajenas — el operador la ve igual que a una inexistente.
   *
   * HOY, con todas las sucursales en SHARED (default), esto SIEMPRE pasa → cero
   * cambio funcional observable. El enforcement se activa cuando una sucursal
   * cambia de modo; entonces NO existe IDOR por acceso directo.
   */
  async assertCanAccessOrder(order: OrderOwnership): Promise<void> {
    // Flujos de usuario (caja, admin): identidad ligada a User, acceso total.
    if (!this.auditContext.isOperator()) return;

    const tenantId = this.tenantContext.requireTenantId();
    const mode = await this.resolveRestaurantVisibilityMode(tenantId, order.branchId);

    // SHARED: todos los operadores ven/operan todas las comandas (actual).
    if (mode === RestaurantVisibilityMode.SHARED) return;

    const operatorId = this.auditContext.getUserId();
    // Sin identidad de operador resoluble: fail-closed (no debería ocurrir bajo
    // un token operador válido, pero nunca se concede acceso "por defecto").
    if (!operatorId) throw new NotFoundException('Orden no encontrada.');

    // Propia: siempre permitida en cualquier modo restrictivo.
    if (order.waiterId === operatorId) return;

    // Supervisor: además, las de sus subordinados.
    if (
      mode === RestaurantVisibilityMode.OWN_WITH_SUPERVISOR &&
      (await this.isSubordinate(tenantId, operatorId, order.waiterId))
    ) {
      return;
    }

    // Ajena y sin parentesco jerárquico permitido → se trata como inexistente.
    throw new NotFoundException('Orden no encontrada.');
  }

  /**
   * True si `waiterId` es subordinado de `supervisorId` en el tenant.
   *
   * PUNTO DE EXTENSIÓN: el modelo `Employee` aún NO tiene relación de jerarquía
   * (supervisorId/reportsTo). Hasta que exista, no hay subordinados resolubles y
   * este método devuelve `false` — es decir, OWN_WITH_SUPERVISOR se comporta hoy
   * como OWN_ONLY (fail-closed: el lado seguro). Cuando se agregue la relación,
   * aquí se consulta y se reemplaza el `return false`.
   */
  private isSubordinate(
    tenantId: string,
    supervisorId: string,
    waiterId: string,
  ): Promise<boolean> {
    // FUTURO (requiere Employee.supervisorId):
    //   const sub = await this.prisma.employee.findFirst({
    //     where: { id: waiterId, tenantId, supervisorId },
    //     select: { id: true },
    //   });
    //   return sub != null;
    void tenantId;
    void supervisorId;
    void waiterId;
    return Promise.resolve(false);
  }
}
