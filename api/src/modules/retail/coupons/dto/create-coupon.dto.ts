import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsBoolean, IsArray, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponType, CouponScope, CustomerType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'Descuento de bienvenida' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: CouponType, example: 'PERCENTAGE' })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({ example: 10, description: 'Valor del descuento (porcentaje o monto fijo)' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ enum: CouponScope, example: 'GLOBAL' })
  @IsEnum(CouponScope)
  scope: CouponScope;

  @ApiPropertyOptional({ example: 'uuid-product-id', description: 'ID del producto (si scope=PRODUCT)' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ example: 'uuid-category-id', description: 'ID de la categoría (si scope=CATEGORY)' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: false, description: 'Auto-aplicar en checkout' })
  @IsBoolean()
  @IsOptional()
  autoApply?: boolean;

  @ApiPropertyOptional({
    type: [String],
    enum: CustomerType,
    example: ['NEW', 'VIP'],
    description: 'Tipos de clientes elegibles'
  })
  @IsArray()
  @IsEnum(CustomerType, { each: true })
  @IsOptional()
  customerTypes?: CustomerType[];

  @ApiPropertyOptional({ example: true, description: 'Solo primera compra' })
  @IsBoolean()
  @IsOptional()
  isFirstPurchaseOnly?: boolean;

  @ApiPropertyOptional({ example: 5, description: 'Mínimo de órdenes del cliente' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrders?: number;

  @ApiPropertyOptional({ example: 100, description: 'Compra mínima requerida' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPurchase?: number;

  @ApiPropertyOptional({ example: 50, description: 'Descuento máximo (para porcentajes)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxDiscount?: number;

  @ApiPropertyOptional({ example: 100, description: 'Límite total de usos' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @ApiPropertyOptional({ example: 1, description: 'Límite de usos por cliente' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  usageLimitPerCustomer?: number;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', description: 'Fecha de inicio' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59Z', description: 'Fecha de fin' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: true, description: 'Cupón activo' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
