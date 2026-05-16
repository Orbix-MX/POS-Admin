import { IsString, IsOptional, IsArray, ValidateNested, IsInt, IsNumber, Min, IsDateString, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantityOrdered: number;

  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax?: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId: string;

  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
