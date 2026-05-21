import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RefundOrderDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsString()
  refundMethod: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  @IsIn(['MXN', 'USD'])
  currency?: 'MXN' | 'USD';

  @IsOptional()
  @IsBoolean()
  restoreInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  windowOverride?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
