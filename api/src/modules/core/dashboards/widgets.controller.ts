import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AssignWidgetRoleDto } from './dto/assign-widget-role.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { WidgetsService } from './widgets.service';

@ApiTags('Widgets')
@ApiBearerAuth()
@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get(':id')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get widget configuration' })
  findOne(@Param('id') id: string) {
    return this.widgetsService.findOne(id);
  }

  @Get(':id/data')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Fetch widget data via proxied endpoint' })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getData(
    @Param('id') id: string,
    @Query() query: Record<string, string>,
    @Headers('authorization') auth: string | undefined,
  ) {
    return this.widgetsService.getData(id, query, auth);
  }

  @Patch(':id')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Update widget configuration' })
  update(@Param('id') id: string, @Body() dto: UpdateWidgetDto) {
    return this.widgetsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Soft-delete a widget' })
  remove(@Param('id') id: string) {
    return this.widgetsService.remove(id);
  }

  // ── Role management ─────────────────────────────────────────────────────────

  @Get(':id/roles')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'List role assignments for a widget' })
  listRoles(@Param('id') id: string) {
    return this.widgetsService.listWidgetRoles(id);
  }

  @Post(':id/roles')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Assign a role to a widget (upsert)' })
  assignRole(@Param('id') id: string, @Body() dto: AssignWidgetRoleDto) {
    return this.widgetsService.assignWidgetRole(id, dto);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('dashboard:manage')
  @ApiOperation({ summary: 'Remove a role from a widget' })
  removeRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.widgetsService.removeWidgetRole(id, roleId);
  }
}
