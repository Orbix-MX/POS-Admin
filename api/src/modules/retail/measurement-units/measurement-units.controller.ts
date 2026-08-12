import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MeasurementUnitsService } from './measurement-units.service';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('MeasurementUnits')
@ApiBearerAuth()
@Controller('measurement-units')
export class MeasurementUnitsController {
  constructor(private readonly service: MeasurementUnitsService) {}

  @Get()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'List all measurement units' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get measurement unit by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
