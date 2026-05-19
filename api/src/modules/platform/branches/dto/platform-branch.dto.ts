import { IsString, IsOptional, MinLength, IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BranchStatus } from '@prisma/client';

export class CreatePlatformBranchDto {
  @ApiProperty() @IsString() @MinLength(2) name: string;
  @ApiProperty() @IsString() @MinLength(1) code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zipCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
}

export class UpdateBranchStatusDto {
  @ApiProperty({ enum: BranchStatus })
  @IsEnum(BranchStatus)
  status: BranchStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class UpdateBranchLimitsDto {
  @ApiProperty({ description: 'Extra branches on top of plan default (additive)' })
  @IsInt()
  @Min(0)
  extraBranchLimit: number;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
