import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomersImportService } from './customers-import.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomersImportService],
  exports: [CustomersService],
})
export class CustomersModule {}
