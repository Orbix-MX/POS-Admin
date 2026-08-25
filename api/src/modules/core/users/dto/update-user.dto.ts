import { IsEmail, IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';

// `role` (UserRole, el enum de PLATAFORMA — incluye SUPER_ADMIN) se quitó a
// propósito: este DTO se usa desde un endpoint con contexto de tenant
// (`PATCH /users/:id`, guardado con `users:edit`), y `SUPER_ADMIN` salta
// TODOS los chequeos de PermissionsGuard. Bastaba `users:edit` para
// auto-escalarse a control total de la plataforma vía este campo — el rol
// DENTRO del tenant ya se maneja aparte, por `TenantMembership.role` y RBAC.
export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({
    enum: MembershipStatus,
    description: 'Per-tenant access status. Routed to the tenant membership.',
  })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
