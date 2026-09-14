import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class SendPhoneCodeDto {
  @ApiProperty({ example: '+525512345678', description: 'Teléfono en formato E.164' })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;
}

export class VerifyPhoneCodeDto {
  @ApiProperty({ description: 'El identificador que devolvió send-code' })
  @IsString()
  @MaxLength(64)
  verificationId!: string;

  @ApiProperty({ example: '123456', description: 'Los seis dígitos del SMS' })
  @IsString()
  // Exactamente seis dígitos: cualquier otra cosa es ruido y no merece una
  // consulta a la base ni consumir un intento.
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'El código son seis dígitos' })
  code!: string;
}
