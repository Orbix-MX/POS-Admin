import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../../common/guards/require-module.guard';
import { ProductAIService, ProductDraftResponse } from './product-ai.service';
import { ProductDraftRequestDto } from './dto/product-draft-request.dto';

/**
 * `POST /api/ai/products/draft` (§07). Solo propone — la IA nunca escribe
 * en la base de datos. El cliente confirma creando el producto por el
 * endpoint normal `POST /api/products`, con el `aiRequestId` de este
 * borrador si quiere que quede trazado como asistido.
 */
@RequireModule('inventario')
@ApiTags('Products AI')
@Controller('ai/products')
export class ProductAIController {
  constructor(private readonly productAIService: ProductAIService) {}

  @Post('draft')
  @ApiBearerAuth()
  @RequirePermissions('products:create')
  @ApiOperation({ summary: 'Genera un borrador de producto a partir de una descripción en lenguaje natural' })
  draft(@Body() dto: ProductDraftRequestDto): Promise<ProductDraftResponse> {
    return this.productAIService.draft(dto.message);
  }
}
