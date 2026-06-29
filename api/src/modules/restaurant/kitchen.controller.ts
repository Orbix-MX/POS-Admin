import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KitchenService } from './kitchen.service';
import { UpdateKitchenStatusDto } from './dto/update-kitchen-status.dto';
import { UpdateKitchenRoundStatusDto } from './dto/update-kitchen-round-status.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Kitchen')
@ApiBearerAuth()
@Controller('restaurant/kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('orders')
  @RequirePermissions('kitchen:view')
  @ApiOperation({ summary: 'Listar órdenes activas en cocina (KDS) agrupadas por ronda' })
  getKitchenOrders() {
    return this.kitchenService.getKitchenOrders();
  }

  @Patch('orders/:id/status')
  @RequirePermissions('kitchen:manage')
  @ApiOperation({ summary: 'Actualizar estado cocina de una orden' })
  updateKitchenStatus(@Param('id') id: string, @Body() dto: UpdateKitchenStatusDto) {
    return this.kitchenService.updateKitchenStatus(id, dto.status);
  }

  @Patch('rounds/:id/status')
  @RequirePermissions('kitchen:manage')
  @ApiOperation({ summary: 'Marcar ronda como preparada (DONE) para limpiarla del KDS' })
  updateRoundStatus(@Param('id') id: string, @Body() dto: UpdateKitchenRoundStatusDto) {
    return this.kitchenService.updateRoundStatus(id, dto.status);
  }
}
