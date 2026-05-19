import { test, expect, type Page } from '@playwright/test'

// ── Mock data ─────────────────────────────────────────────────────────────────

const TENANTS_MOCK = {
  data: [],
  meta: { page: 1, limit: 15, total: 0, totalPages: 1 },
}

const PROVISION_RESPONSE = {
  tenant: {
    id: 'tenant-e2e-001',
    name: 'Empresa E2E Test',
    slug: 'empresa-e2e-test',
    status: 'ACTIVE',
    plan: 'PRO',
    enabledModules: [],
    overUserLimit: false,
    userLimitOverride: null,
    ownerUserId: null,
    trialEndsAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
}

const DASHBOARD_MOCK = {
  tenants: { total: 0, active: 0, trial: 0, suspended: 0 },
  users: { total: 0 },
  branches: { total: 0 },
  byPlan: [],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setupMocks(page: Page) {
  // Catch-all for unmocked platform endpoints
  await page.route('**/api/platform/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  await page.route('**/api/platform/tenants/dashboard', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DASHBOARD_MOCK) })
  })

  await page.route('**/api/platform/tenants?**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TENANTS_MOCK) })
  })

  await page.route('**/api/platform/tenants/provision', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(PROVISION_RESPONSE) })
    } else {
      route.continue()
    }
  })
}

async function authenticateAsPlatformUser(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('platform_access_token', 'e2e-platform-fake-token')
  })
}

