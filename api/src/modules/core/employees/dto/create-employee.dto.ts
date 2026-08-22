import {
  IsEmail, IsString, IsEnum, IsOptional, IsDateString,
  IsNumber, Min, MinLength, MaxLength, IsUUID, IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EmployeeStatus, ContractType } from '@prisma/client';
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.decorator';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  employeeNumber: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(18)
  curp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(13)
  rfc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({ enum: ContractType, default: ContractType.FULL_TIME })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional({ enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // ── Cuenta de back-office (opcional) ────────────────────────────────────────
  // Dos caminos excluyentes entre sí: enlazar una cuenta que ya existe, o crear
  // una nueva para esta persona. La mayoría del personal no necesita ninguna de
  // las dos: opera con PIN y nunca entra al panel.

  @ApiPropertyOptional({
    description: 'Vincula al empleado con una cuenta existente del tenant.',
  })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Crea también una cuenta de acceso para este empleado, usando su correo. Requiere permiso users:create.',
  })
  @IsOptional()
  @IsBoolean()
  createUserAccount?: boolean;

  @ApiPropertyOptional({
    description: 'Contraseña inicial de la cuenta. Obligatoria si createUserAccount es true.',
  })
  @IsOptional()
  @IsStrongPassword()
  userPassword?: string;
}
