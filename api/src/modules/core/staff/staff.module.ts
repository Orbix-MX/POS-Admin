import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule], // for DevicesService.authorizeByToken
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
