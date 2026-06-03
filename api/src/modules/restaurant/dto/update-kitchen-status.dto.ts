import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum KitchenOrderStatus {
  PENDING    = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED     = 'PAUSED',
  READY      = 'READY',
  REJECTED   = 'REJECTED',
  DELIVERED  = 'DELIVERED',
}

export class UpdateKitchenStatusDto {
  @ApiProperty({ enum: KitchenOrderStatus })
  @IsEnum(KitchenOrderStatus)
  status: KitchenOrderStatus;

  @ApiPropertyOptional({ maxLength: 500, description: 'Obligatorio si status=REJECTED' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionComment?: string;
}
