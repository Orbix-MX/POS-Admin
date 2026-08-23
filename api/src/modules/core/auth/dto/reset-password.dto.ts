import { IsStrongPassword } from '../../../../common/validators/is-strong-password.decorator';

export class ResetPasswordDto {
  @IsStrongPassword()
  newPassword: string;
}
