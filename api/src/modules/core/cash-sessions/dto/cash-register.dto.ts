import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, MaxLength } from 'class-validator';

export class CreateCashRegisterDto {
  @ApiProperty({ description: 'Nombre de la caja física', example: 'Caja 2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ description: 'Sucursal; por defecto la del contexto de sesión' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class UpdateCashRegisterDto {
  @ApiPropertyOptional({ example: 'Caja mostrador' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ description: 'Desactivar una caja la saca del POS sin borrar su historial' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
