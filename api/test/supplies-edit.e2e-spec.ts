import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const TEST_EMAIL = 'admin@ecommerce.com';
const TEST_PASSWORD = 'admin123';
const TEST_TENANT_SLUG = 'default';

describe('Supplies – EDIT (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let supplyId: string;
  let MU: Record<string, string> = {};

  const suffix = Date.now();

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${authToken}` });

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

    const unitsRes = await http()
      .get('/api/measurement-units')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const units: Array<{ id: string; symbol: string }> = unitsRes.body;
    for (const u of units) MU[u.symbol] = u.id;

    expect(MU['gr']).toBeDefined();
    expect(MU['kg']).toBeDefined();
  });

  afterAll(async () => {
    if (supplyId) {
      await http().delete(`/api/supplies/${supplyId}`).set(auth()).catch(() => {});
    }
    await app.close();
  });

  // ── Prerequisito ─────────────────────────────────────────────────────────────

  describe('Prerequisito: crear insumo con baseUnitId y allowedUnits', () => {
    it('crea insumo con campos de Phase 2 → 201', async () => {
      const res = await http()
        .post('/api/supplies')
        .set(auth())
        .send({
          name: `e2e-${suffix} Harina`,
          sku: `HAR-${suffix}`,
          unit: 'gr',
          baseUnitId: MU.gr,
          allowedUnits: [
            { unitId: MU.kg, conversionFactor: 1000 },
          ],
          stock: 5000,
          minStock: 500,
          cost: 0.012,
          status: 'ACTIVE',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: `e2e-${suffix} Harina`,
        sku: `HAR-${suffix}`,
        unit: 'gr',
        baseUnitId: MU.gr,
        status: 'ACTIVE',
      });
      expect(Number(res.body.stock)).toBe(5000);
      expect(res.body.allowedUnits).toHaveLength(1);
      expect(res.body.allowedUnits[0]).toMatchObject({
        unitId: MU.kg,
        conversionFactor: expect.anything(),
      });
      expect(Number(res.body.allowedUnits[0].conversionFactor)).toBe(1000);

      supplyId = res.body.id;
    });
  });

  // ── PATCH — campos básicos ────────────────────────────────────────────────────

  describe('PATCH /api/supplies/:id — campos básicos', () => {
    it('actualiza nombre → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ name: `e2e-${suffix} Harina Integral` })
        .expect(200);

      expect(res.body.name).toBe(`e2e-${suffix} Harina Integral`);
      expect(res.body.id).toBe(supplyId);
    });

    it('actualiza unidad (unit string) → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ unit: 'gr' })
        .expect(200);

      expect(res.body.unit).toBe('gr');
    });

    it('actualiza minStock y cost → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ minStock: 200, cost: 0.05 })
        .expect(200);

      expect(Number(res.body.minStock)).toBe(200);
      expect(Number(res.body.cost)).toBeCloseTo(0.05, 2);
    });

    it('actualiza stock directamente → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ stock: 8000 })
        .expect(200);

      expect(Number(res.body.stock)).toBe(8000);
    });

    it('cambia status a INACTIVE → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ status: 'INACTIVE' })
        .expect(200);

      expect(res.body.status).toBe('INACTIVE');
    });

    it('actualiza purchaseUnit → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ purchaseUnit: 'kg' })
        .expect(200);

      expect(res.body.purchaseUnit).toBe('kg');
    });
  });

  // ── PATCH — baseUnitId y allowedUnits ────────────────────────────────────────

  describe('PATCH /api/supplies/:id — baseUnitId y allowedUnits', () => {
    it('actualiza baseUnitId solo → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ baseUnitId: MU.gr })
        .expect(200);

      expect(res.body.baseUnitId).toBe(MU.gr);
    });

    it('reemplaza allowedUnits con lista nueva → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({
          allowedUnits: [
            { unitId: MU.kg, conversionFactor: 1000 },
          ],
        })
        .expect(200);

      expect(res.body.allowedUnits).toHaveLength(1);
      expect(res.body.allowedUnits[0].unitId).toBe(MU.kg);
      expect(Number(res.body.allowedUnits[0].conversionFactor)).toBe(1000);
    });

    it('limpia allowedUnits con lista vacía → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ allowedUnits: [] })
        .expect(200);

      expect(res.body.allowedUnits).toHaveLength(0);
    });

    it('restaura allowedUnits con múltiples unidades → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({
          baseUnitId: MU.gr,
          allowedUnits: [
            { unitId: MU.kg, conversionFactor: 1000 },
          ],
        })
        .expect(200);

      expect(res.body.baseUnitId).toBe(MU.gr);
      expect(res.body.allowedUnits).toHaveLength(1);
    });
  });

  // ── PATCH — payload completo (simula frontend) ────────────────────────────────

  describe('PATCH /api/supplies/:id — payload frontend completo', () => {
    it('payload exacto de use-supplies.handleSave con Phase 2 → 200', async () => {
      const res = await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({
          name: `e2e-${suffix} Harina Integral`,
          unit: 'gr',
          baseUnitId: MU.gr,
          allowedUnits: [
            { unitId: MU.kg, conversionFactor: 1000 },
          ],
          purchaseUnit: 'kg',
          stock: 10000,
          minStock: 500,
          cost: 0.012,
          status: 'ACTIVE',
        })
        .expect(200);

      expect(res.body.name).toBe(`e2e-${suffix} Harina Integral`);
      expect(res.body.unit).toBe('gr');
      expect(res.body.baseUnitId).toBe(MU.gr);
      expect(res.body.purchaseUnit).toBe('kg');
      expect(Number(res.body.stock)).toBe(10000);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.allowedUnits).toHaveLength(1);
    });
  });

  // ── PATCH — validaciones de error 400 ────────────────────────────────────────

  describe('PATCH /api/supplies/:id — errores de validación 400', () => {
    it('rechaza campo desconocido → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ unknownField: 'value' })
        .expect(400);
    });

    it('rechaza sku (inmutable) → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ sku: `NEW-${suffix}` })
        .expect(400);
    });

    it('rechaza cost negativo → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ cost: -5 })
        .expect(400);
    });

    it('rechaza minStock negativo → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ minStock: -1 })
        .expect(400);
    });

    it('rechaza stock negativo → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ stock: -10 })
        .expect(400);
    });

    it('rechaza baseUnitId vacío (string vacío) → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ baseUnitId: '' })
        .expect(400);
    });

    it('rechaza allowedUnits sin unitId → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ allowedUnits: [{ conversionFactor: 1000 }] })
        .expect(400);
    });

    it('rechaza allowedUnits con conversionFactor = 0 → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ allowedUnits: [{ unitId: MU.kg, conversionFactor: 0 }] })
        .expect(400);
    });

    it('rechaza allowedUnits con conversionFactor negativo → 400', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .set(auth())
        .send({ allowedUnits: [{ unitId: MU.kg, conversionFactor: -100 }] })
        .expect(400);
    });
  });

  // ── Errores de autenticación / recurso ───────────────────────────────────────

  describe('PATCH /api/supplies/:id — auth y recurso', () => {
    it('404 para insumo inexistente', async () => {
      await http()
        .patch('/api/supplies/00000000-0000-0000-0000-000000000000')
        .set(auth())
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('401 sin token', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}`)
        .send({ name: 'Unauthorized' })
        .expect(401);
    });
  });

  // ── GET — verificar persistencia ─────────────────────────────────────────────

  describe('GET /api/supplies/:id — verificar estado final', () => {
    it('devuelve insumo con datos actualizados, baseUnit y allowedUnits', async () => {
      const res = await http()
        .get(`/api/supplies/${supplyId}`)
        .set(auth())
        .expect(200);

      expect(res.body.id).toBe(supplyId);
      expect(res.body.name).toBe(`e2e-${suffix} Harina Integral`);
      expect(Number(res.body.stock)).toBe(10000);
      expect(Number(res.body.minStock)).toBe(500);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.baseUnitId).toBe(MU.gr);
      expect(res.body.baseUnit).toMatchObject({ id: MU.gr, symbol: 'gr' });
      expect(res.body.allowedUnits).toHaveLength(1);
      expect(res.body.allowedUnits[0].unit).toMatchObject({ id: MU.kg, symbol: 'kg' });
    });
  });

  // ── PATCH :id/stock — ajuste de inventario ───────────────────────────────────

  describe('PATCH /api/supplies/:id/stock — ajuste de inventario', () => {
    it('ajuste positivo suma al stock → 200', async () => {
      const before = await http().get(`/api/supplies/${supplyId}`).set(auth());
      const stockBefore = Number(before.body.stock);

      const res = await http()
        .patch(`/api/supplies/${supplyId}/stock`)
        .set(auth())
        .send({ quantity: 500, notes: 'compra e2e' })
        .expect(200);

      expect(Number(res.body.stock)).toBe(stockBefore + 500);
    });

    it('ajuste negativo resta del stock → 200', async () => {
      const before = await http().get(`/api/supplies/${supplyId}`).set(auth());
      const stockBefore = Number(before.body.stock);

      const res = await http()
        .patch(`/api/supplies/${supplyId}/stock`)
        .set(auth())
        .send({ quantity: -200 })
        .expect(200);

      expect(Number(res.body.stock)).toBe(stockBefore - 200);
    });

    it('401 sin token en ajuste', async () => {
      await http()
        .patch(`/api/supplies/${supplyId}/stock`)
        .send({ quantity: 100 })
        .expect(401);
    });
  });
});
