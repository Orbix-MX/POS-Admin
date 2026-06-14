import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { DiningServiceType } from '@prisma/client';

export class OpenDiningOrderDto {
  @IsEnum(DiningServiceType)
  @IsOptional()
  serviceType?: DiningServiceType;

  @ValidateIf((o: OpenDiningOrderDto) => !o.serviceType || o.serviceType === 'DINE_IN')
  @IsString()
  @IsNotEmpty()
  tableId?: string;
}

export class AddDiningItemDto {
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateDiningItemDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}
