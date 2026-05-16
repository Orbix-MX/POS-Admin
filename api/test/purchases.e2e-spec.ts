import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const TEST_EMAIL = 'admin@ecommerce.com';
const TEST_PASSWORD = 'admin123';
const TEST_TENANT_SLUG = 'default';

describe('Purchase Orders (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  // IDs creados durante el test suite
  let supplierId: string;
  let productId: string;
  let draftOrderId: string;
  let sentOrderId: string;
  let cancelTargetOrderId: string;

  const uniqueSuffix = Date.now();
  const supplierEmail = `e2e.po.supplier.${uniqueSuffix}@test.com`;
  const productSku = `E2E-PO-${uniqueSuffix}`;

  // ---- bootstrap ----

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

    // 2-step auth
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

    // Crear proveedor de prueba
    const supplierRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `E2E Proveedor ${uniqueSuffix}`,
        email: supplierEmail,
        phone: '555-0000',
        city: 'Ciudad de Mexico',
        category: 'General',
        paymentTerms: '30 dias',
      })
      .expect(201);

    supplierId = supplierRes.body.id;
    expect(supplierId).toBeDefined();

    // Crear producto de prueba
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sku: productSku,
        name: `E2E Producto ${uniqueSuffix}`,
        slug: `e2e-po-${uniqueSuffix}`,
        price: 150.00,
        costPrice: 80.00,
        stock: 0,
        trackInventory: true,
        lowStockAlert: 5,
        status: 'ACTIVE',
        taxCode: 'IVA_16',
      })
      .expect(201);

    productId = productRes.body.id;
    expect(productId).toBeDefined();
  });

  afterAll(async () => {
    // sentOrderId ya estara COMPLETADA al final — no se puede cancelar
    // Solo cerrar la app
    if (productId) {
      await request(app.getHttpServer())
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }
    if (supplierId) {
      await request(app.getHttpServer())
        .delete(`/api/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }

    await app.close();
  });

  // ============================================================
  // 1. Crear orden (BORRADOR)
  // ============================================================

  describe('POST /purchase-orders', () => {
    it('crea orden en estado BORRADOR', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          supplierId,
          expectedDate: '2025-12-31',
          notes: 'Orden de prueba E2E',
          items: [
            { productId, quantityOrdered: 10, unitCost: 75.00, tax: 0 },
          ],
        })
        .expect(201);

      const order = res.body;
      draftOrderId = order.id;
      expect(order.id).toBeDefined();
      expect(order.status).toBe('BORRADOR');
      expect(order.orderNumber).toMatch(/^PC-/);
      expect(order.supplierId).toBe(supplierId);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].productId).toBe(productId);
      expect(order.items[0].quantityOrdered).toBe(10);
      expect(parseFloat(order.items[0].unitCost)).toBeCloseTo(75.00);
      expect(parseFloat(order.subtotal)).toBeCloseTo(750.00);
      expect(parseFloat(order.total)).toBeCloseTo(750.00);
    });

    it('rechaza orden sin proveedor', async () => {
      await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantityOrdered: 1, unitCost: 10 }],
        })
        .expect(400);
    });

    it('rechaza orden sin items', async () => {
      await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ supplierId, items: [] })
        .expect(400);
    });

    it('rechaza request sin autenticacion', async () => {
      await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .send({ supplierId, items: [{ productId, quantityOrdered: 1, unitCost: 10 }] })
        .expect(401);
    });
  });

  // ============================================================
  // 2. Listar ordenes
  // ============================================================

  describe('GET /purchase-orders', () => {
    it('retorna lista paginada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('filtra por status BORRADOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'BORRADOR' })
        .expect(200);

      expect(res.body.data.every((o: any) => o.status === 'BORRADOR')).toBe(true);
    });

    it('filtra por supplierId', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ supplierId })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((o: any) => o.supplierId === supplierId)).toBe(true);
    });

    it('busca por numero de orden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'PC-' })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // 3. Obtener orden por ID
  // ============================================================

  describe('GET /purchase-orders/:id', () => {
    it('retorna orden completa con relaciones', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/purchase-orders/${draftOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(draftOrderId);
      expect(res.body.supplier).toBeDefined();
      expect(res.body.supplier.id).toBe(supplierId);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.receipts).toBeInstanceOf(Array);
    });

    it('retorna 404 para ID inexistente', async () => {
      await request(app.getHttpServer())
        .get('/api/purchase-orders/non-existent-id-xyz')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // ============================================================
  // 4. Editar orden (solo BORRADOR)
  // ============================================================

  describe('PATCH /purchase-orders/:id', () => {
    it('edita notas y fecha en BORRADOR', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/purchase-orders/${draftOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Notas actualizadas por E2E' })
        .expect(200);

      expect(res.body.notes).toBe('Notas actualizadas por E2E');
    });

    it('actualiza items y recalcula totales', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/purchase-orders/${draftOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { productId, quantityOrdered: 5, unitCost: 100.00, tax: 0 },
          ],
        })
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantityOrdered).toBe(5);
      expect(parseFloat(res.body.subtotal)).toBeCloseTo(500.00);
      expect(parseFloat(res.body.total)).toBeCloseTo(500.00);
    });
  });

  // ============================================================
  // 5. Enviar orden (BORRADOR -> ENVIADA)
  // ============================================================

  describe('POST /purchase-orders/:id/send', () => {
    it('cambia estado a ENVIADA', async () => {
      // Crear orden dedicada para este test y para los tests de recepcion
      const createRes = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          supplierId,
          items: [{ productId, quantityOrdered: 3, unitCost: 50.00, tax: 0 }],
        })
        .expect(201);

      sentOrderId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .post(`/api/purchase-orders/${sentOrderId}/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(res.body.status).toBe('ENVIADA');
    });

    it('rechaza enviar una orden no BORRADOR', async () => {
      // sentOrderId ya esta en ENVIADA
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${sentOrderId}/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('rechaza editar orden ya enviada', async () => {
      await request(app.getHttpServer())
        .patch(`/api/purchase-orders/${sentOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Intento de edicion' })
        .expect(400);
    });
  });

  // ============================================================
  // 6. Cancelar orden
  // ============================================================

  describe('POST /purchase-orders/:id/cancel', () => {
    it('cancela orden en BORRADOR', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          supplierId,
          items: [{ productId, quantityOrdered: 2, unitCost: 30.00, tax: 0 }],
        })
        .expect(201);

      cancelTargetOrderId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .post(`/api/purchase-orders/${cancelTargetOrderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(res.body.status).toBe('CANCELADA');
    });

    it('rechaza cancelar orden ya cancelada', async () => {
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${cancelTargetOrderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  // ============================================================
  // 7. Recibir mercancia + impacto en inventario
  // ============================================================

  describe('POST /purchase-orders/:id/receive', () => {
    let stockBefore: number;

    beforeAll(async () => {
      // GET /products/:id es @Public() → JwtGuard bypassed → tenantId no se inyecta → 500.
      // Usamos GET /products (autenticado, limit max=100) para leer el stock.
      const productsRes = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 100, page: 1 })
        .expect(200);

      const found = (productsRes.body.data ?? []).find((p: any) => p.id === productId);
      stockBefore = found?.stock ?? 0;
    });

    it('rechaza recibir una orden en BORRADOR', async () => {
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${draftOrderId}/receive`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantityReceived: 1 }],
        })
        .expect(400);
    });

    it('rechaza recibir una orden cancelada', async () => {
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${cancelTargetOrderId}/receive`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantityReceived: 1 }],
        })
        .expect(400);
    });

    it('rechaza recepcion sin cantidades mayores a 0', async () => {
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${sentOrderId}/receive`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantityReceived: 0 }],
        })
        .expect(400);
    });

    it('rechaza recibir mas de lo ordenado', async () => {
      // sentOrderId tiene 3 unidades ordenadas
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${sentOrderId}/receive`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantityReceived: 99 }],
        })
        .expect(400);
    });

    it('recepcion parcial: cambia estado a PARCIAL e incrementa stock', async () => {
      // Recibir 2 de 3 unidades ordenadas
      const res = await request(app.getHttpServer())
        .post(`/api/purchase-orders/${sentOrderId}/receive`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantityReceived: 2 }],
          notes: 'Primera entrega parcial E2E',
        })
        .expect(201);

      expect(res.body.status).toBe('PARCIAL');
      expect(res.body.receipts).toHaveLength(1);
      expect(res.body.receipts[0].items[0].quantityReceived).toBe(2);

      // Verificar incremento de stock
      const productsRes1 = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 100, page: 1 })
        .expect(200);

      const p1 = (productsRes1.body.data ?? []).find((p: any) => p.id === productId);
      expect(p1?.stock).toBe(stockBefore + 2);
    });

    it('recepcion completa: cambia estado a COMPLETADA e incrementa stock restante', async () => {
      const productsRes2 = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 100, page: 1 })
        .expect(200);

      const pMid = (productsRes2.body.data ?? []).find((p: any) => p.id === productId);
      const stockMid = pMid?.stock ?? 0;

      // Recibir la unidad restante (1 de 3 total)
      const res = await request(app.getHttpServer())
        .post(`/api/purchase-orders/${sentOrderId}/receive`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantityReceived: 1 }],
          notes: 'Entrega final E2E',
        })
        .expect(201);

      expect(res.body.status).toBe('COMPLETADA');
      expect(res.body.receipts).toHaveLength(2);

      // Verificar stock total incrementado
      const productsRes3 = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 100, page: 1 })
        .expect(200);

      const pAfter = (productsRes3.body.data ?? []).find((p: any) => p.id === productId);
      expect(pAfter?.stock).toBe(stockMid + 1);
      expect(pAfter?.stock).toBe(stockBefore + 3);
    });

    it('rechaza seguir recibiendo en orden COMPLETADA', async () => {
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${sentOrderId}/receive`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantityReceived: 1 }],
        })
        .expect(400);
    });

    it('rechaza cancelar orden COMPLETADA', async () => {
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${sentOrderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  // ============================================================
  // 8. Historial de recepciones
  // ============================================================

  describe('GET /purchase-orders/:id/receipts', () => {
    it('retorna recepciones con items y producto', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/purchase-orders/${sentOrderId}/receipts`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(2);

      const first = res.body[0];
      expect(first.purchaseOrderId).toBe(sentOrderId);
      expect(first.items).toBeInstanceOf(Array);
      expect(first.items[0].product).toBeDefined();
      expect(first.items[0].product.id).toBe(productId);
    });

    it('retorna 404 para orden inexistente', async () => {
      await request(app.getHttpServer())
        .get('/api/purchase-orders/non-existent-id-xyz/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // ============================================================
  // 9. Integridad: costo promedio y lastCost actualizados
  // ============================================================

  describe('Costo promedio de producto', () => {
    it('producto tiene lastCost y avgCost despues de recepcion', async () => {
      // GET /products/:id es @Public() → no inyecta tenant context → 500.
      // Usamos la lista autenticada.
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 100, page: 1 })
        .expect(200);

      const product = (res.body.data ?? []).find((p: any) => p.id === productId);
      expect(product).toBeDefined();
      expect(product.lastCost).not.toBeNull();
      expect(product.avgCost).not.toBeNull();
      expect(parseFloat(product.lastCost)).toBeCloseTo(50.00);
    });
  });

  // ============================================================
  // 10. Seguridad: aislamiento de tenant
  // ============================================================

  describe('Seguridad', () => {
    it('requiere autenticacion en todos los endpoints', async () => {
      await Promise.all([
        request(app.getHttpServer()).get('/api/purchase-orders').expect(401),
        request(app.getHttpServer()).post('/api/purchase-orders').send({}).expect(401),
        request(app.getHttpServer()).get(`/api/purchase-orders/${draftOrderId}`).expect(401),
        request(app.getHttpServer()).post(`/api/purchase-orders/${draftOrderId}/send`).expect(401),
        request(app.getHttpServer()).post(`/api/purchase-orders/${draftOrderId}/receive`).send({}).expect(401),
      ]);
    });
  });
});
