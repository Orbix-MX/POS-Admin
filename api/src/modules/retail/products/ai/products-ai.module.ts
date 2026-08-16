import { Module, OnModuleInit } from '@nestjs/common';
import { AiModule } from '../../../../ai/ai.module';
import { AiSchemaRegistry } from '../../../../ai/schemas/ai-schema.registry';
import { ProductAIController } from './product-ai.controller';
import { ProductAIService } from './product-ai.service';
import { ProductDraftReconciler } from './product-draft.reconciler';
import { productDraftSchema } from './product-draft.schema';

/**
 * Registra el schema de `products.draft` en `AiSchemaRegistry` al arrancar
 * — el schema vive en este módulo (dominio de producto), no en `src/ai/`
 * (plataforma). Ver el comentario de `AiSchemaRegistry.register`.
 */
@Module({
  imports: [AiModule],
  controllers: [ProductAIController],
  providers: [ProductAIService, ProductDraftReconciler],
  exports: [ProductAIService],
})
export class ProductsAiModule implements OnModuleInit {
  constructor(private readonly schemaRegistry: AiSchemaRegistry) {}

  onModuleInit(): void {
    this.schemaRegistry.register({ key: 'products.draft.v1', version: 1, schema: productDraftSchema });
  }
}
