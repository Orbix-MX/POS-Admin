import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuditContextInterceptor } from './common/interceptors/audit-context.interceptor';

// Core modules — reusable across verticals
import { AuthModule } from './modules/core/auth/auth.module';
import { UsersModule } from './modules/core/users/users.module';
import { PermissionsModule } from './modules/core/permissions/permissions.module';
import { RolesModule } from './modules/core/roles/roles.module';
import { TenantsModule } from './modules/core/tenants/tenants.module';
import { BranchesModule } from './modules/core/branches/branches.module';
import { CustomersModule } from './modules/core/customers/customers.module';
import { CashSessionsModule } from './modules/core/cash-sessions/cash-sessions.module';
import { ReceivablesModule } from './modules/core/receivables/receivables.module';
import { PayablesModule } from './modules/core/payables/payables.module';
import { EmailModule } from './modules/core/email/email.module';
import { DashboardModule } from './modules/core/dashboard/dashboard.module';

// Retail modules — retail/POS vertical
import { CategoriesModule } from './modules/retail/categories/categories.module';
import { ProductsModule } from './modules/retail/products/products.module';
import { OrdersModule } from './modules/retail/orders/orders.module';
import { CouponsModule } from './modules/retail/coupons/coupons.module';
import { SuppliersModule } from './modules/retail/suppliers/suppliers.module';
import { PurchasesModule } from './modules/retail/purchases/purchases.module';
import { ServicesModule } from './modules/retail/services/services.module';
import { ServiceQuotesModule } from './modules/retail/service-quotes/service-quotes.module';

@Module({
  imports: [
    // Infrastructure
    CommonModule,
    ConfigModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Core
    AuthModule,
    UsersModule,
    PermissionsModule,
    RolesModule,
    TenantsModule,
    BranchesModule,
    CustomersModule,
    CashSessionsModule,
    ReceivablesModule,
    PayablesModule,
    EmailModule,
    DashboardModule,

    // Retail
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    CouponsModule,
    SuppliersModule,
    PurchasesModule,
    ServicesModule,
    ServiceQuotesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
  ],
})
export class AppModule {}
