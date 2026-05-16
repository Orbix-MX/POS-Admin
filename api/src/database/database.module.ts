import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditContextService } from '../common/context/audit-context.service';

@Global()
@Module({
  providers: [AuditContextService, PrismaService],
  exports: [AuditContextService, PrismaService],
})
export class DatabaseModule {}
