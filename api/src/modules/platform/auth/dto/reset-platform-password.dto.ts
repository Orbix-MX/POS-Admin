import { IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.decorator';

export class ResetPlatformPasswordDto {
  @ApiProperty({ example: 'uuid-of-platform-user' })
  @IsUUID()
  userId: string;

  @IsStrongPassword()
  newPassword: string;
}
