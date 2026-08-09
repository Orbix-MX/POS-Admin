import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { StorageModule } from '../../../storage/storage.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StorageModule, AuthModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
