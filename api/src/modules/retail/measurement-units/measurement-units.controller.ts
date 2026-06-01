import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MeasurementUnitsService } from './measurement-units.service';

@ApiTags('MeasurementUnits')
@Controller('measurement-units')
export class MeasurementUnitsController {
  constructor(private readonly service: MeasurementUnitsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all measurement units' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get measurement unit by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
