import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One line of an item-level refund: which sold line and how many units go back.
 * Quantity is bounded server-side by (sold qty − already refunded qty).
 */
export class RefundLineDto {
  @IsString()
  orderItemId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class RefundOrderDto {
  // Money amount to refund. Optional when `items` are provided (it is then
  // derived from the lines and cross-checked). Required for money-only refunds.
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount?: number;

  @IsString()
  refundMethod: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  @IsIn(['MXN', 'USD'])
  currency?: 'MXN' | 'USD';

  // Item-level refund. When present, inventory is restored for exactly these
  // lines/quantities. When absent, the refund is money-only (no stock movement).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RefundLineDto)
  items?: RefundLineDto[];

  // Deprecated: inventory restoration is now driven by `items`. Kept for
  // backward compatibility with money-only callers; ignored when items are set.
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
