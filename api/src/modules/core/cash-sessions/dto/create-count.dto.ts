import { IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Arqueo físico sobre la sesión abierta. Puede repetirse: un PARCIAL por turno
 * o tras una diferencia, y el FINAL que acompaña al cierre.
 */
export class CreateCashCountDto {
  @ApiPropertyOptional({ enum: ['PARCIAL', 'FINAL'], default: 'PARCIAL' })
  @IsOptional()
  @IsEnum(['PARCIAL', 'FINAL'])
  type?: 'PARCIAL' | 'FINAL';

  @ApiProperty({ example: 5500, description: 'Efectivo MXN contado físicamente' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedMxn: number;

  @ApiPropertyOptional({ example: 20, description: 'Efectivo USD contado físicamente' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedUsd?: number;

  @ApiPropertyOptional({
    description: 'Desglose por denominación, p. ej. { "1000": 2, "500": 3 }',
    example: { '1000': 2, '500': 3, '100': 5 },
  })
  @IsOptional()
  @IsObject()
  denominations?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Motivo o nota del arqueo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
