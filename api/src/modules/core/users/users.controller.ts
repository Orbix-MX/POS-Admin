import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsArray, IsUUID, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { UsersService, PermissionGrantInput } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

class SetRolesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds: string[];
}

class PermissionGrantDto implements PermissionGrantInput {
  @IsUUID('4')
  permissionId: string;

  @IsBoolean()
  granted: boolean;
}

class SetPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantDto)
  grants: PermissionGrantDto[];
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('users:create')
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'Get all users with pagination' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.usersService.findAll(paginationDto);
  }

  @Get('capacity')
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'Plan user capacity for the current tenant' })
  getCapacity() {
    return this.usersService.getCapacity();
  }

  @Patch(':id/activate')
  @RequirePermissions('users:edit')
  @ApiOperation({ summary: 'Activate a user in the current tenant (needs a free seat)' })
  activate(@Param('id') id: string) {
    return this.usersService.setMembershipStatus(id, 'ACTIVE');
  }

  @Patch(':id/deactivate')
  @RequirePermissions('users:edit')
  @ApiOperation({ summary: 'Deactivate a user in the current tenant (keeps history)' })
  deactivate(@Param('id') id: string) {
    return this.usersService.setMembershipStatus(id, 'INACTIVE');
  }

  @Get(':id')
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('users:edit')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  @ApiOperation({ summary: 'Delete user' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Get(':id/roles')
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'Get user roles and permission grants' })
  findOneWithRoles(@Param('id') id: string) {
    return this.usersService.findOneWithRoles(id);
  }

  @Put(':id/roles')
  // Assigning roles is an RBAC change, so it takes the RBAC permission too —
  // `users:edit` alone (e.g. an HR-style role) must not reach it.
  @RequirePermissions('users:edit', 'roles:edit')
  @ApiOperation({ summary: 'Replace all role assignments for a user' })
  @ApiBody({ type: SetRolesDto })
  setRoles(@Param('id') id: string, @Body() body: SetRolesDto) {
    return this.usersService.setRoles(id, body.roleIds);
  }

  @Put(':id/permissions')
  @RequirePermissions('users:edit', 'roles:edit')
  @ApiOperation({ summary: 'Replace all individual permission grants for a user' })
  @ApiBody({ type: SetPermissionsDto })
  setPermissions(@Param('id') id: string, @Body() body: SetPermissionsDto) {
    return this.usersService.setPermissions(id, body.grants);
  }

  @Get(':id/effective-permissions')
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'Get effective permission keys for a user' })
  getEffectivePermissions(@Param('id') id: string) {
    return this.usersService.getEffectivePermissions(id);
  }
}
