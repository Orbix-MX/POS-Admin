import { IsEnum } from 'class-validator';
import { KitchenRoundStatus } from '@prisma/client';

export class UpdateKitchenRoundStatusDto {
  @IsEnum(KitchenRoundStatus)
  status: KitchenRoundStatus;
}
