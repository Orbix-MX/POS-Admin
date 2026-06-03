import { Module } from '@nestjs/common';
import { MeasurementUnitsService } from './measurement-units.service';
import { MeasurementUnitsController } from './measurement-units.controller';

@Module({
  controllers: [MeasurementUnitsController],
  providers: [MeasurementUnitsService],
  exports: [MeasurementUnitsService],
})
export class MeasurementUnitsModule {}
