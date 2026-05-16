import { IsNumber, Min, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenCashSessionDto {
  @ApiProperty({ example: 19.45, description: 'Tipo de cambio USD/MXN para esta sesión' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  exchangeRateUsdMxn: number;

  @ApiProperty({ example: 500, description: 'Fondo inicial en MXN' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingAmount: number;

  @ApiPropertyOptional({ example: 20, description: 'Fondo inicial en USD' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingAmountUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}
