import { IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplyStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateSupplyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sku: string;

  @ApiProperty({ description: 'Unit of measure: kg, lt, pieza, gr, ml, etc.' })
  @IsString()
  @MinLength(1)
  unit: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: SupplyStatus, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(SupplyStatus)
  status?: SupplyStatus;
}
