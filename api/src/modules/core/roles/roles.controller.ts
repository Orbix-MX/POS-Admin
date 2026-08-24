import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Declaradas antes de `:id` a propósito: NestJS matchea las rutas de un
  // controller en el orden en que se declaran, y `GET /roles/:id` capturaría
  // `GET /roles/templates` (con id="templates") si fuera declarada primero.
  @Get('templates')
  @RequirePermissions('roles:view')
  @ApiOperation({ summary: 'Plantillas de rol disponibles para el vertical del tenant' })
  listTemplates(@Query() query: ListTemplatesDto) {
    return this.rolesService.listTemplates(query.vertical);
  }

  @Post('templates/:key/apply')
  @RequirePermissions('roles:create')
  @ApiOperation({ summary: 'Crea un rol nuevo a partir de una plantilla' })
  applyTemplate(@Param('key') key: string) {
    return this.rolesService.applyTemplate(key);
  }

  @Get()
  @RequirePermissions('roles:view')
  @ApiOperation({ summary: 'Get all roles with permission and user counts' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @RequirePermissions('roles:create')
  @ApiOperation({ summary: 'Create a new role' })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get(':id')
  @RequirePermissions('roles:view')
  @ApiOperation({ summary: 'Get role by ID with full permissions list' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('roles:edit')
  @ApiOperation({ summary: 'Update a role' })
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @RequirePermissions('roles:delete')
  @ApiOperation({ summary: 'Delete a role (not allowed for system roles)' })
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Put(':id/permissions')
  @RequirePermissions('roles:edit')
  @ApiOperation({ summary: 'Replace all permissions for a role' })
  setPermissions(
    @Param('id') id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.rolesService.setPermissions(id, assignPermissionsDto.permissionIds);
  }
}
