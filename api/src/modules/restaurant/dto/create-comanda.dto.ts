import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ComandaItemDto {
  @ApiPropertyOptional({ enum: ['PRODUCT', 'SERVICE'], default: 'PRODUCT' })
  @IsOptional()
  @IsEnum(['PRODUCT', 'SERVICE'])
  itemType?: 'PRODUCT' | 'SERVICE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateComandaDto {
  @ApiProperty({ description: 'Número de mesa', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tableNumber: string;

  @ApiProperty({ description: 'Número de empleado que toma la comanda', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeNumber: string;

  @ApiProperty({ type: [ComandaItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComandaItemDto)
  items: ComandaItemDto[];
}
