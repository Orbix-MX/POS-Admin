import { Allow, IsEmail, IsString, IsEnum, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.decorator';

// `role` (UserRole, el enum de PLATAFORMA) se quitó por la misma razón que en
// UpdateUserDto: dejaba fijar `SUPER_ADMIN` desde un endpoint con contexto de
// tenant. La cuenta nueva se crea con el default de Prisma (`STAFF`) — el rol
// dentro del tenant es aparte, vía RBAC.
export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @IsStrongPassword()
  password: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    enum: MembershipStatus,
    required: false,
    description: 'Per-tenant access status. ACTIVE consumes a plan seat.',
  })
  @Allow()
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
