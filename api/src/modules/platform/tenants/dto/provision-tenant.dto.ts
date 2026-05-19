import { Type } from 'class-transformer';
import {
  IsString, IsEmail, IsEnum, IsOptional, IsInt, Min, Max,
  IsArray, ValidateNested, MinLength, MaxLength, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantPlan, TenantStatus } from '@prisma/client';

export class ProvisionTenantInfoDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;

  @ApiProperty({ description: 'URL-safe slug, lowercase letters/numbers/hyphens' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug: string;

  @ApiProperty({ enum: TenantPlan }) @IsEnum(TenantPlan) plan: TenantPlan;

  @ApiPropertyOptional({ enum: TenantStatus, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];
}

export class ProvisionBranchDto {
  @ApiProperty() @IsString() @MinLength(2) name: string;
  @ApiProperty() @IsString() @MinLength(1) code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zipCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}

export class ProvisionAdminUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(2) firstName: string;
  @ApiProperty() @IsString() @MinLength(2) lastName: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
}

export class ProvisionTenantDto {
  @ApiProperty({ type: ProvisionTenantInfoDto })
  @ValidateNested()
  @Type(() => ProvisionTenantInfoDto)
  tenant: ProvisionTenantInfoDto;

  @ApiProperty({ type: ProvisionBranchDto })
  @ValidateNested()
  @Type(() => ProvisionBranchDto)
  branch: ProvisionBranchDto;

  @ApiProperty({ type: ProvisionAdminUserDto })
  @ValidateNested()
  @Type(() => ProvisionAdminUserDto)
  adminUser: ProvisionAdminUserDto;

  @ApiPropertyOptional({ description: 'Trial days (sets status=TRIAL + trialEndsAt)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trialDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
