import {
  IsString, IsOptional, IsUUID, IsArray, ValidateNested,
  IsNumber, Min, MaxLength, IsNotEmpty, IsDateString, IsEnum, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceQuoteItemDto {
  @ApiPropertyOptional({ enum: ['PRODUCT', 'SERVICE'], default: 'SERVICE' })
  @IsOptional()
  @IsEnum(['PRODUCT', 'SERVICE'])
  itemType?: 'PRODUCT' | 'SERVICE';

  /** Requerido si itemType = PRODUCT */
  @ApiPropertyOptional({ description: 'ID del producto (requerido si itemType=PRODUCT)' })
  @ValidateIf((o) => o.itemType === 'PRODUCT')
  @IsNotEmpty()
  @IsUUID()
  productId?: string;

  /** Opcional si itemType = SERVICE */
  @ApiPropertyOptional({ description: 'ID del servicio del catálogo (opcional)' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({ example: 'Reparación de pantalla' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateServiceQuoteDto {
  @ApiProperty({ description: 'ID del cliente' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ type: [CreateServiceQuoteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceQuoteItemDto)
  items: CreateServiceQuoteItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
