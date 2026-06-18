import { Module } from '@nestjs/common';
import { LicenseController } from './license.controller';

// LicenseService is provided globally by CommonModule.
@Module({
  controllers: [LicenseController],
})
export class LicenseModule {}
