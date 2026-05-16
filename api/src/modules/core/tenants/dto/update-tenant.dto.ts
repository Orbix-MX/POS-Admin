import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TenantStatus } from '@prisma/client';
import { CreateTenantDto } from './create-tenant.dto';

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
