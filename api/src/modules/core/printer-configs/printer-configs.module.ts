import { Module } from '@nestjs/common';
import { PrinterConfigsController } from './printer-configs.controller';
import { PrinterConfigsService } from './printer-configs.service';
import { QzSigningService } from './qz-signing.service';

@Module({
  controllers: [PrinterConfigsController],
  providers: [PrinterConfigsService, QzSigningService],
  exports: [PrinterConfigsService],
})
export class PrinterConfigsModule {}
