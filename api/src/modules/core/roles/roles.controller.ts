import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

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
