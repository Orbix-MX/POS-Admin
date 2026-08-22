import { Allow, IsEmail, IsString, IsEnum, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole, MembershipStatus } from '@prisma/client';
import { IsStrongPassword } from '../../../../common/validators/is-strong-password.decorator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @IsStrongPassword()
  password: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({
    enum: MembershipStatus,
    required: false,
    description: 'Per-tenant access status. ACTIVE consumes a plan seat.',
  })
  @Allow()
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
