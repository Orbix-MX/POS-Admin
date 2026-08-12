import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsEnum, MaxLength, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TableStatus } from '@prisma/client';

export class CreateRestaurantTableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsString()
  @IsNotEmpty()
  areaId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;
}

export class UpdateRestaurantTableDto extends PartialType(CreateRestaurantTableDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;
}
