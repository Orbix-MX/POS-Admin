import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AdjustStockDto {
  @ApiProperty({ description: 'Positive to add, negative to subtract' })
  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit of the quantity. If different from supply inventoryUnit, auto-converts.' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
