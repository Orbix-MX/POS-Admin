import { UserRole, UserStatus, TenantRole, TenantPlan, BusinessVertical, PosOperationMode, TenantFeature } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ enum: UserStatus }) status: UserStatus;
  @ApiProperty() createdAt: Date;
}

export class TenantSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ enum: TenantRole }) memberRole: TenantRole;
  @ApiProperty({ enum: TenantPlan }) plan: TenantPlan;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiPropertyOptional({ description: 'Opaque rotating refresh token (mobile clients).' })
  refreshToken?: string;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
  @ApiPropertyOptional({ type: TenantSummaryDto }) tenant?: TenantSummaryDto;
  @ApiPropertyOptional({ type: [TenantSummaryDto] }) availableTenants?: TenantSummaryDto[];
}

export class RefreshResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ description: 'A new refresh token; the presented one is now revoked.' })
  refreshToken: string;
}

export class UserRoleDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() color?: string;
  @ApiProperty({ type: [String] }) permissions: string[];
}

export class ProfileResponseDto {
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
  @ApiPropertyOptional({ type: TenantSummaryDto }) currentTenant?: TenantSummaryDto;
  @ApiPropertyOptional() currentBranchId?: string;
  @ApiPropertyOptional({ type: [UserRoleDto] }) roles?: UserRoleDto[];
  @ApiPropertyOptional({ type: [String] }) permissions?: string[];
}

export class SelectTenantResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() posOnly: boolean;
  @ApiProperty({ enum: TenantPlan }) plan: TenantPlan;
  @ApiProperty({ type: [String] }) enabledModules: string[];
  @ApiProperty({ enum: BusinessVertical }) businessVertical: BusinessVertical;
  @ApiProperty({ enum: PosOperationMode }) posOperationMode: PosOperationMode;
  @ApiProperty({ type: [String] }) enabledFeatures: TenantFeature[];
  @ApiProperty({ type: TenantSummaryDto }) tenant: TenantSummaryDto;
}

export class CapabilitiesResponseDto {
  @ApiProperty({ enum: TenantPlan }) plan: TenantPlan;
  @ApiProperty({ type: [String] }) enabledModules: string[];
  @ApiProperty({ type: [String] }) effectiveModules: string[];
  @ApiPropertyOptional({ description: 'Max active users; null = unlimited', nullable: true })
  maxUsers: number | null;
  @ApiProperty() activeUsers: number;
  @ApiProperty() overUserLimit: boolean;
  @ApiProperty({ enum: BusinessVertical }) businessVertical: BusinessVertical;
  @ApiProperty({ enum: PosOperationMode }) posOperationMode: PosOperationMode;
  @ApiProperty({ type: [String] }) enabledFeatures: TenantFeature[];
}

export class SelectBranchResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() branchId: string;
}
