import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'customer-uuid' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['product-uuid-1', 'product-uuid-2'],
    description: 'IDs de productos en el carrito'
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  productIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['category-uuid-1'],
    description: 'IDs de categorías de los productos en el carrito'
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @ApiPropertyOptional({ example: 150.50, description: 'Monto total de la compra' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalAmount?: number;
}
