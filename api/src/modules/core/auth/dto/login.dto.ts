import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    example: 'my-store',
    description: 'Tenant slug. Required when the user belongs to multiple tenants.',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
