import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PlanUpgradeRequestStatus, TenantPlan } from '@prisma/client';

/** @odd planes-self-service T-003 */
export class CreatePlanUpgradeRequestDto {
  @ApiProperty({ enum: TenantPlan, example: 'PRO' })
  @IsEnum(TenantPlan)
  plan: TenantPlan;

  @ApiPropertyOptional({ description: 'Comentario para quien atiende la solicitud' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** @odd planes-self-service T-003 */
export class ResolvePlanUpgradeRequestDto {
  @ApiProperty({ enum: ['HANDLED', 'CANCELLED'] })
  @IsIn(['HANDLED', 'CANCELLED'])
  status: 'HANDLED' | 'CANCELLED';
}

/** @odd planes-self-service T-003 */
export class ListPlanUpgradeRequestsQueryDto {
  @ApiPropertyOptional({ enum: PlanUpgradeRequestStatus, default: 'PENDING' })
  @IsOptional()
  @IsEnum(PlanUpgradeRequestStatus)
  status?: PlanUpgradeRequestStatus;
}
