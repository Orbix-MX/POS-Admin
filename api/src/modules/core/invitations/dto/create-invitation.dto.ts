import { IsEmail, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiProperty({ example: 'persona@empresa.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Roles que tendrá al aceptar. Se validan al invitar y al aceptar.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
