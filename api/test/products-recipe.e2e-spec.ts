import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const TEST_EMAIL = 'admin@ecommerce.com';
const TEST_PASSWORD = 'admin123';
const TEST_TENANT_SLUG = 'default';

describe('Products – RECIPE (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  let supplyId: string;
  let supply2Id: string;
  let recipeProductId: string;
  let simpleProductId: string;
  let comboProductId: string;

  const suffix = Date.now();

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${authToken}` });

  // ── Setup / Teardown ─────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    // Auth
    const loginRes = await http()
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(201);

    const tenantRes = await http()
      .patch(`/api/auth/select-tenant/${TEST_TENANT_SLUG}`)
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);

    authToken = tenantRes.body.accessToken;
    expect(authToken).toBeDefined();
  });

  afterAll(async () => {
    // Cleanup: delete products and supplies created during test
    for (const id of [comboProductId, recipeProductId, simpleProductId]) {
      if (id) {
        await http().delete(`/api/products/${id}`).set(auth()).catch(() => {});
      }
    }
    for (const id of [supplyId, supply2Id]) {
      if (id) {
        await http().delete(`/api/supplies/${id}`).set(auth()).catch(() => {});
      }
    }
    await app.close();
  });

  // ── Prerequisito: insumos ────────────────────────────────────────────────────

  describe('Prerequisito: crear insumos', () => {
    it('crea insumo principal con stock suficiente', async () => {
      const res = await http()
        .post('/api/supplies')
        .set(auth())
        .send({
          name: `e2e-${suffix} Barbacoa`,
          sku: `BAR-${suffix}`,
          unit: 'kg',
          stock: 10,
          minStock: 1,
          cost: 80,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: `e2e-${suffix} Barbacoa`,
        unit: 'kg',
      });
      supplyId = res.body.id;
    });

    it('crea insumo secundario', async () => {
      const res = await http()
        .post('/api/supplies')
        .set(auth())
        .send({
          name: `e2e-${suffix} Tortilla`,
          sku: `TOR-${suffix}`,
          unit: 'pieza',
          stock: 100,
          cost: 2,
        })
        .expect(201);

      supply2Id = res.body.id;
      expect(supply2Id).toBeDefined();
    });
  });

  // ── POST /api/products — tipo RECIPE ─────────────────────────────────────────

  describe('POST /api/products (type=RECIPE)', () => {
    it('crea producto RECIPE con recipeItems → 201', async () => {
      const res = await http()
        .post('/api/products')
        .set(auth())
        .send({
          type: 'RECIPE',
          sku: `TBCC-${suffix}`,
          name: `e2e-${suffix} Taco de Barbacoa`,
          description: 'Taco artesanal',
          price: 50,
          comparePrice: 0,
          costPrice: 16,
          status: 'ACTIVE',
          stock: 0,
          trackInventory: false,
          lowStockAlert: 0,
          metaTitle: '',
          metaDescription: '',
          taxRate: 16,
          taxCode: 'IVA_16',
          recipeItems: [
            { supplyId, quantity: 0.2, unit: 'kg' },
            { supplyId: supply2Id, quantity: 2, unit: 'pieza' },
          ],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        type: 'RECIPE',
        sku: `TBCC-${suffix}`,
        name: `e2e-${suffix} Taco de Barbacoa`,
        trackInventory: false,
      });

      // La receta debe estar embebida en la respuesta
      expect(res.body.recipe).toBeDefined();
      expect(res.body.recipe).not.toBeNull();
      expect(Array.isArray(res.body.recipe.items)).toBe(true);
      expect(res.body.recipe.items).toHaveLength(2);

      const item = res.body.recipe.items.find((i: any) => i.supplyId === supplyId);
      expect(item).toBeDefined();
      expect(Number(item.quantity)).toBeCloseTo(0.2, 3);
      expect(item.unit).toBe('kg');

      recipeProductId = res.body.id;
    });

    it('rechaza payload con campo "recipe" (objeto) en lugar de "recipeItems" → 400', async () => {
      const res = await http()
        .post('/api/products')
        .set(auth())
        .send({
          type: 'RECIPE',
          sku: `BAD-${suffix}`,
          name: `e2e-${suffix} Bad`,
          price: 10,
          taxCode: 'IVA_16',
          recipe: { items: [{ supplyId, quantity: 0.1, unit: 'kg' }] },
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/recipe.*should not exist/i)]),
      );
    });

    it('rechaza recipeItem con quantity = 0 → 400', async () => {
      await http()
        .post('/api/products')
        .set(auth())
        .send({
          type: 'RECIPE',
          sku: `ZERO-${suffix}`,
          name: `e2e-${suffix} Zero`,
          price: 10,
          taxCode: 'IVA_16',
          recipeItems: [{ supplyId, quantity: 0, unit: 'kg' }],
        })
        .expect(400);
    });

    it('rechaza recipeItem con supplyId no-UUID → 400', async () => {
      await http()
        .post('/api/products')
        .set(auth())
        .send({
          type: 'RECIPE',
          sku: `UUID-${suffix}`,
          name: `e2e-${suffix} BadUUID`,
          price: 10,
          taxCode: 'IVA_16',
          recipeItems: [{ supplyId: 'no-es-uuid', quantity: 0.5, unit: 'kg' }],
        })
        .expect(400);
    });

    it('401 sin token', async () => {
      await http()
        .post('/api/products')
        .send({ type: 'RECIPE', sku: 'X', name: 'X', price: 1, taxCode: 'IVA_16' })
        .expect(401);
    });
  });

  // ── GET /api/products/:id — verifica receta persistida ──────────────────────

  describe('GET /api/products/:id (RECIPE)', () => {
    it('devuelve producto con recipe.items poblados', async () => {
      const res = await http()
        .get(`/api/products/${recipeProductId}`)
        .set(auth())
        .expect(200);

      expect(res.body.id).toBe(recipeProductId);
      expect(res.body.type).toBe('RECIPE');
      expect(res.body.recipe).not.toBeNull();
      expect(res.body.recipe.items.length).toBeGreaterThanOrEqual(1);

      for (const item of res.body.recipe.items) {
        expect(item.supplyId).toBeDefined();
        expect(Number(item.quantity)).toBeGreaterThan(0);
      }
    });
  });

  // ── GET /api/products/:id/recipe ─────────────────────────────────────────────

  describe('GET /api/products/:id/recipe', () => {
    it('devuelve la receta con supply embebido', async () => {
      const res = await http()
        .get(`/api/products/${recipeProductId}/recipe`)
        .set(auth())
        .expect(200);

      expect(res.body).toMatchObject({
        productId: recipeProductId,
        items: expect.any(Array),
      });
      expect(res.body.items.length).toBe(2);

      const supplyItem = res.body.items.find((i: any) => i.supplyId === supplyId);
      expect(supplyItem.supply).toBeDefined();
      expect(supplyItem.supply.name).toBe(`e2e-${suffix} Barbacoa`);
    });

    it('404 para producto RECIPE inexistente', async () => {
      await http()
        .get('/api/products/00000000-0000-0000-0000-000000000000/recipe')
        .set(auth())
        .expect(404);
    });
  });

  // ── PUT /api/products/:id/recipe — actualizar receta ────────────────────────

  describe('PUT /api/products/:id/recipe', () => {
    it('reemplaza los items de receta', async () => {
      const res = await http()
        .put(`/api/products/${recipeProductId}/recipe`)
        .set(auth())
        .send({
          items: [{ supplyId, quantity: 0.3, unit: 'kg' }],
          notes: 'Solo barbacoa',
        })
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(Number(res.body.items[0].quantity)).toBeCloseTo(0.3, 3);
      expect(res.body.notes).toBe('Solo barbacoa');
    });

    it('GET confirma que receta fue actualizada', async () => {
      const res = await http()
        .get(`/api/products/${recipeProductId}/recipe`)
        .set(auth())
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(Number(res.body.items[0].quantity)).toBeCloseTo(0.3, 3);
    });
  });

  // ── PATCH /api/products/:id — actualización con recipeItems ─────────────────

  describe('PATCH /api/products/:id (RECIPE)', () => {
    it('actualiza precio y sincroniza recipeItems en un solo PATCH', async () => {
      const res = await http()
        .patch(`/api/products/${recipeProductId}`)
        .set(auth())
        .send({
          price: 65,
          recipeItems: [
            { supplyId, quantity: 0.25, unit: 'kg' },
            { supplyId: supply2Id, quantity: 3, unit: 'pieza' },
          ],
        })
        .expect(200);

      expect(Number(res.body.price)).toBeCloseTo(65, 1);
      expect(res.body.recipe.items).toHaveLength(2);
    });

    it('rechaza campo "recipe" en PATCH → 400', async () => {
      const res = await http()
        .patch(`/api/products/${recipeProductId}`)
        .set(auth())
        .send({ recipe: { items: [] } })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/recipe.*should not exist/i)]),
      );
    });
  });

  // ── Productos SIMPLE y COMBO (flujo de combo referencia a simple) ────────────

  describe('COMBO: producto hijo SIMPLE + padre COMBO', () => {
    it('crea producto SIMPLE (hijo del combo)', async () => {
      const res = await http()
        .post('/api/products')
        .set(auth())
        .send({
          type: 'SIMPLE',
          sku: `SIMP-${suffix}`,
          name: `e2e-${suffix} Refresco`,
          price: 20,
          taxCode: 'IVA_16',
          stock: 50,
          trackInventory: true,
          lowStockAlert: 5,
        })
        .expect(201);

      simpleProductId = res.body.id;
      expect(simpleProductId).toBeDefined();
      expect(res.body.type).toBe('SIMPLE');
      expect(res.body.trackInventory).toBe(true);
    });

    it('crea producto COMBO con comboItems → 201', async () => {
      const res = await http()
        .post('/api/products')
        .set(auth())
        .send({
          type: 'COMBO',
          sku: `COMB-${suffix}`,
          name: `e2e-${suffix} Combo Taco+Refresco`,
          price: 65,
          taxCode: 'IVA_16',
          comboItems: [
            { childProductId: recipeProductId, quantity: 1 },
            { childProductId: simpleProductId, quantity: 1 },
          ],
        })
        .expect(201);

      expect(res.body.type).toBe('COMBO');
      expect(res.body.trackInventory).toBe(false);
      expect(Array.isArray(res.body.comboItems)).toBe(true);
      expect(res.body.comboItems).toHaveLength(2);

      comboProductId = res.body.id;
    });

    it('GET /api/products/:id/combo-items devuelve hijos con datos', async () => {
      const res = await http()
        .get(`/api/products/${comboProductId}/combo-items`)
        .set(auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const child = res.body.find((i: any) => i.childProductId === recipeProductId);
      expect(child).toBeDefined();
      expect(child.child.name).toBe(`e2e-${suffix} Taco de Barbacoa`);
    });
  });

  // ── PATCH stock: solo SIMPLE ──────────────────────────────────────────────────

  describe('PATCH /api/products/:id/stock', () => {
    it('ajusta stock de producto SIMPLE', async () => {
      const res = await http()
        .patch(`/api/products/${simpleProductId}/stock`)
        .set(auth())
        .send({ quantity: 10 })
        .expect(200);

      expect(Number(res.body.stock)).toBe(60);
    });

    it('rechaza ajuste de stock en producto RECIPE → 400', async () => {
      await http()
        .patch(`/api/products/${recipeProductId}/stock`)
        .set(auth())
        .send({ quantity: 5 })
        .expect(400);
    });

    it('rechaza stock negativo resultante → 400', async () => {
      await http()
        .patch(`/api/products/${simpleProductId}/stock`)
        .set(auth())
        .send({ quantity: -9999 })
        .expect(400);
    });
  });
});
