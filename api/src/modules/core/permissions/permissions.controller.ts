import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('roles:view')
  @ApiOperation({ summary: 'Get all permissions grouped by module' })
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get('flat')
  @RequirePermissions('roles:view')
  @ApiOperation({ summary: 'Get all permissions as a flat list' })
  findFlat() {
    return this.permissionsService.findFlat();
  }
}
