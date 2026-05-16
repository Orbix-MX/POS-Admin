import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPermissionsDto {
  @ApiProperty({
    description: 'Permission IDs to assign to the role',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
