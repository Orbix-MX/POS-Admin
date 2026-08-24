import { IsOptional, IsString } from 'class-validator';
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.decorator';

export class ChangePasswordDto {
  // Solo requerida si la cuenta ya tiene contraseña — al crearla por primera
  // vez (cuenta de Google sin password) no hay nada contra qué compararla.
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsStrongPassword()
  newPassword: string;
}
