import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

const PLATFORM_EMAIL = process.env.PLATFORM_ADMIN_EMAIL ?? 'superadmin@platform.com';
const PLATFORM_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD ?? 'superadmin123';

describe('Platform Tenants – Provision (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let platformToken: string;
  let provisionedTenantId: string;

  // Unique per run to avoid slug/email conflicts across test executions
  const suffix = Date.now();
  const testSlug = `test-${suffix}`;
  const testAdminEmail = `admin-${suffix}@admin.com`;

  const payload = {
    tenant: {
      name: 'TEST',
      slug: testSlug,
      plan: 'PRO',
    },
    branch: {
      name: 'Main',
      code: 'MAIN-001',
    },
    adminUser: {
      firstName: 'admin',
      lastName: 'admin',
      email: testAdminEmail,
      password: 'admin123',
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    // Platform login
    const loginRes = await request(app.getHttpServer())
      .post('/api/platform/auth/login')
      .send({ email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD })
      .expect(201);

    platformToken = loginRes.body.accessToken as string;
    expect(platformToken).toBeDefined();
  });

  afterAll(async () => {
    // Delete user first (SetNull on tenant.ownerUserId, Cascade on memberships)
    await prisma.user.deleteMany({ where: { email: testAdminEmail } }).catch(() => {});
    // Delete tenant (Cascade: branches, memberships, roles, userRoleAssignments)
    if (provisionedTenantId) {
      await prisma.tenant.delete({ where: { id: provisionedTenantId } }).catch(() => {});
    }
    await app.close();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────────

  describe('POST /api/platform/tenants/provision', () => {
    it('should provision tenant + branch + admin user and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .set('Authorization', `Bearer ${platformToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.tenant).toMatchObject({
        name: 'TEST',
        slug: testSlug,
        plan: 'PRO',
        status: 'ACTIVE',
      });
      expect(res.body.tenant.id).toBeDefined();

      expect(res.body.branch).toMatchObject({
        name: 'Main',
        code: 'MAIN-001',
        isMain: true,
        status: 'ACTIVE',
      });

      expect(res.body.adminUser).toMatchObject({
        firstName: 'admin',
        lastName: 'admin',
        email: testAdminEmail,
      });
      // Password must never be returned
      expect(res.body.adminUser.password).toBeUndefined();

      provisionedTenantId = res.body.tenant.id as string;
    });

    it('should persist tenant in the database', async () => {
      expect(provisionedTenantId).toBeDefined();
      const tenant = await prisma.tenant.findUnique({ where: { id: provisionedTenantId } });
      expect(tenant).not.toBeNull();
      expect(tenant!.slug).toBe(testSlug);
      expect(tenant!.plan).toBe('PRO');
    });

    it('should persist main branch linked to the tenant', async () => {
      expect(provisionedTenantId).toBeDefined();
      const branch = await prisma.branch.findFirst({
        where: { tenantId: provisionedTenantId, isMain: true },
      });
      expect(branch).not.toBeNull();
      expect(branch!.code).toBe('MAIN-001');
    });

    it('should assign the admin user as tenant owner', async () => {
      expect(provisionedTenantId).toBeDefined();
      const tenant = await prisma.tenant.findUnique({ where: { id: provisionedTenantId } });
      expect(tenant!.ownerUserId).toBeDefined();
      expect(tenant!.ownerUserId).not.toBeNull();
    });

    it('should create a Super Admin role with all permissions for the tenant', async () => {
      expect(provisionedTenantId).toBeDefined();
      const role = await prisma.role.findFirst({
        where: { tenantId: provisionedTenantId, isSystem: true },
        include: { permissions: true },
      });
      expect(role).not.toBeNull();
      expect(role!.name).toBe('Super Admin');
      expect(role!.permissions.length).toBeGreaterThan(0);
    });

    // ─── Conflict cases ────────────────────────────────────────────────────────

    it('should return 409 when slug is already taken', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          ...payload,
          adminUser: { ...payload.adminUser, email: `other-${suffix}@admin.com` },
        })
        .expect(409);
    });

    it('should return 409 when admin email is already registered', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          ...payload,
          tenant: { ...payload.tenant, slug: `other-${suffix}` },
        })
        .expect(409);
    });

    // ─── Validation cases ──────────────────────────────────────────────────────

    it('should return 400 when required nested fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ tenant: { name: 'Incomplete' } })
        .expect(400);
    });

    it('should return 400 when plan is not a valid TenantPlan enum value', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          ...payload,
          tenant: { ...payload.tenant, slug: `plan-bad-${suffix}`, plan: 'INVALID_PLAN' },
        })
        .expect(400);
    });

    it('should return 400 when slug contains uppercase letters', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          ...payload,
          tenant: { ...payload.tenant, slug: `UPPERCASE-${suffix}` },
        })
        .expect(400);
    });

    it('should return 400 when admin password is shorter than 8 characters', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          ...payload,
          tenant: { ...payload.tenant, slug: `pw-short-${suffix}` },
          adminUser: { ...payload.adminUser, email: `pw-short-${suffix}@admin.com`, password: 'short' },
        })
        .expect(400);
    });

    it('should return 400 when admin email format is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          ...payload,
          tenant: { ...payload.tenant, slug: `email-bad-${suffix}` },
          adminUser: { ...payload.adminUser, email: 'not-an-email' },
        })
        .expect(400);
    });

    // ─── Auth guard ────────────────────────────────────────────────────────────

    it('should return 401 when no platform auth token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/platform/tenants/provision')
        .send(payload)
        .expect(401);
    });
  });
});
