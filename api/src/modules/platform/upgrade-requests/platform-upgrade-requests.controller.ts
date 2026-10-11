import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PlatformUser } from '@prisma/client';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { CurrentPlatformUser } from '../common/decorators/current-platform-user.decorator';
import { PlanUpgradeRequestsService } from '../../core/plans/plan-upgrade-requests.service';
import {
  ListPlanUpgradeRequestsQueryDto,
  ResolvePlanUpgradeRequestDto,
} from '../../core/plans/dto/plan-upgrade-request.dto';

/**
 * Bandeja de solicitudes de "Mejorar plan" para Platform.
 * @odd planes-self-service T-003
 */
@ApiTags('Platform Upgrade Requests')
@ApiBearerAuth()
@Controller('platform/upgrade-requests')
@Public()
@UseGuards(PlatformJwtAuthGuard)
export class PlatformUpgradeRequestsController {
  constructor(private readonly requests: PlanUpgradeRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Solicitudes de mejora (por defecto, las pendientes)' })
  list(@Query() query: ListPlanUpgradeRequestsQueryDto) {
    return this.requests.list(query.status);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Marca una solicitud pendiente como atendida o cancelada' })
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolvePlanUpgradeRequestDto,
    @CurrentPlatformUser() actor: Pick<PlatformUser, 'id'>,
  ) {
    return this.requests.resolve(id, dto.status, actor.id);
  }
}
