import { IsString, IsOptional, IsBoolean, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BranchStatus } from '@prisma/client';

export class CreateBranchDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ example: 'SUC-01' }) @IsString() code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zipCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() managerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMain?: boolean;
  @ApiPropertyOptional({ enum: BranchStatus })
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;
  @ApiPropertyOptional() @IsOptional() settings?: Record<string, any>;
}
