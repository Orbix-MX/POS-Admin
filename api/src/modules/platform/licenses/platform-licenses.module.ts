import { Module } from '@nestjs/common';
import { PlatformLicensesController } from './platform-licenses.controller';

// LicenseService is provided globally by CommonModule.
@Module({
  controllers: [PlatformLicensesController],
})
export class PlatformLicensesModule {}
