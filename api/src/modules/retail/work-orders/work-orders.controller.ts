import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Work Orders')
@ApiBearerAuth()
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  @RequirePermissions('work-orders:create')
  @ApiOperation({ summary: 'Crear orden de trabajo' })
  create(@Body() dto: CreateWorkOrderDto) {
    return this.workOrdersService.create(dto);
  }

  @Get()
  @RequirePermissions('work-orders:view')
  @ApiOperation({ summary: 'Listar órdenes de trabajo' })
  findAll(@Query() query: QueryWorkOrdersDto) {
    return this.workOrdersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('work-orders:view')
  @ApiOperation({ summary: 'Detalle de orden de trabajo' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workOrdersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('work-orders:edit')
  @ApiOperation({ summary: 'Actualizar orden de trabajo' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkOrderDto) {
    return this.workOrdersService.update(id, dto);
  }

  @Post(':id/assign')
  @RequirePermissions('work-orders:assign')
  @ApiOperation({ summary: 'Asignar usuario a la orden' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignUserDto) {
    return this.workOrdersService.assign(id, dto);
  }

  @Patch(':id/assignments/:assignmentId/start')
  @RequirePermissions('work-orders:edit')
  @ApiOperation({ summary: 'Iniciar trabajo en la asignación' })
  startAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.workOrdersService.startAssignment(id, assignmentId);
  }

  @Patch(':id/assignments/:assignmentId/finish')
  @RequirePermissions('work-orders:edit')
  @ApiOperation({ summary: 'Terminar trabajo en la asignación' })
  finishAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.workOrdersService.finishAssignment(id, assignmentId);
  }
}
