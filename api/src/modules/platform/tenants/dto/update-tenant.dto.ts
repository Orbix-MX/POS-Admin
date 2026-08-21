import { IsEnum, IsOptional, IsArray, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus, TenantPlan, BusinessVertical, BusinessProfile, PosOperationMode, TenantFeature } from '@prisma/client';

export class UpdateTenantStatusDto {
  @ApiPropertyOptional({ enum: TenantStatus })
  @IsEnum(TenantStatus)
  status: TenantStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class UpdateTenantPlanDto {
  @ApiPropertyOptional({ enum: TenantPlan })
  @IsEnum(TenantPlan)
  plan: TenantPlan;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateTenantModulesDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  enabledModules: string[];
}

export class UpdateTenantLimitsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  userLimitOverride?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Cajas que pueden estar abiertas a la vez en una misma sucursal. Null vuelve al tope del plan.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  cashSessionLimitOverride?: number | null;
}

export class UpdateTenantProfileDto {
  @ApiProperty({ enum: BusinessProfile })
  @IsEnum(BusinessProfile)
  businessProfile: BusinessProfile;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTenantVerticalDto {
  @ApiProperty({ enum: BusinessVertical })
  @IsEnum(BusinessVertical)
  businessVertical: BusinessVertical;

  @ApiProperty({ enum: PosOperationMode })
  @IsEnum(PosOperationMode)
  posOperationMode: PosOperationMode;

  @ApiProperty({ type: [String], enum: TenantFeature })
  @IsArray()
  @IsEnum(TenantFeature, { each: true })
  enabledFeatures: TenantFeature[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
