import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { PlanUpgradeRequestsService } from './plan-upgrade-requests.service';
import { CreatePlanUpgradeRequestDto } from './dto/plan-upgrade-request.dto';

/**
 * "Mejorar plan" desde la app: la empresa en sesión pide un plan de pago.
 * @odd planes-self-service T-003
 */
@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans/upgrade-request')
export class PlanUpgradeRequestsController {
  constructor(private readonly requests: PlanUpgradeRequestsService) {}

  @Get()
  @RequirePermissions('tenant:view')
  @ApiOperation({ summary: 'Solicitud de mejora pendiente de la empresa en sesión (o null)' })
  getPending() {
    return this.requests.getPending();
  }

  @Post()
  @RequirePermissions('tenant:edit')
  @ApiOperation({ summary: 'Pide un plan de pago; actualiza la pendiente si ya hay una' })
  request(@CurrentUser() user: { id: string }, @Body() dto: CreatePlanUpgradeRequestDto) {
    return this.requests.request(user.id, dto.plan, dto.note);
  }
}
