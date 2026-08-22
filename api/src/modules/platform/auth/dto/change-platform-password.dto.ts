import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Self-service password change for the signed-in platform user. There is no
 * `userId`: the target is always the caller, taken from the JWT.
 */
export class ChangePlatformPasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
