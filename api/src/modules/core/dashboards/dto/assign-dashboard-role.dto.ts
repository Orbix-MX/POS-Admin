import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignDashboardRoleDto {
  @IsString()
  roleId: string;

  @IsBoolean()
  @IsOptional()
  canView?: boolean;

  @IsBoolean()
  @IsOptional()
  canEdit?: boolean;
}
