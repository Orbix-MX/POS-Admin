import { IsOptional, IsString, IsArray, ValidateNested, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExtraProductItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

export class ConvertQuoteDto {
  @ApiPropertyOptional({ description: 'Método de pago principal' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Productos adicionales a agregar a la venta' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraProductItemDto)
  extraProducts?: ExtraProductItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
