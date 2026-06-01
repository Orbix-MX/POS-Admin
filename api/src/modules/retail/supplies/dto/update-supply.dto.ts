import {
  IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min, MinLength, MaxLength,
  ValidateNested, IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupplyStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { SupplyAllowedUnitDto } from './create-supply.dto';

export class UpdateSupplyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

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

  @ApiPropertyOptional({ description: '1 inventoryUnit = N baseUnits' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  conversionFactor?: number;

  @ApiPropertyOptional({ type: [SupplyAllowedUnitDto], description: 'Replaces all additional operational units' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplyAllowedUnitDto)
  allowedUnits?: SupplyAllowedUnitDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional({ enum: SupplyStatus })
  @IsOptional()
  @IsEnum(SupplyStatus)
  status?: SupplyStatus;
}
