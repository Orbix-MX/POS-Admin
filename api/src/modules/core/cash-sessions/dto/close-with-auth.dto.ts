import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CloseCashSessionDto } from './close-session.dto';

export class CloseWithAuthDto extends CloseCashSessionDto {
  @ApiProperty({ example: 'admin@tienda.com', description: 'Email del usuario autorizador' })
  @IsEmail()
  authEmail: string;

  @ApiProperty({ description: 'Contraseña del usuario autorizador' })
  @IsString()
  @MinLength(1)
  authPassword: string;
}
