import { IsString, IsOptional, IsEnum, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessVertical, BusinessProfile } from '@prisma/client';
import { SelectTenantResponseDto } from '../../auth/dto/auth-response.dto';

export class CreateTenantOnboardingDto {
  @ApiProperty({ example: 'Mi Tienda' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Owner display name; only applied if the user has none yet' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerName?: string;

  @ApiProperty({ description: 'E.164 phone number' })
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'phone must be a valid E.164 number' })
  phone: string;

  @ApiProperty({ example: 'MX' })
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must be ISO 3166-1 alpha-2' })
  countryCode: string;

  @ApiProperty({ example: 'MXN' })
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be ISO 4217' })
  currency: string;

  @ApiProperty({ example: 'America/Mexico_City' })
  @IsString()
  timezone: string;

  @ApiProperty({ enum: BusinessVertical })
  @IsEnum(BusinessVertical)
  businessVertical: BusinessVertical;

  @ApiProperty({ enum: BusinessProfile })
  @IsEnum(BusinessProfile)
  businessProfile: BusinessProfile;

  @ApiPropertyOptional({ description: 'Catalog id from GET /catalogs/business-types, for analytics only' })
  @IsOptional()
  @IsString()
  businessTypeId?: string;
}

export class OnboardTenantResponseDto extends SelectTenantResponseDto {
  @ApiProperty() branchId: string;
}
