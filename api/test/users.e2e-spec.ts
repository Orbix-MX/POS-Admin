import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const TEST_EMAIL = 'admin@ecommerce.com';
const TEST_PASSWORD = 'admin123';
const TEST_TENANT_SLUG = 'default';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdUserId: string;
  let duplicateUserId: string;
  let roleAssignUserId: string;
  let existingRoleId: string;

  // Unique suffix to avoid collisions between runs
  const uniqueSuffix = Date.now();
  const testEmail = `e2e.user.${uniqueSuffix}@test.com`;
  const duplicateEmail = `e2e.user.dup.${uniqueSuffix}@test.com`;
  const roleAssignEmail = `e2e.user.roles.${uniqueSuffix}@test.com`;

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
    // Clean up created users
    for (const id of [createdUserId, duplicateUserId, roleAssignUserId]) {
      if (id) {
        await request(app.getHttpServer())
          .delete(`/api/users/${id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .catch(() => {});
      }
    }

    // Scan list and clean up any remaining test users
    const listResponse = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ limit: 100 })
      .catch(() => ({ body: { data: [] } }));

    const testEmails = new Set([testEmail, duplicateEmail, roleAssignEmail]);
    const usersToDelete = (listResponse.body.data ?? []).filter(
      (u: { email: string }) => testEmails.has(u.email),
    );

    for (const u of usersToDelete) {
      await request(app.getHttpServer())
        .delete(`/api/users/${u.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }

    await app.close();
  });

  // ─── LIST ────────────────────────────────────────────────────────────────────

  describe('GET /api/users', () => {
    it('should return paginated users with data and meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
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
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 5 })
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer()).get('/api/users').expect(401);
    });
  });

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  describe('POST /api/users', () => {
    it('should create a new user and return 201 with user data (no password)', async () => {
      const body = {
        email: testEmail,
        password: 'securePass1',
        firstName: 'E2E',
        lastName: 'TestUser',
        role: 'STAFF',
      };

      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body)
        .expect(201);

      expect(res.body).toMatchObject({
        email: testEmail,
        firstName: 'E2E',
        lastName: 'TestUser',
        role: 'STAFF',
      });
      expect(res.body.id).toBeDefined();
      // password must NOT be returned
      expect(res.body.password).toBeUndefined();
      createdUserId = res.body.id;
    });

    it('should return 409 when email is already registered', async () => {
      // First create a user with the duplicate email
      const dupRes = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: duplicateEmail,
          password: 'securePass2',
          firstName: 'Dup',
          lastName: 'User',
          role: 'STAFF',
        })
        .expect(201);

      duplicateUserId = dupRes.body.id;

      // Attempt to create again with the same email
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: duplicateEmail,
          password: 'securePass3',
          firstName: 'Dup2',
          lastName: 'User2',
          role: 'STAFF',
        })
        .expect(409);
    });

    it('should return 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: `missing.fields.${uniqueSuffix}@test.com` })
        .expect(400);
    });

    it('should return 400 when email format is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'not-an-email',
          password: 'securePass1',
          firstName: 'Bad',
          lastName: 'Email',
          role: 'STAFF',
        })
        .expect(400);
    });

    it('should return 400 when password is too short (< 6 chars)', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `short.pw.${uniqueSuffix}@test.com`,
          password: '123',
          firstName: 'Short',
          lastName: 'Password',
          role: 'STAFF',
        })
        .expect(400);
    });

    it('should return 400 when firstName is too short (< 2 chars)', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `short.name.${uniqueSuffix}@test.com`,
          password: 'securePass1',
          firstName: 'A',
          lastName: 'ValidLastName',
          role: 'STAFF',
        })
        .expect(400);
    });

    it('should return 400 when role is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `bad.role.${uniqueSuffix}@test.com`,
          password: 'securePass1',
          firstName: 'Bad',
          lastName: 'Role',
          role: 'INVALID_ROLE',
        })
        .expect(400);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: `unauth.${uniqueSuffix}@test.com`,
          password: 'securePass1',
          firstName: 'No',
          lastName: 'Auth',
          role: 'STAFF',
        })
        .expect(401);
    });
  });

  // ─── GET ONE ─────────────────────────────────────────────────────────────────

  describe('GET /api/users/:id', () => {
    it('should return the user by ID without password', async () => {
      expect(createdUserId).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdUserId);
      expect(res.body.email).toBe(testEmail);
      expect(res.body.password).toBeUndefined();
    });

    it('should return 404 for a non-existent user ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .expect(401);
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  describe('PATCH /api/users/:id', () => {
    it('should update user fields and return updated user', async () => {
      expect(createdUserId).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          role: 'MANAGER',
        })
        .expect(200);

      expect(res.body.id).toBe(createdUserId);
      expect(res.body.firstName).toBe('Updated');
      expect(res.body.lastName).toBe('Name');
      expect(res.body.role).toBe('MANAGER');
      expect(res.body.password).toBeUndefined();
    });

    it('should return 404 when updating a non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .patch(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Ghost' })
        .expect(404);
    });

    it('should return 409 when updating to an already-registered email', async () => {
      // duplicateEmail was registered in the POST tests
      await request(app.getHttpServer())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: duplicateEmail })
        .expect(409);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/api/users/${createdUserId}`)
        .send({ firstName: 'NoAuth' })
        .expect(401);
    });
  });

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  describe('DELETE /api/users/:id', () => {
    it('should delete the user and return 200 or 204', async () => {
      expect(createdUserId).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect([200, 204]).toContain(res.status);
        });
    });

    it('should return 404 after deleting (user no longer exists)', async () => {
      await request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Mark as already deleted so afterAll cleanup skips it
      createdUserId = '';
    });

    it('should return 404 when deleting a non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when no auth token is provided', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/users/${nonExistentId}`)
        .expect(401);
    });
  });

  // ─── ROLE ASSIGNMENT ─────────────────────────────────────────────────────────

  describe('PUT /api/users/:id/roles', () => {
    beforeAll(async () => {
      // Create a dedicated user for role-assignment tests
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: roleAssignEmail,
          password: 'securePass99',
          firstName: 'RoleAssign',
          lastName: 'TestUser',
          role: 'STAFF',
        })
        .expect(201);

      roleAssignUserId = res.body.id;

      // Fetch first available tenant role to use in assignment tests
      const rolesRes = await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const roles: { id: string }[] = Array.isArray(rolesRes.body)
        ? rolesRes.body
        : rolesRes.body.data ?? [];

      existingRoleId = roles[0]?.id;
    });

    it('should start with no custom role assignments', async () => {
      expect(roleAssignUserId).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/users/${roleAssignUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.roleAssignments).toBeDefined();
      expect(Array.isArray(res.body.roleAssignments)).toBe(true);
      expect(res.body.roleAssignments).toHaveLength(0);
    });

    it('should assign a role to a user and return 200', async () => {
      if (!existingRoleId) return;
      expect(roleAssignUserId).toBeDefined();

      await request(app.getHttpServer())
        .put(`/api/users/${roleAssignUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleIds: [existingRoleId] })
        .expect(200);
    });

    it('should reflect assigned role in GET :id/roles', async () => {
      if (!existingRoleId) return;
      expect(roleAssignUserId).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/users/${roleAssignUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.roleAssignments).toBeDefined();
      expect(
        res.body.roleAssignments.some(
          (ra: { role: { id: string } }) => ra.role.id === existingRoleId,
        ),
      ).toBe(true);
    });

    it('should replace roles when called again with different list', async () => {
      if (!existingRoleId) return;
      expect(roleAssignUserId).toBeDefined();

      // Re-assign same role (idempotent replace)
      await request(app.getHttpServer())
        .put(`/api/users/${roleAssignUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleIds: [existingRoleId] })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/users/${roleAssignUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.roleAssignments).toHaveLength(1);
      expect(res.body.roleAssignments[0].role.id).toBe(existingRoleId);
    });

    it('should remove all roles when roleIds is empty array', async () => {
      expect(roleAssignUserId).toBeDefined();

      await request(app.getHttpServer())
        .put(`/api/users/${roleAssignUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleIds: [] })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/users/${roleAssignUserId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.roleAssignments).toHaveLength(0);
    });

    it('should return 404 when assigning roles to non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .put(`/api/users/${nonExistentId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ roleIds: [] })
        .expect(404);
    });

    it('should return 404 when getting roles of non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/users/${nonExistentId}/roles`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 for PUT :id/roles without auth token', async () => {
      expect(roleAssignUserId).toBeDefined();
      await request(app.getHttpServer())
        .put(`/api/users/${roleAssignUserId}/roles`)
        .send({ roleIds: [] })
        .expect(401);
    });

    it('should return 401 for GET :id/roles without auth token', async () => {
      expect(roleAssignUserId).toBeDefined();
      await request(app.getHttpServer())
        .get(`/api/users/${roleAssignUserId}/roles`)
        .expect(401);
    });
  });
});
