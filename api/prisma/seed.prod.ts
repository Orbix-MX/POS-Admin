import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { ALL_PERMISSIONS } from '../src/modules/core/permissions/permissions.constants';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Production seed starting...');

  // ============= Platform Super Admin =============
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL;
  const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!platformEmail || !platformPassword) {
    throw new Error(
      'PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD must be set in environment variables',
    );
  }

  const hashedPw = await bcrypt.hash(platformPassword, 12);
  const platformUser = await prisma.platformUser.upsert({
    where: { email: platformEmail },
    update: {},
    create: {
      email: platformEmail,
      password: hashedPw,
      firstName: 'Platform',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Platform super admin:', platformUser.email);

  // ============= Permissions =============
  // All permissions must exist so they can be assigned when tenants provision roles.
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        name: perm.name,
        description: perm.description ?? null,
        module: perm.module,
        action: perm.action,
      },
      create: {
        key: perm.key,
        name: perm.name,
        description: perm.description ?? null,
        module: perm.module,
        action: perm.action,
      },
    });
  }

  console.log(`✅ Permissions upserted: ${ALL_PERMISSIONS.length}`);

  console.log('🎉 Production seed complete.');
  console.log('');
  console.log('  Platform login:');
  console.log(`    email   : ${platformEmail}`);
  console.log('    password: [env PLATFORM_ADMIN_PASSWORD]');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
