import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateLayoutDto {
  @ApiProperty({
    description: 'Layout keyed by breakpoint. Each value is an array of GridItem.',
    example: {
      lg: [{ i: 'widget-uuid', x: 0, y: 0, w: 3, h: 2 }],
      md: [{ i: 'widget-uuid', x: 0, y: 0, w: 5, h: 2 }],
    },
  })
  @IsObject()
  layouts: Record<string, unknown[]>;
}
