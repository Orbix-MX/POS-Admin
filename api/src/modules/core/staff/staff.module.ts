import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    DevicesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') as string,
      }),
    }),
  ],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
