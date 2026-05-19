import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateManualMovementDto {
  @ApiProperty({ enum: ['INCOME', 'EXPENSE'], description: 'INCOME = ingreso, EXPENSE = egreso' })
  @IsEnum(['INCOME', 'EXPENSE'])
  type: 'INCOME' | 'EXPENSE';

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ enum: ['MXN', 'USD'], default: 'MXN' })
  @IsEnum(['MXN', 'USD'])
  @IsOptional()
  currency?: 'MXN' | 'USD';

  @ApiPropertyOptional({ example: 'Fondo inicial extra' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
