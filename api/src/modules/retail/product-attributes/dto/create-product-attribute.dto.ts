import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAttributeType } from '@prisma/client';

export class CreateProductAttributeDto {
  @ApiProperty({ description: 'Nombre visible, ej. "Talla", "Color", "Tipo"' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ enum: ProductAttributeType, default: 'TEXT' })
  @IsOptional()
  @IsEnum(ProductAttributeType)
  type?: ProductAttributeType;

  @ApiPropertyOptional({ type: [String], description: 'Opciones predefinidas cuando type = SELECT' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
