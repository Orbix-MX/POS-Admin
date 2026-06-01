import {
  IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min, MinLength,
  ValidateNested, IsArray, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplyStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class SupplyAllowedUnitDto {
  @ApiProperty({ description: 'MeasurementUnit id' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  unitId: string;

  @ApiProperty({ description: 'How many base units equals 1 of this unit for this supply' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  conversionFactor: number;
}

export class CreateSupplyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sku: string;

  @ApiProperty({ description: 'Inventory unit symbol: kg, lt, pieza, gr, ml, etc.' })
  @IsString()
  @MinLength(1)
  unit: string;

  @ApiPropertyOptional({ description: 'MeasurementUnit id for the internal base/minimum unit (GR, ML, PIECE)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  baseUnitId?: string;

  @ApiPropertyOptional({ description: 'MeasurementUnit id for the operational/display inventory unit (KG, LT, BOX)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  inventoryUnitId?: string;

  @ApiPropertyOptional({ description: '1 inventoryUnit = N baseUnits (e.g. 1 KG = 1000 GR)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  conversionFactor?: number;

  @ApiPropertyOptional({ type: [SupplyAllowedUnitDto], description: 'Additional operational units (legacy/extended)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplyAllowedUnitDto)
  allowedUnits?: SupplyAllowedUnitDto[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ description: 'Convenience: symbol of the preferred purchase unit' })
  @IsOptional()
  @IsString()
  purchaseUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: SupplyStatus, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(SupplyStatus)
  status?: SupplyStatus;
}
