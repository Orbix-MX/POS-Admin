import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const TEST_EMAIL = 'admin@ecommerce.com';
const TEST_PASSWORD = 'admin123';
const TEST_TENANT_SLUG = 'default';

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdCustomerId: string;

  // Unique suffix to avoid collisions between runs
  const uniqueSuffix = Date.now();
  const testEmail = `e2e.customer.${uniqueSuffix}@test.com`;
  const duplicateEmail = `e2e.duplicate.${uniqueSuffix}@test.com`;

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
    // Clean up: delete any customers created during tests
    if (createdCustomerId) {
      await request(app.getHttpServer())
        .delete(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {
          // Ignore errors during cleanup (already deleted)
        });
    }

    // Clean up duplicate email customer if it was created
    const listResponse = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ limit: 100 })
      .catch(() => ({ body: { data: [] } }));

    const customersToDelete = (listResponse.body.data ?? []).filter(
      (c: { email: string }) =>
        c.email === duplicateEmail || c.email === testEmail,
    );

    for (const c of customersToDelete) {
      await request(app.getHttpServer())
        .delete(`/api/customers/${c.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }

    await app.close();
  });

  // ─── LIST ────────────────────────────────────────────────────────────────────

  describe('GET /api/customers', () => {
    it('should return paginated customers with data and meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers')
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
        .get('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 5 })
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer()).get('/api/customers').expect(401);
    });
  });

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  describe('POST /api/customers', () => {
    it('should create a new customer and return 201 with customer data', async () => {
      const body = {
        email: testEmail,
        firstName: 'E2E',
        lastName: 'TestUser',
        phone: '+1555000001',
        company: 'Test Co',
        city: 'Testville',
        status: 'ACTIVE',
        type: 'NEW',
      };

      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body)
        .expect(201);

      expect(res.body).toMatchObject({
        email: testEmail,
        firstName: 'E2E',
        lastName: 'TestUser',
        phone: '+1555000001',
        company: 'Test Co',
        city: 'Testville',
        status: 'ACTIVE',
        type: 'NEW',
      });
      expect(res.body.id).toBeDefined();
      createdCustomerId = res.body.id;
    });

    it('should return 409 when email is already registered', async () => {
      // First, create a customer with the duplicate email
      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: duplicateEmail,
          firstName: 'Dup',
          lastName: 'Test',
        })
        .expect(201);

      // Attempt to create the same email again
      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: duplicateEmail,
          firstName: 'Dup2',
          lastName: 'Test2',
        })
        .expect(409);
    });

    it('should return 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'noname@test.com' })
        .expect(400);
    });

    it('should return 400 when email format is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'not-an-email',
          firstName: 'Bad',
          lastName: 'Email',
        })
        .expect(400);
    });

    it('should return 400 when firstName is too short (< 2 chars)', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `short.name.${uniqueSuffix}@test.com`,
          firstName: 'A',
          lastName: 'ValidLastName',
        })
        .expect(400);
    });

    it('should return 400 when unknown fields are sent (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `unknown.fields.${uniqueSuffix}@test.com`,
          firstName: 'Valid',
          lastName: 'Name',
          unknownField: 'should be rejected',
        })
        .expect(400);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .send({
          email: `unauth.${uniqueSuffix}@test.com`,
          firstName: 'No',
          lastName: 'Auth',
        })
        .expect(401);
    });
  });

  // ─── GET ONE ─────────────────────────────────────────────────────────────────

  describe('GET /api/customers/:id', () => {
    it('should return the customer by ID', async () => {
      expect(createdCustomerId).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdCustomerId);
      expect(res.body.email).toBe(testEmail);
    });

    it('should return 404 for a non-existent customer ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/customers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .get(`/api/customers/${createdCustomerId}`)
        .expect(401);
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  describe('PATCH /api/customers/:id', () => {
    it('should update customer fields and return updated customer', async () => {
      expect(createdCustomerId).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          city: 'New City',
          type: 'VIP',
        })
        .expect(200);

      expect(res.body.id).toBe(createdCustomerId);
      expect(res.body.firstName).toBe('Updated');
      expect(res.body.lastName).toBe('Name');
      expect(res.body.city).toBe('New City');
      expect(res.body.type).toBe('VIP');
    });

    it('should return 404 when updating a non-existent customer', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .patch(`/api/customers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Ghost' })
        .expect(404);
    });

    it('should return 409 when updating to an already-registered email', async () => {
      // The duplicateEmail was registered in the POST tests
      await request(app.getHttpServer())
        .patch(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: duplicateEmail })
        .expect(409);
    });

    it('should return 400 when unknown fields are sent', async () => {
      await request(app.getHttpServer())
        .patch(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ unknownField: 'bad' })
        .expect(400);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/customers/${createdCustomerId}`)
        .send({ firstName: 'NoAuth' })
        .expect(401);
    });
  });

  // ─── CREDIT FIELDS ───────────────────────────────────────────────────────────

  describe('Credit fields on POST /api/customers', () => {
    let creditCustomerId: string;

    afterEach(async () => {
      if (creditCustomerId) {
        await request(app.getHttpServer())
          .delete(`/api/customers/${creditCustomerId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .catch(() => {});
        creditCustomerId = '';
      }
    });

    it('should create customer with credit enabled, creditDays and creditLimit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `credit.full.${uniqueSuffix}@test.com`,
          firstName: 'Credit',
          lastName: 'Full',
          hasCredit: true,
          creditDays: 30,
          creditLimit: 5000,
        })
        .expect(201);

      expect(res.body.hasCredit).toBe(true);
      expect(Number(res.body.creditDays)).toBe(30);
      expect(Number(res.body.creditLimit)).toBe(5000);
      creditCustomerId = res.body.id;
    });

    it('should create customer with credit enabled and no creditLimit (optional)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `credit.nolimit.${uniqueSuffix}@test.com`,
          firstName: 'Credit',
          lastName: 'NoLimit',
          hasCredit: true,
          creditDays: 15,
        })
        .expect(201);

      expect(res.body.hasCredit).toBe(true);
      expect(Number(res.body.creditDays)).toBe(15);
      expect(res.body.creditLimit).toBeNull();
      creditCustomerId = res.body.id;
    });

    it('should return 400 when hasCredit=true and creditDays=0', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `credit.zero.${uniqueSuffix}@test.com`,
          firstName: 'Credit',
          lastName: 'ZeroDays',
          hasCredit: true,
          creditDays: 0,
        })
        .expect(400);
    });

    it('should return 400 when hasCredit=true and creditDays omitted (defaults to 0)', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `credit.nodays.${uniqueSuffix}@test.com`,
          firstName: 'Credit',
          lastName: 'NoDays',
          hasCredit: true,
        })
        .expect(400);
    });

    it('should create customer without credit and default creditDays to 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `nocredit.${uniqueSuffix}@test.com`,
          firstName: 'NoCredit',
          lastName: 'Customer',
          hasCredit: false,
        })
        .expect(201);

      expect(res.body.hasCredit).toBe(false);
      expect(Number(res.body.creditDays)).toBe(0);
      expect(res.body.creditLimit).toBeNull();
      creditCustomerId = res.body.id;
    });

    it('should create customer without credit fields and default hasCredit to false', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `nocredit.default.${uniqueSuffix}@test.com`,
          firstName: 'NoCredit',
          lastName: 'Default',
        })
        .expect(201);

      expect(res.body.hasCredit).toBe(false);
      expect(Number(res.body.creditDays)).toBe(0);
      creditCustomerId = res.body.id;
    });
  });

  describe('Credit fields on PATCH /api/customers/:id', () => {
    let creditPatchId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `credit.patch.${Date.now()}@test.com`,
          firstName: 'Patch',
          lastName: 'Credit',
        })
        .expect(201);
      creditPatchId = res.body.id;
    });

    afterEach(async () => {
      if (creditPatchId) {
        await request(app.getHttpServer())
          .delete(`/api/customers/${creditPatchId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .catch(() => {});
      }
    });

    it('should enable credit on existing customer', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/customers/${creditPatchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasCredit: true, creditDays: 45, creditLimit: 10000 })
        .expect(200);

      expect(res.body.hasCredit).toBe(true);
      expect(Number(res.body.creditDays)).toBe(45);
      expect(Number(res.body.creditLimit)).toBe(10000);
    });

    it('should update creditDays and creditLimit independently', async () => {
      // First enable credit
      await request(app.getHttpServer())
        .patch(`/api/customers/${creditPatchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasCredit: true, creditDays: 30 })
        .expect(200);

      // Then update only creditDays
      const res = await request(app.getHttpServer())
        .patch(`/api/customers/${creditPatchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ creditDays: 60 })
        .expect(200);

      expect(Number(res.body.creditDays)).toBe(60);
    });

    it('should disable credit and reset creditDays to 0 and creditLimit to null', async () => {
      // First enable credit
      await request(app.getHttpServer())
        .patch(`/api/customers/${creditPatchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasCredit: true, creditDays: 30, creditLimit: 5000 })
        .expect(200);

      // Then disable
      const res = await request(app.getHttpServer())
        .patch(`/api/customers/${creditPatchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasCredit: false })
        .expect(200);

      expect(res.body.hasCredit).toBe(false);
      expect(Number(res.body.creditDays)).toBe(0);
      expect(res.body.creditLimit).toBeNull();
    });

    it('should return 400 when enabling credit with creditDays=0', async () => {
      await request(app.getHttpServer())
        .patch(`/api/customers/${creditPatchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasCredit: true, creditDays: 0 })
        .expect(400);
    });

    it('should return 400 when enabling credit without providing creditDays (customer has creditDays=0)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/customers/${creditPatchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasCredit: true })
        .expect(400);
    });

    it('should enable credit without creditLimit (limit remains null)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/customers/${creditPatchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hasCredit: true, creditDays: 20 })
        .expect(200);

      expect(res.body.hasCredit).toBe(true);
      expect(Number(res.body.creditDays)).toBe(20);
      expect(res.body.creditLimit).toBeNull();
    });
  });

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  describe('DELETE /api/customers/:id', () => {
    it('should delete the customer and return 200', async () => {
      expect(createdCustomerId).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect([200, 204]).toContain(res.status);
        });
    });

    it('should return customer as INACTIVE after soft-delete', async () => {
      // remove() soft-deletes (status → INACTIVE), findOne still returns the record
      const res = await request(app.getHttpServer())
        .get(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.status).toBe('INACTIVE');
      createdCustomerId = '';
    });

    it('should return 404 when deleting a non-existent customer', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/customers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when no auth token is provided', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/customers/${nonExistentId}`)
        .expect(401);
    });
  });
});
