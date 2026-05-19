import { IsEnum, IsOptional, IsArray, IsString, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus, TenantPlan } from '@prisma/client';

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
}
