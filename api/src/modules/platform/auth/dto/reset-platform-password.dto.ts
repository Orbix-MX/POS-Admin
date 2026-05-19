import { IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPlatformPasswordDto {
  @ApiProperty({ example: 'uuid-of-platform-user' })
  @IsUUID()
  userId: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
