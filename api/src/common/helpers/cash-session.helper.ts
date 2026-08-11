import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Regla única de "todo movimiento pertenece a una sesión abierta".
 *
 * Vivía duplicada e incompleta: las ventas la aplicaban (`OrdersService.create`)
 * pero los cobros de CxC, los pagos a proveedor y los movimientos manuales
 * guardaban `cashSessionId: null` cuando no había caja abierta. Ese dinero no
 * aparecía en ningún corte — ver `docs/AUDITORIA-CAJA.md` (CASH-001).
 *
 * Se aplica a todos los métodos de pago, no solo a efectivo, para no partir la
 * regla en dos: es el mismo criterio que ya seguía la venta, que exige caja
 * abierta aunque el cobro sea con tarjeta.
 */

/** Sirve dentro y fuera de `$transaction`: ambos exponen los mismos delegados. */
type CashSessionClient = Pick<Prisma.TransactionClient, 'cashSession'>;

export interface OpenSessionRef {
  id: string;
}

/**
 * Devuelve la sesión abierta de la sucursal, o lanza si no hay ninguna.
 *
 * `branchId` null (token sin sucursal) omite el filtro y toma la sesión abierta
 * del tenant, que es el comportamiento histórico para instalaciones de una sola
 * sucursal.
 */
export async function requireOpenSession(
  client: CashSessionClient,
  tenantId: string,
  branchId: string | null,
  message = 'No hay sesión de caja activa. Abre la caja antes de registrar movimientos.',
): Promise<OpenSessionRef> {
  const session = await client.cashSession.findFirst({
    where: { tenantId, branchId: branchId ?? undefined, status: 'ABIERTA' },
    select: { id: true },
  });
  if (!session) throw new BadRequestException(message);
  return { id: session.id };
}

/**
 * Revalida, ya dentro de la transacción, que la sesión resuelta antes de abrirla
 * sigue abierta.
 *
 * Las ventas leen la sesión fuera de la transacción porque necesitan su tipo de
 * cambio para calcular los totales. Si la caja se cerraba en esa ventana, el
 * movimiento se insertaba contra una sesión ya cerrada y alteraba un corte ya
 * emitido — CASH-003. Se consulta por id, no por sucursal: en un tenant con
 * varias cajas abiertas, buscar "alguna abierta" podría devolver otra sucursal.
 */
export async function assertSessionOpen(
  client: CashSessionClient,
  tenantId: string,
  sessionId: string,
): Promise<void> {
  const session = await client.cashSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { status: true },
  });
  if (!session || session.status !== 'ABIERTA') {
    throw new BadRequestException(
      'La sesión de caja se cerró durante la operación. Vuelve a intentarlo con la caja abierta.',
    );
  }
}
