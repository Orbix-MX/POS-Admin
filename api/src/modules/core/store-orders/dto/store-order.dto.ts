import {
  IsString,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsEnum,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreWhatsappOrderStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class CreateStoreOrderItemDto {
  @ApiPropertyOptional({ description: 'Id del producto, si sigue existiendo en el catálogo' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateStoreOrderDto {
  @ApiProperty({ description: 'Teléfono de contacto de quien hace el pedido' })
  @IsString()
  @Matches(/^\d{10,15}$/, { message: 'Teléfono inválido' })
  phone: string;

  @ApiProperty({ type: [CreateStoreOrderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateStoreOrderItemDto)
  items: CreateStoreOrderItemDto[];
}

export class UpdateStoreOrderStatusDto {
  @ApiProperty({ enum: StoreWhatsappOrderStatus })
  @IsEnum(StoreWhatsappOrderStatus)
  status: StoreWhatsappOrderStatus;
}

export class QueryStoreOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StoreWhatsappOrderStatus })
  @IsOptional()
  @IsEnum(StoreWhatsappOrderStatus)
  status?: StoreWhatsappOrderStatus;
}
