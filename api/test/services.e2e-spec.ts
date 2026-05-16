import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const TEST_EMAIL = 'admin@ecommerce.com';
const TEST_PASSWORD = 'admin123';
const TEST_TENANT_SLUG = 'default';

describe('Services (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdServiceId: string;

  const suffix = Date.now();

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

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(201);

    const tempToken: string = loginRes.body.accessToken;
    expect(tempToken).toBeDefined();

    const tenantRes = await request(app.getHttpServer())
      .patch(`/api/auth/select-tenant/${TEST_TENANT_SLUG}`)
      .set('Authorization', `Bearer ${tempToken}`)
      .expect(200);

    authToken = tenantRes.body.accessToken;
    expect(authToken).toBeDefined();
  });

  afterAll(async () => {
    // Soft-cleanup: deactivate services created during test
    if (createdServiceId) {
      await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false })
        .catch(() => {});
    }

    // Clean up any lingering test services by name prefix
    const listRes = await request(app.getHttpServer())
      .get('/api/services')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ limit: 200 })
      .catch(() => ({ body: { data: [] } }));

    for (const svc of listRes.body.data ?? []) {
      if ((svc.name as string).includes(`e2e-${suffix}`)) {
        await request(app.getHttpServer())
          .patch(`/api/services/${svc.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ isActive: false })
          .catch(() => {});
      }
    }

    await app.close();
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('GET /api/services → 401 sin token', async () => {
      await request(app.getHttpServer()).get('/api/services').expect(401);
    });

    it('POST /api/services → 401 sin token', async () => {
      await request(app.getHttpServer())
        .post('/api/services')
        .send({ name: 'x', basePrice: 0 })
        .expect(401);
    });
  });

  // ── POST /api/services ────────────────────────────────────────────────────

  describe('POST /api/services', () => {
    it('crea servicio con campos mínimos', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `e2e-${suffix} Reparación PC`,
          basePrice: 350,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: `e2e-${suffix} Reparación PC`,
        basePrice: expect.stringMatching(/^350/),
        hasVariablePrice: false,
        isActive: true,
      });
      expect(res.body.tenantId).toBeDefined();
      createdServiceId = res.body.id;
    });

    it('crea servicio con todos los campos', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `e2e-${suffix} Instalación`,
          description: 'Instalación de software y configuración',
          basePrice: 200,
          estimatedDuration: '3 horas',
          hasVariablePrice: true,
          isActive: true,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: `e2e-${suffix} Instalación`,
        description: 'Instalación de software y configuración',
        estimatedDuration: '3 horas',
        hasVariablePrice: true,
        isActive: true,
      });
    });

    it('rechaza nombre vacío → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '', basePrice: 100 })
        .expect(400);
    });

    it('rechaza basePrice negativo → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `e2e-${suffix} Neg`, basePrice: -50 })
        .expect(400);
    });

    it('rechaza payload sin nombre → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ basePrice: 100 })
        .expect(400);
    });

    it('rechaza payload sin basePrice → 400', async () => {
      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `e2e-${suffix} SinPrecio` })
        .expect(400);
    });

    it('acepta basePrice = 0 (servicio gratuito)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `e2e-${suffix} Gratuito`, basePrice: 0 })
        .expect(201);

      expect(Number(res.body.basePrice)).toBe(0);
    });
  });

  // ── GET /api/services ─────────────────────────────────────────────────────

  describe('GET /api/services', () => {
    it('devuelve lista paginada con data y meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('incluye el servicio recién creado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 200 })
        .expect(200);

      const found = res.body.data.find((s: any) => s.id === createdServiceId);
      expect(found).toBeDefined();
    });

    it('filtra por search (nombre parcial)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: `e2e-${suffix} Reparación` })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.some((s: any) => s.id === createdServiceId),
      ).toBe(true);
    });

    it('filtra isActive=true solo devuelve activos', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ isActive: true, limit: 200 })
        .expect(200);

      expect(res.body.data.every((s: any) => s.isActive === true)).toBe(true);
    });

    it('filtra isActive=false solo devuelve inactivos', async () => {
      // Primero crear uno inactivo
      const inactiveRes = await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `e2e-${suffix} Inactivo`, basePrice: 0, isActive: false })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ isActive: false, limit: 200 })
        .expect(200);

      expect(res.body.data.every((s: any) => s.isActive === false)).toBe(true);
      expect(
        res.body.data.some((s: any) => s.id === inactiveRes.body.id),
      ).toBe(true);
    });

    it('paginación: page=1 limit=2 devuelve máx 2 items', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(2);
    });

    it('búsqueda sin resultados devuelve data vacía', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: `inexistente-xyzabc-${suffix}` })
        .expect(200);

      expect(res.body.data.length).toBe(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  // ── GET /api/services/:id ─────────────────────────────────────────────────

  describe('GET /api/services/:id', () => {
    it('devuelve el servicio por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: createdServiceId,
        name: `e2e-${suffix} Reparación PC`,
      });
    });

    it('devuelve 404 para ID inexistente', async () => {
      await request(app.getHttpServer())
        .get('/api/services/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('devuelve 400 para UUID malformado', async () => {
      await request(app.getHttpServer())
        .get('/api/services/no-es-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer())
        .get(`/api/services/${createdServiceId}`)
        .expect(401);
    });
  });

  // ── PATCH /api/services/:id ───────────────────────────────────────────────

  describe('PATCH /api/services/:id', () => {
    it('actualiza nombre', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `e2e-${suffix} Reparación PC v2` })
        .expect(200);

      expect(res.body.name).toBe(`e2e-${suffix} Reparación PC v2`);
    });

    it('actualiza basePrice', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ basePrice: 500 })
        .expect(200);

      expect(Number(res.body.basePrice)).toBe(500);
    });

    it('actualiza descripción y duración', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Descripción actualizada',
          estimatedDuration: '4 horas',
        })
        .expect(200);

      expect(res.body.description).toBe('Descripción actualizada');
      expect(res.body.estimatedDuration).toBe('4 horas');
    });

    it('activa/desactiva con isActive', async () => {
      const deactivateRes = await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(deactivateRes.body.isActive).toBe(false);

      const activateRes = await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: true })
        .expect(200);

      expect(activateRes.body.isActive).toBe(true);
    });

    it('actualiza hasVariablePrice', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasVariablePrice: true })
        .expect(200);

      expect(res.body.hasVariablePrice).toBe(true);
    });

    it('PATCH con payload vacío no rompe el servicio', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(res.body.id).toBe(createdServiceId);
    });

    it('rechaza basePrice negativo en PATCH → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ basePrice: -1 })
        .expect(400);
    });

    it('404 para ID inexistente', async () => {
      await request(app.getHttpServer())
        .patch('/api/services/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('400 para UUID malformado', async () => {
      await request(app.getHttpServer())
        .patch('/api/services/no-es-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ghost' })
        .expect(400);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer())
        .patch(`/api/services/${createdServiceId}`)
        .send({ name: 'Ghost' })
        .expect(401);
    });
  });

  // ── Aislamiento multi-tenant ──────────────────────────────────────────────

  describe('Aislamiento de tenant', () => {
    it('GET devuelve solo servicios del tenant autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 200 })
        .expect(200);

      // Todos los servicios devueltos deben pertenecer al mismo tenantId
      const tenantIds = [...new Set(res.body.data.map((s: any) => s.tenantId))];
      expect(tenantIds.length).toBeLessThanOrEqual(1);
    });
  });
});
