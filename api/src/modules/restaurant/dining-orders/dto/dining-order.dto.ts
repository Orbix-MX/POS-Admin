import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min, MaxLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { DiningServiceType, DiningOrderStatus } from '@prisma/client';

export class OpenDiningOrderDto {
  @IsEnum(DiningServiceType)
  @IsOptional()
  serviceType?: DiningServiceType;

  @ValidateIf((o: OpenDiningOrderDto) => !o.serviceType || o.serviceType === 'DINE_IN')
  @IsString()
  @IsNotEmpty()
  tableId?: string;

  // Etiqueta libre para órdenes sin mesa (Mostrador, Para Llevar, Cliente Juan).
  // En órdenes DINE_IN se genera automáticamente desde el nombre de la mesa.
  @IsString()
  @IsOptional()
  @MaxLength(80)
  reference?: string;
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

export class ChangeDiningStatusDto {
  @IsEnum(DiningOrderStatus)
  status!: DiningOrderStatus;
}

export class CleanupEmptyOrdersDto {
  // Only purge empty OPEN orders older than this many minutes (default 120).
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  olderThanMinutes?: number;
}
