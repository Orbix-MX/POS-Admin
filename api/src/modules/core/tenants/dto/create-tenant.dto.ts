import { IsString, IsOptional, IsEnum, IsEmail, IsInt, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantPlan } from '@prisma/client';

export class CreateTenantDto {
  @ApiProperty({ example: 'Mi Tienda' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'mi-tienda', description: 'Unique slug used as subdomain/identifier' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ enum: TenantPlan })
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @ApiPropertyOptional({ description: 'JSON settings: currency, timezone, logo, address...' })
  @IsOptional()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Manual active-user cap overriding the plan default (any plan)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  userLimitOverride?: number;

  /** Owner user — required when creating from super-admin panel */
  @ApiPropertyOptional({ example: 'owner@store.com' })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerFirstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerLastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  ownerPassword?: string;
}
