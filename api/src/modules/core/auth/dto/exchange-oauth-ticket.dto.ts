import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ExchangeOAuthTicketDto {
  @ApiProperty({
    description: 'Ticket de un solo uso recibido en el redirect del callback de OAuth',
    example: 'a3f1...c9',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64)
  ticket: string;
}
