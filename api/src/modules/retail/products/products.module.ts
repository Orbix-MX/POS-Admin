import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsImportService } from './products-import.service';
import { ProductsController } from './products.controller';
import { StorageModule } from '../../../storage/storage.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AiModule } from '../../../ai/ai.module';
import { ProductsAiModule } from './ai/products-ai.module';

@Module({
  // AiModule: ProductsService depende de AiUsageRecorder para trazar el
  // desenlace de un draft del AI Product Assistant al confirmarlo (§07) —
  // ver aiRequestId/aiOutcome en CreateProductDto.
  imports: [StorageModule, InventoryModule, AiModule, ProductsAiModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsImportService],
  exports: [ProductsService],
})
export class ProductsModule {}
