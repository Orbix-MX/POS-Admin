import { IsEnum, IsOptional } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class AddMemberDto {
  // El enum acepta OWNER porque es el mismo `TenantRole` de Prisma, pero
  // `TenantsService.addMember` lo rechaza explícitamente: no es un valor más
  // de rol de membership, es `Tenant.ownerUserId`, y transferirlo es aparte.
  @IsOptional()
  @IsEnum(TenantRole)
  role?: TenantRole;
}
