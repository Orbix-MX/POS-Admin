import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyAuthDto {
  @ApiProperty({ example: 'admin@tienda.com' })
  @IsEmail()
  authEmail: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  authPassword: string;
}
