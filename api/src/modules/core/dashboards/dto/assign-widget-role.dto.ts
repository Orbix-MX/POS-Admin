import { IsString } from 'class-validator';

export class AssignWidgetRoleDto {
  @IsString()
  roleId: string;
}
