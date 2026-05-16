import { IsArray, ValidateNested, IsInt, IsString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(0)
  quantityReceived: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}
