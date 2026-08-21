import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

/**
 * Cuerpo mínimo de las transiciones de caja que pueden requerir respaldo de un
 * supervisor. El PIN solo se usa cuando el usuario de la sesión no tiene el
 * permiso; con permiso propio la petición viaja sin cuerpo.
 */
export class AuthorizePinDto {
  @ApiPropertyOptional({ description: 'PIN del supervisor que autoriza la operación' })
  @IsOptional()
  @IsString()
  @Length(4, 12)
  authorizerPin?: string;
}
