import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AuditContextService } from '../common/context/audit-context.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Optional() @Inject(AuditContextService) private auditContext?: AuditContextService,
  ) {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    // El canal `query` imprime cada sentencia CON SUS PARÁMETROS: hashes de
    // contraseña, tokenHash de refresh/reset/OAuth/MFA, pinHash de
    // empleados, mfaSecretEnc, correos, direcciones, totales de venta. En
    // producción eso es un volcado continuo de datos sensibles a cualquier
    // destino de logs (proveedor de hosting, agregador, un dev con acceso de
    // lectura). Sin condicionar por entorno, cualquier query lo filtraba.
    super({
      adapter,
      log:
        process.env.NODE_ENV === 'production'
          ? ['warn', 'error']
          : ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    // NOTE: Audit middleware disabled - Prisma $use is no longer supported
    // Audit fields (createdById, updatedById) must be set manually in services
    // this.setupAuditMiddleware();
  }

  // Disabled - Prisma Client no longer supports $use middleware
  // Use Prisma Client Extensions instead if needed
  // private setupAuditMiddleware() {
  //   const userId = this.auditContext?.getUserId();
  //   const auditableModels = ['Customer', 'Category', 'Product', 'Order', 'Coupon'];
  //   // Implementation would require Prisma Client Extensions ($extends)
  // }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key !== 'constructor',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof typeof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      }),
    );
  }
}
