import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DiningOrderStatus } from '@prisma/client';

// El KDS opera sobre DiningOrder (fuente única de cocina). Los estados válidos
// los valida DiningOrdersService.changeStatus contra el flujo de cocina:
// SENT_TO_KITCHEN → IN_PREPARATION → READY → DELIVERED.
export class UpdateKitchenStatusDto {
  @ApiProperty({ enum: DiningOrderStatus })
  @IsEnum(DiningOrderStatus)
  status: DiningOrderStatus;
}
