import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.decorator';

/**
 * Self-service password change for the signed-in platform user. There is no
 * `userId`: the target is always the caller, taken from the JWT.
 */
export class ChangePlatformPasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
