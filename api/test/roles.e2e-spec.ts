import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const TEST_EMAIL = 'admin@ecommerce.com';
const TEST_PASSWORD = 'admin123';
const TEST_TENANT_SLUG = 'default';

describe('Roles & Permissions (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  const uniqueSuffix = Date.now();
  const testRoleName = `E2E Role ${uniqueSuffix}`;
  const testRoleNameDuplicate = `E2E Dup Role ${uniqueSuffix}`;

  let createdRoleId: string;
  let duplicateRoleId: string;
  let flatPermissions: { id: string; key: string; name: string; module: string }[];

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

    // Pre-fetch flat permissions so tests can use real IDs
    const permRes = await request(app.getHttpServer())
      .get('/api/permissions/flat')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    flatPermissions = permRes.body;
    expect(Array.isArray(flatPermissions)).toBe(true);
    expect(flatPermissions.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    // Clean up roles created during tests
    const roleIdsToDelete = [createdRoleId, duplicateRoleId].filter(Boolean);
    for (const id of roleIdsToDelete) {
      await request(app.getHttpServer())
        .delete(`/api/roles/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }

    await app.close();
  });

  // ─── PERMISSIONS ─────────────────────────────────────────────────────────────

  describe('GET /api/permissions', () => {
    it('should return 200 with an array of permission groups, each with module and permissions[]', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const firstGroup = res.body[0];
      expect(firstGroup).toHaveProperty('module');
      expect(firstGroup).toHaveProperty('permissions');
      expect(Array.isArray(firstGroup.permissions)).toBe(true);
      expect(firstGroup.permissions.length).toBeGreaterThan(0);
    });

    it('GET /api/permissions/flat should return 200 with a flat array of permissions including id, key, name, module', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/permissions/flat')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const perm = res.body[0];
      expect(perm).toHaveProperty('id');
      expect(perm).toHaveProperty('key');
      expect(perm).toHaveProperty('name');
      expect(perm).toHaveProperty('module');
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer()).get('/api/permissions').expect(401);
    });
  });

  // ─── GET ALL ROLES ────────────────────────────────────────────────────────────

  describe('GET /api/roles', () => {
    it('should return 200 with an array of roles (no pagination)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer()).get('/api/roles').expect(401);
    });
  });

  // ─── CREATE ROLE ──────────────────────────────────────────────────────────────

  describe('POST /api/roles', () => {
    it('should create a new role and return 201 with role data', async () => {
      const twoPermIds = flatPermissions.slice(0, 2).map((p) => p.id);

      const res = await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: testRoleName,
          description: 'E2E test role',
          color: '#123456',
          permissionIds: twoPermIds,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: testRoleName,
        description: 'E2E test role',
        color: '#123456',
      });
      expect(res.body.id).toBeDefined();
      createdRoleId = res.body.id;
    });

    it('should return 409 when a role with the same name already exists', async () => {
      // Create the duplicate role first
      const createRes = await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: testRoleNameDuplicate })
        .expect(201);

      duplicateRoleId = createRes.body.id;

      // Attempt duplicate
      await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: testRoleNameDuplicate })
        .expect(409);
    });

    it('should return 400 when name is too short (< 2 chars)', async () => {
      await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'X' })
        .expect(400);
    });

    it('should return 400 when name exceeds 50 characters', async () => {
      await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'A'.repeat(51) })
        .expect(400);
    });

    it('should return 400 when permissionIds contains non-UUID values', async () => {
      await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `Invalid Perm Role ${uniqueSuffix}`,
          permissionIds: ['not-a-uuid', 'also-not-uuid'],
        })
        .expect(400);
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/roles')
        .send({ name: `No Auth Role ${uniqueSuffix}` })
        .expect(401);
    });
  });

  // ─── GET ROLE BY ID ───────────────────────────────────────────────────────────

  describe('GET /api/roles/:id', () => {
    it('should return 200 with the role including its permissions', async () => {
      expect(createdRoleId).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/api/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdRoleId);
      expect(res.body.name).toBe(testRoleName);
      expect(res.body).toHaveProperty('permissions');
      expect(Array.isArray(res.body.permissions)).toBe(true);
    });

    it('should return 404 for a non-existent role ID', async () => {
      await request(app.getHttpServer())
        .get('/api/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when no auth token is provided', async () => {
      expect(createdRoleId).toBeDefined();
      await request(app.getHttpServer())
        .get(`/api/roles/${createdRoleId}`)
        .expect(401);
    });
  });

  // ─── UPDATE ROLE ──────────────────────────────────────────────────────────────

  describe('PATCH /api/roles/:id', () => {
    it('should update role fields and return 200 with updated data', async () => {
      expect(createdRoleId).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/api/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated description', color: '#abcdef' })
        .expect(200);

      expect(res.body.id).toBe(createdRoleId);
      expect(res.body.description).toBe('Updated description');
      expect(res.body.color).toBe('#abcdef');
    });

    it('should return 404 when updating a non-existent role', async () => {
      await request(app.getHttpServer())
        .patch('/api/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'ghost' })
        .expect(404);
    });

    it('should return 400 when attempting to rename a system role', async () => {
      // Fetch system roles to find one with isSystem: true
      const rolesRes = await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const systemRole = rolesRes.body.find((r: { isSystem: boolean }) => r.isSystem === true);
      expect(systemRole).toBeDefined();

      await request(app.getHttpServer())
        .patch(`/api/roles/${systemRole.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `Renamed System ${uniqueSuffix}` })
        .expect(400);
    });

    it('should return 401 when no auth token is provided', async () => {
      expect(createdRoleId).toBeDefined();
      await request(app.getHttpServer())
        .patch(`/api/roles/${createdRoleId}`)
        .send({ description: 'no auth' })
        .expect(401);
    });
  });

  // ─── SET PERMISSIONS ──────────────────────────────────────────────────────────

  describe('PUT /api/roles/:id/permissions', () => {
    it('should replace permissions and return 200/204', async () => {
      expect(createdRoleId).toBeDefined();
      const newPermIds = flatPermissions.slice(2, 4).map((p) => p.id);

      const res = await request(app.getHttpServer())
        .put(`/api/roles/${createdRoleId}/permissions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ permissionIds: newPermIds });

      expect([200, 204]).toContain(res.status);
    });

    it('should verify GET /:id reflects the newly assigned permissions', async () => {
      expect(createdRoleId).toBeDefined();
      const newPermIds = flatPermissions.slice(4, 6).map((p) => p.id);

      await request(app.getHttpServer())
        .put(`/api/roles/${createdRoleId}/permissions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ permissionIds: newPermIds })
        .expect((r) => expect([200, 204]).toContain(r.status));

      const getRes = await request(app.getHttpServer())
        .get(`/api/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const assignedIds = getRes.body.permissions.map(
        (rp: { permission: { id: string } }) => rp.permission.id,
      );
      for (const id of newPermIds) {
        expect(assignedIds).toContain(id);
      }
    });

    it('should return 401 when no auth token is provided', async () => {
      expect(createdRoleId).toBeDefined();
      await request(app.getHttpServer())
        .put(`/api/roles/${createdRoleId}/permissions`)
        .send({ permissionIds: [] })
        .expect(401);
    });
  });

  // ─── DELETE ROLE ──────────────────────────────────────────────────────────────

  describe('DELETE /api/roles/:id', () => {
    it('should return 400 when trying to delete a system role', async () => {
      const rolesRes = await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const systemRole = rolesRes.body.find((r: { isSystem: boolean }) => r.isSystem === true);
      expect(systemRole).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/roles/${systemRole.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should delete the created role and return 200 or 204', async () => {
      expect(createdRoleId).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect([200, 204]).toContain(res.status);
        });
    });

    it('should return 404 after deleting (role no longer exists)', async () => {
      await request(app.getHttpServer())
        .get(`/api/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      createdRoleId = '';
    });

    it('should return 401 when no auth token is provided', async () => {
      await request(app.getHttpServer())
        .delete('/api/roles/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });
});
