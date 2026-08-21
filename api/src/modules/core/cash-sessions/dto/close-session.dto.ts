import { IsNumber, Min, IsOptional, IsString, MaxLength, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CloseCashSessionDto {
  @ApiProperty({ example: 1250, description: 'Efectivo MXN contado físicamente' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashCounted: number;

  @ApiPropertyOptional({ example: 20, description: 'Efectivo USD contado físicamente' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashCountedUsd?: number;

  /**
   * Obligatorio cuando la diferencia supera el umbral del tenant
   * (`settings.cashDifferenceThreshold`, 0 = siempre que haya diferencia).
   * La validación es de servidor: el cliente no decide si hace falta.
   */
  @ApiPropertyOptional({ description: 'Motivo de la diferencia; requerido si supera el umbral' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  differenceReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /**
   * PIN del empleado que autoriza. Solo hace falta cuando el usuario de la
   * sesión no tiene el permiso por sí mismo; el servidor decide, no el cliente.
   */
  @ApiPropertyOptional({ description: 'PIN del supervisor que autoriza la operación' })
  @IsOptional()
  @IsString()
  @Length(4, 12)
  authorizerPin?: string;
}
