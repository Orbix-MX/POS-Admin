import { test, expect, type Page } from '@playwright/test'

// ── Mock data ────────────────────────────────────────────────────────────────

const SESSION_ID = 'session-e2e-001'

function buildSession() {
  return {
    id: SESSION_ID,
    tenantId: 'tenant-001',
    branchId: null,
    status: 'ABIERTA',
    exchangeRateUsdMxn: '19.50',
    openingAmount: '500',
    openingAmountUsd: '0',
    expectedAmount: null,
    cashCounted: null,
    cashCountedUsd: null,
    difference: null,
    differenceUsd: null,
    notes: null,
    openedAt: new Date().toISOString(),
    closedAt: null,
    openedBy: { id: 'user-001', email: 'cajero@e2e.test' },
    closedBy: null,
    authorizedBy: null,
    branch: null,
    movements: [],
    summary: {
      openingAmount: 500,
      openingAmountUsd: 0,
      expectedCash: 500,
      expectedCashUsd: 0,
      totals: {
        sales: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
        cxc: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
        supplier: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
        income: { cash: 0, cashUsd: 0, total: 0 },
        expense: { cash: 0, cashUsd: 0, total: 0 },
        withdrawal: { cash: 0, cashUsd: 0, total: 0 },
        refund: { cash: 0, cashUsd: 0, card: 0, transfer: 0, total: 0 },
      },
      movementsCount: 0,
    },
    _count: { movements: 0 },
  }
}

const CASH_COUNT_MOCK = {
  id: 'count-e2e-001',
  type: 'PARCIAL',
  countedMxn: '350',
  countedUsd: '0',
  expectedMxn: '500',
  expectedUsd: '0',
  differenceMxn: '-150',
  differenceUsd: '0',
  reason: 'Se detecta faltante al contar el cajón, posible error al dar cambio',
  createdAt: new Date().toISOString(),
  countedBy: { id: 'user-001', email: 'cajero@e2e.test' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function authenticateViaLocalStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-fake-token')
  })
}

async function setupMocks(page: Page) {
  // Catch-all de menor prioridad (registrado primero, Playwright usa LIFO).
  await page.route('**/api/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
    })
  })

  await page.route('**/api/cash-sessions/active', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSession()),
    })
  })

  await page.route('**/api/cash-sessions/active/count', route => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(CASH_COUNT_MOCK),
    })
  })
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('Caja · Arqueo sin cierre con faltante', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateViaLocalStorage(page)
    await setupMocks(page)
    await page.goto('/caja')
  })

  test('cuenta la caja abierta y reporta un faltante sin cerrar la sesión', async ({ page }) => {
    // ── 1. Sesión activa ABIERTA visible ────────────────────────────────────
    await expect(page.getByText('Sesión activa')).toBeVisible()
    await expect(page.getByText('Abierta', { exact: true })).toBeVisible()

    // El arqueo PARCIAL se hace con la caja operando: no requiere congelarla
    // primero con "Arquear" (ese botón congela toda la operación, CASH-011;
    // "Contar caja" solo registra un conteo puntual, CASH-006).
    await expect(page.getByRole('button', { name: /Contar caja/i })).toBeVisible()

    // ── 2. Abrir el conteo ────────────────────────────────────────────────
    await page.getByRole('button', { name: /Contar caja/i }).click()
    await expect(page.getByText('Registrar arqueo')).toBeVisible()
    await expect(page.getByText('Esperado', { exact: true })).toBeVisible()

    // ── 3. Ingresar un contado menor al esperado (faltante de $150.00) ──────
    const contadoInput = page.locator('input[placeholder="0.00"]').first()
    await contadoInput.fill('350')
    await expect(page.getByText('-$150.00 (faltante)')).toBeVisible()

    // ── 4. El motivo es obligatorio cuando hay diferencia ────────────────────
    await expect(page.getByPlaceholder('Explica el faltante o sobrante')).toBeVisible()
    await page.getByPlaceholder('Explica el faltante o sobrante').fill(
      'Se detecta faltante al contar el cajón, posible error al dar cambio',
    )

    // ── 5. Registrar el arqueo ────────────────────────────────────────────
    await page.getByRole('button', { name: /Registrar conteo/i }).click()

    // ── 6. Confirmación con el faltante reportado, sesión sigue sin cerrarse ─
    await expect(page.getByText('Arqueo registrado correctamente')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('-$150.00 (faltante)')).toBeVisible()
    await expect(page.getByText(/Motivo registrado:/)).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

    // La sesión sigue ABIERTA — no hubo cierre de caja
    await expect(page.getByText('Abierta', { exact: true })).toBeVisible()
  })

  test('exige motivo antes de registrar el arqueo cuando hay diferencia', async ({ page }) => {
    await page.getByRole('button', { name: /Contar caja/i }).click()
    const contadoInput = page.locator('input[placeholder="0.00"]').first()
    await contadoInput.fill('350')

    // Se envía sin llenar el motivo requerido
    await page.getByRole('button', { name: /Registrar conteo/i }).click()

    await expect(page.getByText('Explica el motivo de la diferencia antes de registrar el arqueo')).toBeVisible()
    await expect(page.getByText('Arqueo registrado correctamente')).not.toBeVisible()
  })
})
