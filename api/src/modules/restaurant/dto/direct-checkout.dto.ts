import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class DirectCheckoutItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  price: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class DirectCheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectCheckoutItemDto)
  items: DirectCheckoutItemDto[];

  @IsString()
  paymentMethod: string;
}
