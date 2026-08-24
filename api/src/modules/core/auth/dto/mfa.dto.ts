import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  mfaTicket: string;

  @IsString()
  @Length(6, 10)
  code: string;
}

export class MfaCodeDto {
  @IsString()
  @Length(6, 10)
  code: string;
}