async function openModal(page: Page) {
  await page.goto('/platform/empresas')
  await page.getByRole('button', { name: /Nueva empresa/i }).click()
  await expect(page.getByText('Alta completa de tenant')).toBeVisible({ timeout: 6_000 })
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('Platform · Provision modal — nueva empresa', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAsPlatformUser(page)
    await setupMocks(page)
  })

  test('flujo completo: 4 pasos → submit → pantalla de éxito', async ({ page }) => {
    await openModal(page)

    // ── Step 1: Empresa ──────────────────────────────────────────────────────
    await expect(page.getByText('Datos de la empresa')).toBeVisible()

    const nameInput = page.getByPlaceholder('Mi Empresa S.A. de C.V.')
    await nameInput.fill('Empresa E2E Test')
    // trigger blur para auto-slug
    await nameInput.blur()

    const slugInput = page.getByPlaceholder('mi-empresa')
    await expect(slugInput).toHaveValue('empresa-e2e-test')

    await page.getByRole('button', { name: 'Siguiente' }).click()

    // ── Step 2: Plan ─────────────────────────────────────────────────────────
    await expect(page.getByText('Seleccionar plan')).toBeVisible()
    // PRO está seleccionado por default — avanzar directo
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // ── Step 3: Sucursal ─────────────────────────────────────────────────────
    await expect(page.getByText('Sucursal principal')).toBeVisible()

    await page.getByPlaceholder('Sucursal Principal').fill('Sucursal Central')
    await page.getByPlaceholder('SUC-01').fill('SUC-01')

    await page.getByRole('button', { name: 'Siguiente' }).click()

    // ── Step 4: Admin ────────────────────────────────────────────────────────
    await expect(page.getByText('Usuario administrador principal')).toBeVisible()

    await page.getByPlaceholder('Juan').fill('Carlos')
    await page.getByPlaceholder(/García/i).fill('Ramírez')
    await page.getByPlaceholder('admin@empresa.com').fill('admin@empresae2e.com')
    await page.locator('input[type="password"]').fill('Password123')

    await page.getByRole('button', { name: 'Crear empresa' }).click()

    // ── Éxito ────────────────────────────────────────────────────────────────
    await expect(page.getByText('¡Empresa creada!')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Empresa E2E Test')).toBeVisible()
  })

  test('botón Siguiente deshabilitado si faltan campos requeridos en step 1', async ({ page }) => {
    await openModal(page)

    const next = page.getByRole('button', { name: 'Siguiente' })
    await expect(next).toBeDisabled()

    await page.getByPlaceholder('Mi Empresa S.A. de C.V.').fill('Test')
    // sin slug sigue deshabilitado
    await expect(next).toBeDisabled()

    await page.getByPlaceholder('mi-empresa').fill('test-slug')
    await expect(next).toBeEnabled()
  })

  test('botón Siguiente deshabilitado en step 3 si faltan nombre y código de sucursal', async ({ page }) => {
    await openModal(page)

    // Avanzar a step 2
    await page.getByPlaceholder('Mi Empresa S.A. de C.V.').fill('Test Corp')
    await page.getByPlaceholder('mi-empresa').fill('test-corp')
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // step 2 → step 3
    await page.getByRole('button', { name: 'Siguiente' }).click()

    await expect(page.getByText('Sucursal principal')).toBeVisible()
    const next = page.getByRole('button', { name: 'Siguiente' })
    await expect(next).toBeDisabled()

    await page.getByPlaceholder('Sucursal Principal').fill('Central')
    await expect(next).toBeDisabled()

    await page.getByPlaceholder('SUC-01').fill('MAIN')
    await expect(next).toBeEnabled()
  })

  test('botón Crear empresa deshabilitado hasta completar todos los campos del admin', async ({ page }) => {
    await openModal(page)

    // Step 1
    await page.getByPlaceholder('Mi Empresa S.A. de C.V.').fill('Test Corp')
    await page.getByPlaceholder('mi-empresa').fill('test-corp')
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // Step 2
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // Step 3
    await page.getByPlaceholder('Sucursal Principal').fill('Principal')
    await page.getByPlaceholder('SUC-01').fill('MAIN')
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // Step 4
    await expect(page.getByText('Usuario administrador principal')).toBeVisible()
    const submit = page.getByRole('button', { name: 'Crear empresa' })
    await expect(submit).toBeDisabled()

    await page.getByPlaceholder('Juan').fill('Ana')
    await page.getByPlaceholder(/García/i).fill('López')
    await page.getByPlaceholder('admin@empresa.com').fill('ana@corp.com')
    // password de 7 chars — todavía inválido
    await page.locator('input[type="password"]').fill('short12')
    await expect(submit).toBeDisabled()

    await page.locator('input[type="password"]').fill('ValidPass1')
    await expect(submit).toBeEnabled()
  })

  test('Atrás regresa al paso anterior y conserva los datos', async ({ page }) => {
    await openModal(page)

    const nameInput = page.getByPlaceholder('Mi Empresa S.A. de C.V.')
    await nameInput.fill('Empresa Retroceso')
    await nameInput.blur()

    const slugInput = page.getByPlaceholder('mi-empresa')
    await slugInput.clear()
    await slugInput.fill('empresa-retroceso')
    await page.getByRole('button', { name: 'Siguiente' }).click()

    await expect(page.getByText('Seleccionar plan')).toBeVisible()
    await page.getByRole('button', { name: 'Atrás' }).click()

    await expect(page.getByText('Datos de la empresa')).toBeVisible()
    await expect(page.getByPlaceholder('Mi Empresa S.A. de C.V.')).toHaveValue('Empresa Retroceso')
    await expect(page.getByPlaceholder('mi-empresa')).toHaveValue('empresa-retroceso')
  })

  test('Cancelar cierra el modal', async ({ page }) => {
    await openModal(page)

    await expect(page.getByText('Alta completa de tenant')).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()

    await expect(page.getByText('Alta completa de tenant')).not.toBeVisible()
  })

  test('el payload enviado al API tiene la estructura correcta', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null

    await page.route('**/api/platform/tenants/provision', route => {
      if (route.request().method() === 'POST') {
        capturedBody = JSON.parse(route.request().postData() ?? '{}')
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(PROVISION_RESPONSE) })
      } else {
        route.continue()
      }
    })

    await openModal(page)

    // Step 1
    const nameInput = page.getByPlaceholder('Mi Empresa S.A. de C.V.')
    await nameInput.fill('Payload Test')
    await nameInput.blur()

    const slugInput = page.getByPlaceholder('mi-empresa')
    await slugInput.clear()
    await slugInput.fill('payload-test')
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // Step 2 — seleccionar STARTER
    await page.getByRole('button', { name: /Starter/i }).click()
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // Step 3
    await page.getByPlaceholder('Sucursal Principal').fill('Sucursal Payload')
    await page.getByPlaceholder('SUC-01').fill('PAY-01')
    await page.getByRole('button', { name: 'Siguiente' }).click()

    // Step 4
    await page.getByPlaceholder('Juan').fill('Luis')
    await page.getByPlaceholder(/García/i).fill('Martínez')
    await page.getByPlaceholder('admin@empresa.com').fill('luis@payload.com')
    await page.locator('input[type="password"]').fill('SecurePass1')

    await page.getByRole('button', { name: 'Crear empresa' }).click()
    await expect(page.getByText('¡Empresa creada!')).toBeVisible({ timeout: 8_000 })

    expect(capturedBody).not.toBeNull()
    expect(capturedBody!.tenant).toMatchObject({ name: 'Payload Test', slug: 'payload-test', plan: 'STARTER' })
    expect(capturedBody!.branch).toMatchObject({ name: 'Sucursal Payload', code: 'PAY-01' })
    expect(capturedBody!.adminUser).toMatchObject({
      firstName: 'Luis',
      lastName: 'Martínez',
      email: 'luis@payload.com',
    })
  })
})
