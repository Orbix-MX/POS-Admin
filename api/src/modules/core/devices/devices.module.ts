import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for AuthService (enrollment token sign/verify)
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
