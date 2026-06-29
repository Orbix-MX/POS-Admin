import { Module } from '@nestjs/common';
import { ServiceQuotesService } from './service-quotes.service';
import { ServiceQuotesController } from './service-quotes.controller';
import { QuotePdfService } from './quote-pdf.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [ServiceQuotesController],
  providers: [ServiceQuotesService, QuotePdfService],
  exports: [ServiceQuotesService],
})
export class ServiceQuotesModule {}
