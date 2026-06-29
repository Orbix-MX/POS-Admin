import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Garantiza que la sucursal pertenezca al tenant autenticado.
 *
 * Defensa multi-tenant para endpoints cuyo `branchId` llega por la URL o el DTO
 * (controlado por el cliente): un id de otra organización se rechaza con 404
 * antes de leer o escribir cualquier dato, evitando referencias cruzadas entre
 * tenants. Para `branchId` derivado del token (contexto) la verificación es
 * inocua — siempre pertenece al tenant.
 */
export async function assertBranchBelongs(
  prisma: PrismaService,
  tenantId: string,
  branchId: string,
): Promise<void> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { id: true },
  });
  if (!branch) throw new NotFoundException('Sucursal no encontrada.');
}
