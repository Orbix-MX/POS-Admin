import { Module } from '@nestjs/common';
import { ServiceQuotesService } from './service-quotes.service';
import { ServiceQuotesController } from './service-quotes.controller';
import { QuotePdfService } from './quote-pdf.service';

@Module({
  controllers: [ServiceQuotesController],
  providers: [ServiceQuotesService, QuotePdfService],
  exports: [ServiceQuotesService],
})
export class ServiceQuotesModule {}
