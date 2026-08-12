import { Module } from '@nestjs/common';
import { PrinterConfigsController } from './printer-configs.controller';
import { PrinterConfigsService } from './printer-configs.service';
import { QzSigningService } from './qz-signing.service';
import { CashSessionsModule } from '../cash-sessions/cash-sessions.module';

@Module({
  imports: [CashSessionsModule],
  controllers: [PrinterConfigsController],
  providers: [PrinterConfigsService, QzSigningService],
  exports: [PrinterConfigsService],
})
export class PrinterConfigsModule {}
