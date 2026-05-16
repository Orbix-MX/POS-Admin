import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const TEST_EMAIL = 'admin@ecommerce.com';
const TEST_PASSWORD = 'admin123';
const TEST_TENANT_SLUG = 'default';

describe('Suppliers (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdSupplierId: string;

  // Unique suffix to avoid collisions between runs
  const uniqueSuffix = Date.now();
  const testEmail = `e2e.supplier.${uniqueSuffix}@test.com`;
  const duplicateEmail = `e2e.supplier.dup.${uniqueSuffix}@test.com`;

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

    // Step 1: Login to get temporary token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(201);

    const tempToken: string = loginResponse.body.accessToken;
    expect(tempToken).toBeDefined();

    // Step 2: Select tenant to get final token
    const tenantResponse = await request(app.getHttpServer())
      .patch(`/api/auth/select-tenant/${TEST_TENANT_SLUG}`)
      .set('Authorization', `Bearer ${tempToken}`)
      .expect(200);

    authToken = tenantResponse.body.accessToken;
    expect(authToken).toBeDefined();
  });

  afterAll(async () => {
    // Clean up: delete any suppliers created during tests
    if (createdSupplierId) {
      await request(app.getHttpServer())
        .delete(`/api/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {
          // Ignore errors during cleanup (already deleted)
        });
    }

    // Clean up any remaining test suppliers by scanning the list
    const listResponse = await request(app.getHttpServer())
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ limit: 100 })
      .catch(() => ({ body: { data: [] } }));

    const suppliersToDelete = (listResponse.body.data ?? []).filter(
      (s: { email: string }) =>
        s.email === duplicateEmail || s.email === testEmail,
    );

    for (const s of suppliersToDelete) {
      await request(app.getHttpServer())
        .delete(`/api/suppliers/${s.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }

    await app.close();
  });

  // ─── LIST ─────────────────────────────────────────────────────────────────────

  describe('GET /api/suppliers', () => {
    it('should return paginated suppliers with data and meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('should respect page and limit query params', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 5 })
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer()).get('/api/suppliers').expect(401);
    });
  });

  // ─── CREATE ───────────────────────────────────────────────────────────────────

  describe('POST /api/suppliers', () => {
    it('should create a new supplier and return 201 with supplier data', async () => {
      const body = {
        name: 'E2E Supplier Co',
        contactName: 'Jane Doe',
        email: testEmail,
        phone: '+1555000002',
        city: 'Supplier City',
        category: 'Electronics',
        paymentTerms: 'NET30',
        status: 'ACTIVE',
      };

      const res = await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body)
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'E2E Supplier Co',
        contactName: 'Jane Doe',
        email: testEmail,
        phone: '+1555000002',
        city: 'Supplier City',
        category: 'Electronics',
        paymentTerms: 'NET30',
        status: 'ACTIVE',
      });
      expect(res.body.id).toBeDefined();
      createdSupplierId = res.body.id;
    });

    it('should return 409 when email is already registered', async () => {
      // First, create a supplier with the duplicate email
      await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Dup Supplier',
          email: duplicateEmail,
        })
        .expect(201);

      // Attempt to create another supplier with the same email
      await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Dup Supplier 2',
          email: duplicateEmail,
        })
        .expect(409);
    });

    it('should return 400 when required fields are missing (no name, no email)', async () => {
      await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ city: 'Somewhere' })
        .expect(400);
    });

    it('should return 400 when email format is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Bad Email Supplier',
          email: 'not-an-email',
        })
        .expect(400);
    });

    it('should return 400 when name is too short (< 2 chars)', async () => {
      await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'X',
          email: `short.name.${uniqueSuffix}@test.com`,
        })
        .expect(400);
    });

    it('should return 400 when unknown fields are sent (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Valid Supplier',
          email: `unknown.fields.${uniqueSuffix}@test.com`,
          unknownField: 'should be rejected',
        })
        .expect(400);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/suppliers')
        .send({
          name: 'No Auth Supplier',
          email: `unauth.${uniqueSuffix}@test.com`,
        })
        .expect(401);
    });
  });

  // ─── GET ONE ──────────────────────────────────────────────────────────────────

  describe('GET /api/suppliers/:id', () => {
    it('should return the supplier by ID', async () => {
      expect(createdSupplierId).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdSupplierId);
      expect(res.body.email).toBe(testEmail);
    });

    it('should return 404 for a non-existent supplier ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/suppliers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .get(`/api/suppliers/${createdSupplierId}`)
        .expect(401);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────────────────

  describe('PATCH /api/suppliers/:id', () => {
    it('should update supplier fields and return updated supplier', async () => {
      expect(createdSupplierId).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Supplier Name',
          city: 'New City',
          paymentTerms: 'NET60',
          status: 'INACTIVE',
        })
        .expect(200);

      expect(res.body.id).toBe(createdSupplierId);
      expect(res.body.name).toBe('Updated Supplier Name');
      expect(res.body.city).toBe('New City');
      expect(res.body.paymentTerms).toBe('NET60');
      expect(res.body.status).toBe('INACTIVE');
    });

    it('should return 404 when updating a non-existent supplier', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .patch(`/api/suppliers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ghost Supplier' })
        .expect(404);
    });

    it('should return 409 when updating to an already-registered email', async () => {
      // The duplicateEmail was registered in the POST tests
      await request(app.getHttpServer())
        .patch(`/api/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: duplicateEmail })
        .expect(409);
    });

    it('should return 400 when unknown fields are sent', async () => {
      await request(app.getHttpServer())
        .patch(`/api/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ unknownField: 'bad' })
        .expect(400);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/suppliers/${createdSupplierId}`)
        .send({ name: 'NoAuth' })
        .expect(401);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────────────────

  describe('DELETE /api/suppliers/:id', () => {
    it('should delete the supplier and return 200', async () => {
      expect(createdSupplierId).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect([200, 204]).toContain(res.status);
        });
    });

    it('should return 200 with INACTIVE status after soft-delete', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/suppliers/${createdSupplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe('INACTIVE');
    });

    it('should return 404 when deleting a non-existent supplier', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/suppliers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when no auth token is provided', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/suppliers/${nonExistentId}`)
        .expect(401);
    });
  });

  // ─── CATEGORY FIELD ───────────────────────────────────────────────────────────

  describe('Guardar y editar con categoría', () => {
    let supplierWithCategoryId: string;
    const categoryEmail = `e2e.supplier.cat.${Date.now()}@test.com`;

    it('should create a supplier with a category name', async () => {
      const body = {
        name: 'Proveedor Con Categoria',
        email: categoryEmail,
        category: 'Electrónicos',
      };

      const res = await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Proveedor Con Categoria');
      expect(res.body.email).toBe(categoryEmail);
      expect(res.body.category).toBe('Electrónicos');

      supplierWithCategoryId = res.body.id;
    });

    it('should update the supplier category', async () => {
      expect(supplierWithCategoryId).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/suppliers/${supplierWithCategoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'Alimentos' })
        .expect(200);

      expect(res.body.id).toBe(supplierWithCategoryId);
      expect(res.body.category).toBe('Alimentos');
    });

    it('should retrieve the supplier with updated category via GET', async () => {
      expect(supplierWithCategoryId).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/suppliers/${supplierWithCategoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(supplierWithCategoryId);
      expect(res.body.category).toBe('Alimentos');
    });

    afterAll(async () => {
      if (supplierWithCategoryId) {
        await request(app.getHttpServer())
          .delete(`/api/suppliers/${supplierWithCategoryId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .catch(() => {});
      }
    });
  });
});
