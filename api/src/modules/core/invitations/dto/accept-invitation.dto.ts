import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.decorator';

/**
 * Datos para aceptar. Solo hacen falta cuando el correo invitado todavía no
 * tiene cuenta: entonces la persona la crea aquí. Si ya la tiene, acepta con su
 * sesión iniciada y este cuerpo va vacío.
 */
export class AcceptInvitationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Solo si la cuenta no existe todavía.' })
  @IsOptional()
  @IsStrongPassword()
  password?: string;
}
