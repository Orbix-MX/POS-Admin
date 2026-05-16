import { IsInt, IsString, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class InventoryItemDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsInt() @Min(0) stock: number;
}

export class BulkUpdateInventoryDto {
  @ApiProperty({ type: [InventoryItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryItemDto)
  items: InventoryItemDto[];
}

export class TransferStockDto {
  @ApiProperty() @IsString() toBranchId: string;
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsInt() @Min(1) quantity: number;
}
