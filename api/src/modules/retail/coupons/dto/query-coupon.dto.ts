import { IsOptional, IsEnum, IsBoolean, IsString, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CouponType, CouponScope } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

export class QueryCouponDto {
  @ApiPropertyOptional({ example: 'WELCOME' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: CouponType })
  @IsEnum(CouponType)
  @IsOptional()
  type?: CouponType;

  @ApiPropertyOptional({ enum: CouponScope })
  @IsEnum(CouponScope)
  @IsOptional()
  scope?: CouponScope;

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  autoApply?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}
