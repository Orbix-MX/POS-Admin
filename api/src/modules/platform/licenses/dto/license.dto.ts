import { IsEnum, IsOptional, IsInt, IsString, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantPlan, LicenseStatus } from '@prisma/client';

export class CreateLicenseDto {
  @ApiProperty({ enum: TenantPlan })
  @IsEnum(TenantPlan)
  plan: TenantPlan;

  @ApiPropertyOptional({ enum: LicenseStatus, description: 'Defaults to ACTIVE (or TRIAL when trialDays is set).' })
  @IsOptional()
  @IsEnum(LicenseStatus)
  status?: LicenseStatus;

  @ApiPropertyOptional({ description: 'Creates a TRIAL license expiring in N days.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Explicit expiry (ISO). Omit for perpetual (on-prem/enterprise).' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Max active users; null/omit = plan default.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({ description: 'Max active branches; null/omit = plan default.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number;

  @ApiPropertyOptional({ description: 'Max active devices; null/omit = unlimited.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDevices?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RenewLicenseDto {
  @ApiPropertyOptional({ description: 'Extend from the later of now / current expiry by N days.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  extendDays?: number;

  @ApiPropertyOptional({ description: 'Explicit new expiry (ISO). Wins over extendDays.' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ enum: TenantPlan, description: 'Optional plan change on renewal.' })
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDevices?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SuspendLicenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
