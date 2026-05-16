import { test, expect, type Page } from '@playwright/test'

// ── Mock data ────────────────────────────────────────────────────────────────

const PRODUCTS_MOCK = {
  data: [
    {
      id: 'prod-001',
      sku: 'TEC-003',
      name: 'Teclado Mecánico RGB',
      description: 'Teclado mecánico retroiluminado',
      price: 120,
      comparePrice: 0,
      costPrice: 72,
      categoryId: 'cat-001',
      status: 'ACTIVE',
      stock: 45,
      trackInventory: true,
      lowStockAlert: 5,
      metaTitle: '',
      metaDescription: '',
      taxRate: 0,
      taxCode: '',
      slug: 'teclado-mecanico-rgb',
    },
    {
      id: 'prod-002',
      sku: 'MOU-004',
      name: 'Mouse Logitech MX Master',
      description: 'Mouse inalámbrico premium',
      price: 100,
      comparePrice: 0,
      costPrice: 60,
      categoryId: 'cat-001',
      status: 'ACTIVE',
      stock: 28,
      trackInventory: true,
      lowStockAlert: 5,
      metaTitle: '',
      metaDescription: '',
      taxRate: 0,
      taxCode: '',
      slug: 'mouse-logitech-mx-master',
    },
  ],
  meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
}

const CUSTOMERS_MOCK = {
  data: [],
  meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
}

const ORDER_CONFIRMED_MOCK = {
  id: 'order-abc-123',
  orderNumber: 'ORD-2026-0042',
  customerId: null,
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  subtotal: '120',
  tax: '0',
  discount: '0',
  shippingCost: '0',
  total: '120',
  notes: null,
  couponCode: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  customer: null,
  items: [
    {
      id: 'item-1',
      productId: 'prod-001',
      productName: 'Teclado Mecánico RGB',
      productSku: 'TEC-003',
      quantity: 1,
      price: '120',
      total: '120',
    },
  ],
  payments: [
    {
      id: 'pay-1',
      paymentMethod: 'CASH',
      amount: '120',
      status: 'COMPLETED',
    },
  ],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setupMocks(page: Page) {
  // Catch-all: devuelve 200 vacío para cualquier llamada API no interceptada
  // (se registra primero = menor prioridad en Playwright LIFO)
  await page.route('**/api/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
    })
  })

  // Productos del catálogo POS
  await page.route('**/api/products**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PRODUCTS_MOCK),
    })
  })

  // Lista de clientes (POS los usa para buscar cliente opcional)
  await page.route('**/api/customers**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CUSTOMERS_MOCK),
    })
  })

  // Crear orden — solo POST
  await page.route('**/api/orders', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(ORDER_CONFIRMED_MOCK),
      })
    } else {
      route.continue()
    }
  })
}

async function authenticateViaLocalStorage(page: Page) {
  // auth-store inicializa isAuthenticated = !!localStorage.getItem('access_token')
  // Con el token presente el AuthGate renderiza AppLayout directamente sin llamar al API de auth
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-fake-token')
  })
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('POS · Venta en efectivo con cambio', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateViaLocalStorage(page)
    await setupMocks(page)
    await page.goto('/')
  })

  test('agrega un producto, paga con efectivo mayor al total y verifica el cambio', async ({ page }) => {
    // ── 1. Abrir el POS desde el topbar ─────────────────────────────────────
    await page.getByRole('button', { name: 'Abrir POS' }).click()

    // ── 2. Esperar a que carguen los productos ───────────────────────────────
    // Usar el role button del ProductCard (incluye SKU en el accessible name)
    const productCard = page.getByRole('button', { name: /Teclado Mecánico RGB/ })
    await expect(productCard).toBeVisible({ timeout: 8_000 })

    // ── 3. Agregar producto al carrito ───────────────────────────────────────
    await productCard.click()

    // El panel derecho muestra el ítem en la lista del carrito
    // CartRow usa texto "Teclado Mecánico RGB" + precio "c/u"
    await expect(page.getByText(/\$120\.00 c\/u/)).toBeVisible()

    // Contador en la tarjeta del producto (badge qty = 1)
    const productBadge = productCard.locator('.bg-primary.rounded-full')
    await expect(productBadge).toHaveText('1')

    // ── 4. Ir a la pantalla de cobro ─────────────────────────────────────────
    await page.getByRole('button', { name: /Cobrar \$120\.00/i }).click()

    // Título del panel de checkout
    await expect(page.getByText('Resumen de Cobro')).toBeVisible()

    // ── 5. Ingresar efectivo mayor al total ($200 > $120) ────────────────────
    // Primer input type="number" es Efectivo recibido
    const efectivoInput = page.locator('input[placeholder="0.00"]').first()
    await efectivoInput.fill('200')

    // ── 6. Verificar que aparece el bloque de cambio ─────────────────────────
    await expect(page.getByText('Cambio a entregar')).toBeVisible()

    // Cambio = 200 - 120 = 80 → fmt(80) = "$80.00" en es-MX/MXN
    const cambioBlock = page.locator(':text("Cambio a entregar")').locator('..')
    await expect(cambioBlock).toContainText('$80.00')

    // Efectivo aplicado = 120 (solo el necesario para cubrir el total)
    await expect(page.getByText('Efectivo aplicado')).toBeVisible()
    const efectivoAplicadoBlock = page.locator(':text("Efectivo aplicado")').locator('..')
    await expect(efectivoAplicadoBlock).toContainText('$120.00')

    // ── 7. Confirmar el cobro ────────────────────────────────────────────────
    await page.getByRole('button', { name: /Confirmar cobro/i }).click()

    // ── 8. Verificar toast de éxito con número de orden ──────────────────────
    await expect(page.getByText('Venta registrada')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('ORD-2026-0042')).toBeVisible()
  })

  test('el payload enviado al API incluye method CASH, amountReceived y changeGiven', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null

    // Interceptar y capturar el body del POST /orders
    await page.route('**/api/orders', async route => {
      if (route.request().method() === 'POST') {
        capturedBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(ORDER_CONFIRMED_MOCK),
        })
      } else {
        await route.continue()
      }
    })

    // Flujo rápido: abrir POS → agregar producto → checkout → pagar con $500
    await page.getByRole('button', { name: 'Abrir POS' }).click()
    const productCard2 = page.getByRole('button', { name: /Teclado Mecánico RGB/ })
    await expect(productCard2).toBeVisible({ timeout: 8_000 })
    await productCard2.click()
    await page.getByRole('button', { name: /Cobrar \$120\.00/i }).click()

    const efectivoInput = page.locator('input[placeholder="0.00"]').first()
    await efectivoInput.fill('500')

    await page.getByRole('button', { name: /Confirmar cobro/i }).click()
    await expect(page.getByText('Venta registrada')).toBeVisible({ timeout: 5_000 })

    // Verificar estructura del payload
    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.paymentMethod).toBe('CASH')
    expect(capturedBody!.paymentStatus).toBe('PAID')
    expect(capturedBody!.status).toBe('CONFIRMED')

    const payments = capturedBody!.payments as Array<{
      method: string
      amount: number
      amountReceived?: number
      changeGiven?: number
    }>
    expect(payments).toHaveLength(1)

    const cashPayment = payments[0]
    expect(cashPayment.method).toBe('CASH')
    expect(cashPayment.amount).toBe(120)     // solo el monto aplicado
    expect(cashPayment.amountReceived).toBe(500) // lo que entregó el cliente
    expect(cashPayment.changeGiven).toBe(380)    // cambio = 500 - 120
  })
})
